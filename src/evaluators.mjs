// The check-kind registry (ARCHITECTURE §5). makeEvalCheck(ctx) closes over the repo
// index, resolved config, and descriptor; evalCheck(c, rule) -> {ok: true|false|null,
// detail, signoff?}. ok:null means "not evaluable here" → the engine tags SKIP, so one
// broken/unreadable check can never take down the run. Zero-dependency: git via repo.mjs,
// forge via a lazy `gh` probe that degrades to a LABELED SKIP offline / token-denied —
// never a silent PASS (§1, §5.3). No YAML parser: workflow analysis is line/regex scanning
// and every structural claim is labeled heuristic.
//
// Kind inventory: 10 reused (any-of, any-file, grep, file-contains, json-field, descriptor,
// descriptor-valid, workflow-state, forge-protection, signoff) + 15 new. ARCHITECTURE §5.2
// lists ten new by name; RULES.md's CHECK prose needs five more (release-marks,
// env-deploy-path, env-trigger, iac-state, iac-secrets) — see docs/spec/FOLLOW-UPS.md #8.
import { execFileSync } from 'node:child_process'
import { asArr, parseDate } from './repo.mjs'
import { loadJudgments, loadFlags, selectSignoffs, gatherJdgFacts, ledgerHealth } from './jdg.mjs'

// Every kind evalCheck() knows how to run; --self-check (src/selfcheck.mjs) flags any rule check.kind not in here.
export const CHECK_KINDS = new Set([
  'any-of', 'any-file', 'grep', 'file-contains', 'json-field', 'descriptor', 'descriptor-valid', 'workflow-state', 'forge-protection', 'signoff',
  'profile-consistency', 'branch-model', 'stale-branches', 'release-marks', 'env-inventory', 'env-deploy-path', 'env-trigger', 'env-protection', 'workflow-job-order', 'iac-state', 'iac-secrets', 'flag-registry', 'hotfix-backmerge', 'jdg-health', 'breakglass-ledger',
])

const reOf = (p, f) => { try { return new RegExp(p, f || 'im') } catch { return null } }
const nonEmpty = v => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)
const setEq = (a, b) => a.size === b.size && [...a].every(x => b.has(x))
const short = (arr, n = 3) => arr.slice(0, n).join(', ') + (arr.length > n ? ` (+${arr.length - n})` : '')

// ---- lazy forge (gh) probe — one spawn to establish reachability, then per-endpoint ----
export function makeForge(repo, noForge = false) {
  let probed = false, avail = false, reason = 'forge not consulted', slug = null
  const run = args => { try { return execFileSync('gh', args, { cwd: repo.REPO, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 }).toString('utf8') } catch { return null } }
  function probe() {
    if (probed) return; probed = true
    if (noForge) { reason = 'forge disabled (--no-forge)'; return }
    const out = run(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'])
    if (out && out.trim()) { avail = true; slug = out.trim() } else { reason = 'gh unavailable, unauthenticated, or no GitHub remote' }
  }
  return {
    get available() { probe(); return avail },
    get reason() { probe(); return reason },
    get slug() { probe(); return slug },
    api(p) { probe(); if (!avail) return null; const o = run(['api', '-H', 'Accept: application/vnd.github+json', p]); if (o == null) return null; try { return JSON.parse(o) } catch { return null } },
  }
}

// Ledger reader + judgment evaluation now live in src/jdg.mjs (issue #5 factored them out of
// here). loadJudgments/loadFlags return [{ file, name, data, errors }]; selectSignoffs picks
// the newest valid sign-off per subject; ledgerHealth + gatherJdgFacts run the full
// expected_state/tripwire/review_by evaluator that GOV-01's jdg-health reuses in-check.

export function makeEvalCheck({ repo, cfg, DESCRIPTOR = null, declaredTier = 'solo', noForge = false, today = null }) {
  const { match, read, readText, readRaw, tags, lsRemoteHeads, localHeads, commitISO, firstCommitISO, isAncestor, HEAD } = repo
  const TODAY = today || new Date().toISOString().slice(0, 10)
  const forge = makeForge(repo, noForge)
  const desc = DESCRIPTOR && DESCRIPTOR.valid ? DESCRIPTOR.data : null

  // union of a check's static globs + any config-named glob lists (all additive)
  const gather = c => {
    let g = asArr(c.globs)
    if (c.globs_from_config) g = [...g, ...asArr(cfg[c.globs_from_config])]
    if (c.extra_globs_from_config) g = [...g, ...asArr(cfg[c.extra_globs_from_config])]
    return g
  }
  const daysOf = c => (cfg[c.days_from_config] != null ? cfg[c.days_from_config] : c.default_days)
  const ageDays = iso => { const d = parseDate(iso); return d ? (Date.now() - d.getTime()) / 86400000 : null }

  // integration-branch resolution (BR-04/ENV-03/HOT-02 share the fallback contract, §DESC)
  const integrationBranch = () => {
    if (desc?.branches?.integration) return desc.branches.integration
    if (!desc) return 'main'
    if (desc.branching_model === 'gitflow') return 'develop'
    if (desc.branching_model === 'dev-staging-main') return 'dev'
    return desc.default_branch // trunk → default branch
  }
  // inline `environment: <name>` references across workflow files (line-scan; heuristic)
  const workflowEnvs = () => {
    const set = new Set()
    for (const f of match(['.github/workflows/*.yml', '.github/workflows/*.yaml'])) {
      const t = readText(f); if (!t) continue
      for (const m of t.matchAll(/^\s*environment:\s*['"]?([A-Za-z0-9_.\-]+)['"]?\s*$/gm)) set.add(m[1])
      for (const m of t.matchAll(/^\s*environment:\s*\n\s*name:\s*['"]?([A-Za-z0-9_.\-]+)/gm)) set.add(m[1])
    }
    return set
  }
  const hasIaC = () => match(['**/*.tf', '**/Pulumi.yaml', '**/cdk.json', '**/serverless.yml', '**/*.bicep', '**/*.template']).length > 0

  function evalCheck(c, rule) {
    const k = c.kind

    // ---------- reused kinds ----------
    if (k === 'any-of') {
      const subs = (c.checks || []).map(sc => evalCheck(sc, rule))
      const win = subs.find(s => s.ok === true); if (win) return { ok: true, detail: win.detail }
      const bad = subs.filter(s => s.ok === false)
      if (bad.length) return { ok: false, detail: bad.map(s => s.detail).slice(0, 2).join(' | ') || 'no alternative satisfied' }
      return { ok: null, detail: subs.map(s => s.detail).find(Boolean) || 'n/a (no applicable target)' }
    }

    if (k === 'any-file') {
      const files = match(gather(c), { tracked: !!c.tracked_only, exclude: c.allow, excludeGlobs: c.exclude_globs })
      if (c.mode === 'absent') return { ok: files.length === 0, detail: files.length ? 'found: ' + short(files) : 'none present (good)' }
      return { ok: files.length > 0, detail: files.length ? short(files, 2) : 'none of: ' + short(asArr(gather(c)), 5) }
    }

    if (k === 'grep') {
      const files = match(gather(c), { tracked: !!c.tracked_only, excludeGlobs: c.exclude_globs })
      if (!files.length) return { ok: null, detail: 'no files to scan' }
      const re = reOf(c.pattern, c.flags); if (!re) return { ok: null, detail: 'bad regex in rule' }
      const rd = c.raw_scan ? readRaw : readText
      const hit = files.filter(f => { const t = rd(f); return t && re.test(t) })
      const present = hit.length > 0
      if (c.mode === 'absent') return { ok: !present, detail: present ? `matched in ${hit.length} file(s): ${short(hit, 2)}` : 'pattern not found (good)' }
      return { ok: present, detail: present ? `matched in ${hit.length} file(s): ${short(hit, 2)}` : 'pattern not found' }
    }

    if (k === 'file-contains') {
      const files = match(gather(c))
      if (!files.length) return { ok: false, detail: 'file absent: ' + short(asArr(gather(c))) }
      const re = reOf(c.pattern, c.flags); if (!re) return { ok: null, detail: 'bad regex in rule' }
      const heur = c.ordering === 'after-deploy' ? ' (heuristic: line-position ordering, no YAML parser)' : ''
      const good = files.filter(f => { const t = readText(f); return t && re.test(t) })
      if (good.length) return { ok: true, detail: `${good[0]} ok${heur}` }
      return { ok: false, detail: `${files[0]} present but missing required content${heur}` }
    }

    if (k === 'json-field') { // no v1 rule uses this; kept for parity with the reused set
      const files = match(gather(c))
      if (!files.length) return { ok: null, detail: 'no matching JSON file' }
      for (const f of files) {
        const t = read(f); if (!t) continue
        let data; try { data = JSON.parse(t) } catch { return { ok: false, detail: `${f} is not valid JSON` } }
        const v = String(c.path).split('.').reduce((o, kk) => (o == null ? undefined : o[kk]), data)
        if (c.assert === 'nonempty' ? nonEmpty(v) : c.assert === 'present' ? v != null : v === c.equals) return { ok: true, detail: `${f}: ${c.path} ok` }
      }
      return { ok: false, detail: `${c.path} not satisfied` }
    }

    if (k === 'descriptor') { // DESC-01: presence only (validity is DESC-02's)
      if (!DESCRIPTOR || !DESCRIPTOR.present) return { ok: false, detail: 'no pipeline.repo.json — the repo does not declare its profile/branching/environments; copy a config-presets/*.repo.json preset' }
      if (!DESCRIPTOR.valid) return { ok: true, detail: 'pipeline.repo.json present (schema validity is DESC-02’s finding)' }
      const x = DESCRIPTOR.data
      return { ok: true, detail: `type=${x.type} · profile=${x.profile} · ${x.branching_model} · default=${x.default_branch}` }
    }

    if (k === 'descriptor-valid') { // DESC-02: absent→SKIP (§5.3 pin); present-but-invalid→FAIL
      if (!DESCRIPTOR || !DESCRIPTOR.present) return { ok: null, detail: 'no pipeline.repo.json — absence is DESC-01’s warning, not this blocker' }
      if (!DESCRIPTOR.valid) return { ok: false, detail: `pipeline.repo.json invalid: ${DESCRIPTOR.errors.slice(0, 2).join('; ')}${DESCRIPTOR.errors.length > 2 ? ` (+${DESCRIPTOR.errors.length - 2})` : ''} — fix the errors or re-copy a preset` }
      return { ok: true, detail: 'pipeline.repo.json schema-valid' }
    }

    if (k === 'signoff') {
      const j = signoffs()[rule.id]
      const objNote = c.descriptor_field && !(desc && nonEmpty(desc[c.descriptor_field])) ? ` · note: descriptor '${c.descriptor_field}' not declared` : ''
      if (j) {
        if (j.review_by < TODAY) return { ok: false, detail: `sign-off ${j.id} lapsed (review_by ${j.review_by}) — re-judge: pipeline jdg new${objNote}`, signoff: true }
        return { ok: true, detail: `${j.id} by ${j.by} ${j.date} (review by ${j.review_by})${objNote}` }
      }
      return { ok: false, detail: `no sign-off recorded for ${rule.id} — pipeline jdg new --kind sign-off --subject ${rule.id}${objNote}`, signoff: true }
    }

    // ---------- new kinds ----------
    if (k === 'forge-protection') {
      if (!(desc && desc.default_branch)) return { ok: null, detail: 'default branch undeclared (needs a valid pipeline.repo.json) — protection has no subject' }
      const branch = desc.default_branch
      if (!forge.available) return { ok: null, detail: `forge: not consulted (${forge.reason}) — branch protection unknowable offline` }
      const rules = forge.api(`repos/${forge.slug}/rules/branches/${encodeURIComponent(branch)}`)
      if (!Array.isArray(rules)) return { ok: null, detail: `forge: not consulted — branch rules unreadable for ${branch}` }
      const types = new Set(rules.map(r => r.type))
      if (c.gov === 'protection') {
        const noForce = types.has('non_fast_forward'), noDirect = types.has('pull_request')
        if (noForce && noDirect) return { ok: true, detail: `${branch}: force-push + direct-push disallowed (non_fast_forward + pull_request)` }
        const miss = [!noForce && 'force-push (non_fast_forward)', !noDirect && 'direct-push (pull_request)'].filter(Boolean)
        return { ok: false, detail: `${branch}: not fully protected — missing ${miss.join(' + ')}; add a ruleset` }
      }
      if (c.gov === 'reviews') {
        const pr = rules.find(r => r.type === 'pull_request')
        const n = pr?.parameters?.required_approving_review_count ?? 0
        return n >= 1 ? { ok: true, detail: `${branch}: ${n} required approving review(s)` } : { ok: false, detail: `${branch}: required reviews < 1 — set required_approving_review_count ≥ 1` }
      }
      if (c.gov === 'required-checks') {
        const rsc = rules.find(r => r.type === 'required_status_checks')
        if (!rsc) return { ok: false, detail: `${branch}: no required-status-checks rule — a red pipeline can merge` }
        const strict = rsc.parameters?.strict_required_status_checks_policy === true
        const have = (rsc.parameters?.required_status_checks || []).map(x => x.context || x)
        const want = asArr(cfg[c.check_names_from_config])
        const missing = want.filter(w => !have.some(h => h === w || String(h).includes(w)))
        const namesLabel = want.length ? '' : ' (check names not configured — heuristic: rule presence + strict policy only)'
        if (strict && missing.length === 0) return { ok: true, detail: `${branch}: required checks${want.length ? ` [${want.join(', ')}]` : ''} + strict up-to-date${namesLabel}` }
        const miss = [!strict && 'strict up-to-date policy', missing.length && `checks: ${missing.join(', ')}`].filter(Boolean)
        return { ok: false, detail: `${branch}: ${miss.join(' + ')}${namesLabel}` }
      }
      return { ok: null, detail: `unknown gov '${c.gov}'` }
    }

    if (k === 'workflow-state') {
      const wfs = match(asArr(c.globs).length ? c.globs : ['.github/workflows/*.yml', '.github/workflows/*.yaml']).sort()
      if (!wfs.length) return { ok: null, detail: 'no .github/workflows/ files — nothing to be alive' }
      if (!forge.available) return { ok: null, detail: `forge: not consulted (${forge.reason}) — workflow liveness unknowable offline` }
      const list = forge.api(`repos/${forge.slug}/actions/workflows?per_page=100`)
      if (!Array.isArray(list?.workflows)) return { ok: null, detail: 'forge: not consulted — workflows endpoint unreadable' }
      const byPath = new Map(list.workflows.map(w => [w.path, w.state]))
      const dead = wfs.map(f => [f, byPath.get(f)]).filter(([, st]) => st && st !== 'active').map(([f, st]) => `${f.split('/').pop()}: ${st}`)
      if (dead.length) return { ok: false, detail: `disabled workflow(s): ${dead.join('; ')} — gh workflow enable <file>` }
      return { ok: true, detail: `${wfs.length} delivery workflow(s) active at the forge` }
    }

    if (k === 'env-protection') { // ENV-04
      if (!desc) return { ok: null, detail: 'no valid descriptor — prod tier undeclared' }
      const prodName = cfg[c.prod_environment_from_config]
      const prod = (desc.environments || []).find(e => e.tier === 'prod') || (desc.environments || []).find(e => e.name === prodName)
      if (!prod) return { ok: null, detail: `no prod-tier environment declared (environments[].tier:prod or name:${prodName}) — nothing to gate` }
      if (!forge.available) return { ok: null, detail: `forge: not consulted (${forge.reason}) — prod gating unknowable offline` }
      const env = forge.api(`repos/${forge.slug}/environments/${encodeURIComponent(prod.name)}`)
      if (!env || typeof env !== 'object') return { ok: null, detail: `forge: not consulted — environment '${prod.name}' unreadable` }
      const prot = env.protection_rules || []
      const gated = prot.some(p => p.type === 'required_reviewers') || prot.some(p => p.type === 'wait_timer' && p.wait_timer > 0) || prot.some(p => p.type === 'branch_policy')
      if (gated) return { ok: true, detail: `'${prod.name}' gated: ${[...new Set(prot.map(p => p.type))].join(', ')}` }
      return { ok: false, detail: `'${prod.name}' has no deployment protection rules — add required reviewers` }
    }

    if (k === 'env-inventory') { // ENV-01
      if (!desc) return { ok: null, detail: 'no valid descriptor — no tier list to reconcile' }
      const dSet = new Set((desc.environments || []).map(e => e.name))
      const wSet = workflowEnvs()
      const consulted = ['descriptor', 'workflow']
      let fSet = null
      if (forge.available) { const envs = forge.api(`repos/${forge.slug}/environments`); if (Array.isArray(envs?.environments)) { fSet = new Set(envs.environments.map(e => e.name)); consulted.push('forge') } }
      const forgeNote = fSet ? '' : ' (forge: not consulted)'
      const agree = fSet ? (setEq(dSet, wSet) && setEq(dSet, fSet)) : setEq(dSet, wSet)
      if (agree) return { ok: true, detail: `environments agree across ${consulted.join(' = ')}: {${[...dSet].join(', ')}}${forgeNote}` }
      const diff = new Set([...dSet, ...wSet, ...(fSet || [])])
      const rows = [...diff].map(n => `${n}[${dSet.has(n) ? 'd' : '-'}${wSet.has(n) ? 'w' : '-'}${fSet ? (fSet.has(n) ? 'f' : '-') : '?'}]`)
      return { ok: false, detail: `environment sets disagree: ${short(rows, 6)}${forgeNote}` }
    }

    if (k === 'env-deploy-path') { // ENV-02 (heuristic)
      if (!desc) return { ok: null, detail: 'no valid descriptor — no declared tiers' }
      const envs = (desc.environments || []).map(e => e.name)
      if (!envs.length) return { ok: null, detail: 'no environments declared — nothing to route a deploy to' }
      const files = match(gather(c).length ? gather(c) : ['.github/workflows/*.yml', '.github/workflows/*.yaml'])
      const refText = files.map(f => `${f}\n${readText(f) || ''}`).join('\n')
      // a tier is covered if a workflow names it via environment: or a per-tier filename
      const covered = n => new RegExp(`environment:\\s*['"]?${n}\\b`, 'm').test(refText) || files.some(f => f.toLowerCase().includes(n.toLowerCase()))
      const missing = envs.filter(n => !covered(n))
      if (missing.length === 0) return { ok: true, detail: `all ${envs.length} declared tier(s) have a deploy reference (heuristic)` }
      return { ok: false, detail: `no deploy path found for tier(s): ${missing.join(', ')} (heuristic line-scan; external deploys → deviation)` }
    }

    if (k === 'env-trigger') { // ENV-03 (heuristic)
      if (!desc) return { ok: null, detail: 'no valid descriptor' }
      const dev = (desc.environments || []).find(e => e.tier === 'dev')
      if (!dev) return { ok: null, detail: 'no dev-tier environment declared — on-merge deploy n/a' }
      const integ = integrationBranch()
      const files = match(gather(c).length ? gather(c) : ['.github/workflows/*.yml', '.github/workflows/*.yaml'])
      for (const f of files) {
        const t = readText(f); if (!t) continue
        const refsDev = new RegExp(`environment:\\s*['"]?${dev.name}\\b`, 'm').test(t) || f.toLowerCase().includes(dev.name.toLowerCase())
        if (!refsDev) continue
        const onPush = /on:[\s\S]*?push/m.test(t) && new RegExp(`branches?:[\\s\\S]{0,120}?${integ}\\b`, 'm').test(t)
        if (onPush) return { ok: true, detail: `dev-tier workflow ${f.split('/').pop()} deploys on push to '${integ}' (heuristic)` }
      }
      return { ok: false, detail: `no dev-tier deploy triggering on push to '${integ}' found (heuristic; set on: push: branches: [${integ}])` }
    }

    if (k === 'branch-model') { // BR-04
      const model = desc?.branching_model
      if (!model) return { ok: null, detail: 'no valid descriptor — branching_model undeclared' }
      let heads = lsRemoteHeads(); let plane = 'remote'
      if (heads == null) { heads = localHeads(); plane = 'local' }
      if (heads == null) return { ok: null, detail: 'no git refs readable — branch model not observable' }
      const set = new Set(heads.map(h => h.replace(/^origin\//, '')))
      const has = re => [...set].some(b => re.test(b))
      const label = plane === 'local' ? ' (forge unreachable → local refs, labeled)' : ''
      if (model === 'trunk') {
        const longlived = [...set].filter(b => /^(develop|staging)$/.test(b) || /^release\//.test(b))
        return longlived.length ? { ok: false, detail: `trunk declared but long-lived integration branch(es) present: ${short(longlived)}${label}` } : { ok: true, detail: `trunk: no long-lived secondary integration branches${label}` }
      }
      if (model === 'dev-staging-main') {
        const wantI = desc.branches?.integration || 'dev', wantS = desc.branches?.staging || 'staging'
        const miss = [!set.has(wantI) && wantI, !set.has(wantS) && wantS].filter(Boolean)
        return miss.length ? { ok: false, detail: `dev-staging-main declared but missing tier branch(es): ${miss.join(', ')}${label}` } : { ok: true, detail: `dev-staging-main: '${wantI}' + '${wantS}' present${label}` }
      }
      if (model === 'gitflow') {
        const miss = [!has(/^develop$/) && 'develop', !set.has(desc.default_branch) && desc.default_branch].filter(Boolean)
        return miss.length ? { ok: false, detail: `gitflow declared but missing: ${miss.join(', ')}${label}` } : { ok: true, detail: `gitflow: develop + ${desc.default_branch} present${label}` }
      }
      return { ok: null, detail: `unknown branching_model '${model}'` }
    }

    if (k === 'stale-branches') { // BR-05 (local git)
      if (!HEAD) return { ok: null, detail: 'no commit history (not a git repo / no commits)' }
      const heads = localHeads(); if (heads == null) return { ok: null, detail: 'local refs unreadable' }
      const dflt = desc?.default_branch || 'main'
      const tierBranches = new Set([dflt, integrationBranch(), desc?.branches?.staging || 'staging', 'develop'])
      const limit = daysOf(c)
      const stale = []
      for (const b of heads.map(h => h.replace(/^origin\//, ''))) {
        if (tierBranches.has(b)) continue
        const anc = isAncestor(b, dflt); if (anc === 0) continue // already merged
        const iso = commitISO(b); const age = iso ? ageDays(iso) : null
        if (age != null && age > limit) stale.push(`${b} (${Math.round(age)}d)`)
      }
      if (stale.length) return { ok: false, detail: `stale unmerged branch(es) > ${limit}d: ${short(stale)} — merge/rebase/delete or risk-accept (heuristic)` }
      return { ok: true, detail: `no unmerged branch tips older than ${limit}d` }
    }

    if (k === 'release-marks') { // BR-06 (tree ∨ history ∨ forge; young repos SKIP)
      const first = firstCommitISO(); const grace = daysOf(c)
      if (first != null) { const age = ageDays(first); if (age != null && age < grace) return { ok: null, detail: `repo younger than ${grace}d (${Math.round(age)}d) — no release-mark theater before the first release` } }
      const tl = tags(); if (tl && tl.length) return { ok: true, detail: `${tl.length} tag(s), e.g. ${short(tl.slice(0, 3), 3)}` }
      const wf = match(asArr(c.release_workflow_globs)); if (wf.length) return { ok: true, detail: `release workflow present: ${wf[0]}` }
      if (forge.available) { const rel = forge.api(`repos/${forge.slug}/releases?per_page=1`); if (Array.isArray(rel) && rel.length) return { ok: true, detail: `forge release present: ${rel[0].tag_name || rel[0].name}` } }
      const forgeNote = forge.available ? '' : ' (forge: not consulted)'
      return { ok: false, detail: `no tags, releases, or release workflow — no shared name for what's live${forgeNote}` }
    }

    if (k === 'workflow-job-order') { // CI-06 (heuristic line-scan)
      const files = match(['.github/workflows/*.yml', '.github/workflows/*.yaml'])
      if (!files.length) return { ok: null, detail: 'no workflow files' }
      const deployRe = /environment:|\bdeploy\b|terraform apply|kubectl apply|serverless deploy|pulumi up|cdk deploy|flyctl deploy|vercel|netlify deploy/i
      const buildRe = /npm (run )?test|pytest|go test|cargo test|make test|gradle (test|check)|mvn (test|verify)|\bbuild\b|\btest\b/i
      let sawDeploy = false
      for (const f of files) {
        const t = readText(f); if (!t) continue
        if (!deployRe.test(t)) continue
        sawDeploy = true
        // crude job split: 2-space-indented `<name>:` headers within the jobs: section
        // (m flag so `$` is line-end, not string-end — else the block never splits)
        const jIdx = t.search(/^jobs:/m)
        const body = jIdx >= 0 ? t.slice(jIdx) : t
        const jobs = body.split(/\n(?=  [A-Za-z0-9_-]+:\s*$)/m)
        const deployJobs = jobs.filter(j => deployRe.test(j))
        const buildJobNames = jobs.filter(j => buildRe.test(j) && !deployRe.test(j)).map(j => (j.match(/^\s*([A-Za-z0-9_-]+):/) || [])[1]).filter(Boolean)
        const ok = deployJobs.every(j => { const needs = (j.match(/needs:\s*(.+)/) || [])[1] || ''; return buildJobNames.some(n => needs.includes(n)) })
        if (deployJobs.length && ok && buildJobNames.length) return { ok: true, detail: `${f.split('/').pop()}: deploy job needs the build/test job(s) (heuristic)` }
      }
      if (!sawDeploy) return { ok: null, detail: 'no deploy job found in workflows — ordering n/a' }
      return { ok: false, detail: 'a deploy job does not declare needs: on a build/test job — a red build can ship (heuristic line-scan)' }
    }

    if (k === 'iac-state') { // IAC-02
      const tf = match(['**/*.tf'])
      if (tf.length) {
        const backend = tf.some(f => { const t = readText(f); return t && /backend\s+"(s3|azurerm|gcs|remote|cloud|consul)"/.test(t) })
        const trackedState = match(['**/*.tfstate', '**/*.tfstate.*'], { tracked: true })
        const gi = read('.gitignore') || ''
        const ignored = /(^|\n)\s*\*?\*?\.tfstate/.test(gi)
        const problems = [!backend && 'no remote backend block in *.tf', trackedState.length && `tracked state file(s): ${short(trackedState, 2)}`, !ignored && '.gitignore missing *.tfstate'].filter(Boolean)
        if (problems.length === 0) return { ok: true, detail: 'remote backend configured; no tracked state; *.tfstate git-ignored' }
        return { ok: false, detail: problems.join('; ') }
      }
      if (match(['**/Pulumi.yaml']).length) {
        const bk = match(['**/Pulumi.yaml']).some(f => /backend:/.test(readText(f) || ''))
        return bk ? { ok: true, detail: 'Pulumi backend declared' } : { ok: false, detail: 'Pulumi.yaml present but no backend: key — declare a state backend' }
      }
      if (match(['**/cdk.json']).length) return { ok: null, detail: 'CDK: state managed by the CDK toolkit — n/a' }
      return { ok: null, detail: 'no resolvable IaC state backend to check' }
    }

    if (k === 'iac-secrets') { // IAC-06 (deterministic; fails if ANY arm fires)
      const globs = asArr(c.globs)
      const sigRe = reOf(c.signature_pattern, 'm')
      const hits = []
      if (sigRe) for (const f of match(globs)) { const t = readRaw(f); if (t && sigRe.test(t)) hits.push(f) }
      const trackedTfvars = match(['**/*.tfvars', '**/*.tfvars.json'], { tracked: true })
      const tfvarsOnDisk = match(['**/*.tfvars', '**/*.tfvars.json'])
      const gi = read('.gitignore') || ''
      const tfvarsIgnored = /(^|\n)\s*\*?\*?\.tfvars/.test(gi)
      const fires = [
        hits.length && `secret signature in: ${short(hits, 2)}`,
        trackedTfvars.length && `tracked *.tfvars: ${short(trackedTfvars, 2)}`,
        (!tfvarsIgnored && tfvarsOnDisk.length) && '*.tfvars on disk but not git-ignored',
      ].filter(Boolean)
      if (fires.length) return { ok: false, detail: `${fires.join('; ')} — rotate/move secrets, git-ignore *.tfvars (false positive → deviation)` }
      return { ok: true, detail: 'no plaintext secret signatures; tfvars not tracked' }
    }

    if (k === 'flag-registry') { // FLAG-02 owner / FLAG-03 freshness
      const recs = loadFlags(repo)
      if (!recs.length) return { ok: false, detail: 'flag registry empty — the opt-in declares flags exist; add records/flags/FLAG-NNNN.json' }
      const invalid = recs.filter(r => !r.data || r.errors.length).map(r => `${r.file.split('/').pop()}: ${(r.errors || [])[0] || 'invalid'}`)
      if (invalid.length) return { ok: false, detail: `invalid flag record(s): ${short(invalid, 2)}` }
      if (c.assert === 'owner') {
        const noOwner = recs.filter(r => !nonEmpty(r.data.owner)).map(r => r.data.id)
        return noOwner.length ? { ok: false, detail: `flag(s) missing owner: ${short(noOwner)}` } : { ok: true, detail: `${recs.length} flag(s), all owned` }
      }
      if (c.assert === 'freshness') {
        const perm = new Set(asArr(c.permanent_types)); const permDays = cfg[c.permanent_days_from_config] ?? c.default_permanent_days
        const bad = []
        for (const r of recs) {
          const d = r.data
          if (!d.review_by) { bad.push(`${d.id}: no review_by`); continue }
          if (d.review_by < TODAY) { bad.push(`${d.id}: past due (${d.review_by})`); continue }
          if (perm.has(d.type)) { const created = parseDate(d.created), rev = parseDate(d.review_by); if (created && rev && (rev - created) / 86400000 > permDays) bad.push(`${d.id}: permanent-type review horizon > ${permDays}d`) }
        }
        return bad.length ? { ok: false, detail: `flag freshness: ${short(bad)}` } : { ok: true, detail: `${recs.length} flag(s), all carry an unexpired review_by` }
      }
      return { ok: null, detail: `unknown flag-registry assert '${c.assert}'` }
    }

    if (k === 'hotfix-backmerge') { // HOT-02 (history heuristic); null when no hotfix refs
      let heads = lsRemoteHeads(); let plane = 'remote'
      if (heads == null) { heads = localHeads(); plane = 'local' }
      if (heads == null) return { ok: null, detail: 'no git refs readable' }
      const hotfixes = heads.map(h => h.replace(/^origin\//, '')).filter(b => /^hotfix\//.test(b))
      if (!hotfixes.length) return { ok: null, detail: 'no hotfix/* branches in history — falls through to the sign-off arm' }
      const dev = integrationBranch()
      const unmerged = hotfixes.filter(b => isAncestor(b, dev) !== 0)
      const label = plane === 'local' ? ' (local refs)' : ''
      return unmerged.length ? { ok: false, detail: `hotfix branch(es) not back-merged into '${dev}': ${short(unmerged)}${label}` } : { ok: true, detail: `all ${hotfixes.length} hotfix branch(es) reach '${dev}'${label}` }
    }

    if (k === 'jdg-health') { // GOV-01 — runs jdg.mjs's full evaluator in-check (§5.2, §6.1)
      const loaded = loadJudgments(repo)
      // facts view: descriptor.* · planes.* · git.* · today. The forge is probed only if a
      // record's tripwire/expected_state names planes.forge (gatherJdgFacts decides).
      const facts = gatherJdgFacts(repo, { descriptor: DESCRIPTOR, today: TODAY, forge, records: loaded.filter(r => !r.errors.length).map(r => r.data) })
      return ledgerHealth(loaded, facts)
    }

    if (k === 'breakglass-ledger') { // HOT-04 (ledger; forge cross-ref best-effort)
      const recs = loadJudgments(repo).filter(r => r.data && r.data.kind === 'break-glass')
      const forgeNote = forge.available ? '' : ' · forge: not consulted (bypass cross-ref skipped)'
      if (!recs.length) return { ok: true, detail: `no break-glass events recorded — nothing to audit${forgeNote}` }
      const bad = []
      for (const r of recs) {
        const d = r.data
        if (r.errors.length) { bad.push(`${d.id || r.file.split('/').pop()}: schema-invalid`); continue }
        if (!nonEmpty(d.gate)) bad.push(`${d.id}: no gate named`)
        if (!nonEmpty(d.by)) bad.push(`${d.id}: no owner (by)`)
        if (d.review_by < TODAY) bad.push(`${d.id}: expired ${d.review_by}`)
      }
      return bad.length ? { ok: false, detail: `break-glass record(s) unhealthy: ${short(bad)}${forgeNote}` } : { ok: true, detail: `${recs.length} break-glass record(s): gated, owned, unexpired${forgeNote}` }
    }

    if (k === 'profile-consistency') { // DESC-03 (tree + forge; heuristic inverse-nag)
      if (!desc) return { ok: null, detail: 'no valid descriptor — no declared tier to compare' }
      const declared = desc.profile
      const rank = { solo: 0, team: 1, critical: 2 }
      // observed signals
      let forgeEnvCount = null, prodGated = null
      if (forge.available) {
        const envs = forge.api(`repos/${forge.slug}/environments`)
        if (Array.isArray(envs?.environments)) {
          forgeEnvCount = envs.environments.length
          const prod = envs.environments.find(e => /prod/i.test(e.name))
          if (prod) { const pe = forge.api(`repos/${forge.slug}/environments/${encodeURIComponent(prod.name)}`); prodGated = !!(pe && (pe.protection_rules || []).length) }
        }
      }
      const stagingWf = workflowEnvs().size > 0 || match(['.github/workflows/*stag*', '.github/workflows/*staging*']).length > 0
      const iac = hasIaC()
      let observed = 'solo'
      if (prodGated === true || (forgeEnvCount != null && forgeEnvCount >= 2)) observed = 'critical'
      else if (stagingWf || iac) observed = 'team'
      const forgeNote = forge.available ? '' : ' (forge: not consulted → tree-only comparison, labeled)'
      // fire: observed complexity exceeds declared tier, OR declared critical with no prod gate found
      if (rank[observed] > rank[declared]) return { ok: false, detail: `observed '${observed}'-level artifacts under declared '${declared}' — right-size the descriptor or record a deviation${forgeNote}` }
      if (declared === 'critical' && prodGated === false) return { ok: false, detail: `declared 'critical' but no prod-gating artifact found — carry the posture or step down the tier${forgeNote}` }
      if (declared === 'critical' && prodGated == null && !iac) return { ok: false, detail: `declared 'critical' but no gating/IaC posture observed${forgeNote}` }
      return { ok: true, detail: `declared '${declared}' consistent with observed '${observed}'-level artifacts${forgeNote}` }
    }

    return { ok: null, detail: `no evaluator for kind '${k}'` }
  }

  // lazy signoff selection (parse ledger once; newest valid sign-off per subject — jdg.mjs)
  let _signoffs = null
  const signoffs = () => (_signoffs ??= selectSignoffs(loadJudgments(repo)))

  return evalCheck
}
