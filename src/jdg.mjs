// The judgment ledger — records/judgments/JDG-NNNN.json, one owned file per judgment
// (ARCHITECTURE §6). Two commands over one pure core:
//
//   pipeline jdg new     author a judgment (schema-valid, numbered, never rubber-stamped)
//   pipeline jdg check   evaluate every judgment's machine contract against facts
//
// The machine contract (§6.1): expected_state is the world the judgment assumed
// (a mismatch → DRIFTED, re-look), tripwire is the condition that VOIDS it (fired →
// TRIPPED, act), review_by is the expiry (every judgment lapses — a ledger must not
// fossilize; that is GOV-01's whole reason to be a blocker). evaluateJudgment is PURE
// and returns structured findings so the in-check GOV-01 evaluator and the standalone
// CLI render the same verdict from the same core. One clock: facts.today governs
// everything (expiry included) so a --today / --facts overlay time-travels the whole
// contract consistently. An unresolvable fact path is a FINDING, never a guess.
// Verdict lattice, worst wins: tripped > expired > unresolvable > drifted > ok.
//
// This module is the LOWER layer: evaluators.mjs imports its loaders + evaluator (issue
// #5 factored loadJudgments/loadFlags/signoff-selection out of evaluators into here).
// It therefore must never import evaluators.mjs — the forge probe the CLI needs for
// planes.forge facts is a small self-contained gh spawn below, not evaluators.makeForge.
// Delta vs baseline (§7.5): `gate` is free-form (no admit|reconcile enum), and `jdg new`
// COMPUTES date-valued tripwire comparands to literals at authoring time (§6.1).
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { getPath, parseDate, indexRepo } from './repo.mjs'
import { validateRecord } from './validate.mjs'
import { loadDescriptor } from './config.mjs'

export const JUDGMENTS_DIR = 'records/judgments'
export const FLAGS_DIR = 'records/flags'
const KINDS = ['sign-off', 'deviation', 'risk-acceptance', 'break-glass']
// verdict lattice (worst wins). 'advice' is a finding, never a verdict — it never fails.
const ORDER = { ok: 0, drifted: 1, unresolvable: 2, expired: 3, tripped: 4 }

// ---- small helpers (pipeline has no util.mjs; getPath/parseDate come from repo.mjs) ----
export function deepEq(a, b) {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a), kb = Object.keys(b)
  return ka.length === kb.length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && deepEq(a[k], b[k]))
}
const short = (arr, n = 4) => arr.slice(0, n).join(', ') + (arr.length > n ? ` (+${arr.length - n})` : '')
// date arithmetic for authoring-time comparand resolution (UTC; §6.1). Not a workflow
// script — plain Node, so new Date via parseDate is fine.
function addDays(iso, n) { const d = parseDate(iso); if (!d) return null; d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
// `<YYYY-MM-DD>±Nd` | `today±Nd` | `today` → a literal ISO date; null if not a date expr.
export function resolveDateExpr(raw, today) {
  if (typeof raw !== 'string') return null
  let m = /^(\d{4}-\d{2}-\d{2})\s*([+-]\s*\d+)\s*d$/.exec(raw.trim())
  if (m) return addDays(m[1], parseInt(m[2].replace(/\s+/g, ''), 10))
  m = /^today\s*([+-]\s*\d+)\s*d$/.exec(raw.trim())
  if (m) return addDays(today, parseInt(m[1].replace(/\s+/g, ''), 10))
  if (raw.trim() === 'today') return today
  return null
}
const deepMerge = (into, from) => { for (const k of Object.keys(from)) { const v = from[k]; if (v && typeof v === 'object' && !Array.isArray(v) && into[k] && typeof into[k] === 'object') deepMerge(into[k], v); else into[k] = v } return into }

// ---- loaders (the one canonical ledger reader; evaluators.mjs consumes these) ----
// Rich per-file load: { file, name, data, errors } — errors is [] for a clean record,
// else the integrity problems (unreadable | not-JSON | schema-invalid | id≠filename).
// A malformed record is DATA the caller sees, not an exception: crash-resilient (§1.4).
function loadRecords(repo, glob, kind) {
  return repo.match(glob).sort().map(file => {
    const name = file.split('/').pop()
    const raw = repo.read(file)
    if (raw == null) return { file, name, data: null, errors: ['unreadable'] }
    let data
    try { data = JSON.parse(raw) } catch { return { file, name, data: null, errors: ['not valid JSON'] } }
    const errors = validateRecord(kind, data)
    if (!errors.length && data.id !== name.replace(/\.json$/, '')) errors.push(`id '${data.id}' does not match filename`)
    return { file, name, data, errors }
  })
}
export const loadJudgments = repo => loadRecords(repo, `${JUDGMENTS_DIR}/*.json`, 'judgment')
export const loadFlags = repo => loadRecords(repo, `${FLAGS_DIR}/*.json`, 'flag')

// The sign-off selection rule, one home: schema-VALID sign-offs only (a malformed
// review_by must never read as signed-forever), newest per subject — date desc, id desc
// on ties. The newest governs even if lapsed: a re-judgment supersedes; an older
// unexpired record does not resurrect. -> { [subject]: record }.
export function selectSignoffs(loaded) {
  const by = {}
  for (const r of loaded) {
    if (r.errors.length || !r.data || r.data.kind !== 'sign-off') continue
    const j = r.data, prev = by[j.subject]
    if (!prev || j.date > prev.date || (j.date === prev.date && j.id > prev.id)) by[j.subject] = j
  }
  return by
}

// ---- pure evaluation ----
// One condition — { fact, op, value } -> { fired: true|false|null, note }. null = the
// fact path did not resolve (surfaced, never guessed). Ops only ever compare a fact
// against a LITERAL (date comparands were resolved at authoring time).
export function evalCondition(cond, facts) {
  const got = getPath(facts, cond.fact)
  if (cond.op === 'exists') return { fired: got !== undefined, note: `${cond.fact} ${got !== undefined ? 'exists' : 'is absent'}` }
  if (cond.op === 'absent') return { fired: got === undefined, note: `${cond.fact} ${got === undefined ? 'is absent' : 'exists'}` }
  if (got === undefined) return { fired: null, note: `${cond.fact}: unresolvable fact path` }
  if (cond.op === 'eq') return { fired: deepEq(got, cond.value), note: `${cond.fact} = ${JSON.stringify(got)}` }
  if (cond.op === 'ne') return { fired: !deepEq(got, cond.value), note: `${cond.fact} = ${JSON.stringify(got)} (expected ne ${JSON.stringify(cond.value)})` }
  if (cond.op === 'gt' || cond.op === 'lt') {
    const cmp = (typeof got === 'number' && typeof cond.value === 'number') || (typeof got === 'string' && typeof cond.value === 'string')
    if (!cmp) return { fired: null, note: `${cond.fact}: ${cond.op} needs two numbers or two strings (got ${typeof got} vs ${typeof cond.value})` }
    return { fired: cond.op === 'gt' ? got > cond.value : got < cond.value, note: `${cond.fact} = ${JSON.stringify(got)}` }
  }
  return { fired: null, note: `unknown op '${cond.op}'` }
}

// Pure: one judgment against one facts view. facts.today is THE clock (expiry included).
// Findings carry machine identity: { code: expired|drifted|tripped|unresolvable|advice, text }.
export function evaluateJudgment(j, facts) {
  let verdict = 'ok'
  const findings = []
  const bump = (code, text) => { findings.push({ code, text }); if (ORDER[code] > ORDER[verdict]) verdict = code }
  const today = facts.today
  if (!today) bump('unresolvable', 'facts.today missing — expiry not evaluable')
  else if (j.review_by < today) bump('expired', `review_by ${j.review_by} has passed — re-judge or retire`)
  for (const [k, want] of Object.entries(j.expected_state || {})) {
    const got = getPath(facts, k)
    if (got === undefined) bump('unresolvable', `expected_state ${k}: unresolvable fact path`)
    else if (!deepEq(got, want)) bump('drifted', `expected_state ${k}: assumed ${JSON.stringify(want)}, now ${JSON.stringify(got)}`)
  }
  if (j.tripwire) {
    const { fired, note } = evalCondition(j.tripwire, facts)
    if (fired === null) bump('unresolvable', `tripwire: ${note}`)
    else if (fired) bump('tripped', `tripwire fired: ${note} — the accepted world changed`)
  } else if (j.kind !== 'sign-off') {
    findings.push({ code: 'advice', text: 'no tripwire — nothing can void this automatically before review_by (add one)' })
  }
  if (j.kind === 'break-glass' && !j.gate) findings.push({ code: 'advice', text: 'break-glass without a gate scope' })
  return { id: j.id, kind: j.kind, subject: j.subject, verdict, findings }
}

// The facts view judgments reference (§6.1): descriptor.* · planes.{tree,history,forge} ·
// git.{branch,head} · today. The forge probe spawns gh (network) — pay for it only when
// some record's tripwire/expected_state actually names planes.forge (baseline's pattern).
// An optional overlay deep-merges last (fixtures / --facts time-travel).
export function gatherJdgFacts(repo, { descriptor = null, today, forge = null, records = [], overlay = null } = {}) {
  const d = descriptor || loadDescriptor(repo)
  const facts = {
    today,
    descriptor: { ...(d && d.valid ? d.data : {}), present: !!(d && d.present), valid: !!(d && d.valid) },
    planes: {
      tree: { available: true },
      history: repo.HEAD ? { available: true, head: repo.HEAD, branch: repo.BRANCH } : { available: false, reason: 'not a git repository (no HEAD)' },
      forge: { available: null, reason: 'not probed (no judgment references planes.forge)' },
    },
    git: { branch: repo.BRANCH, head: repo.HEAD },
  }
  const needsForge = forge && records.some(j => JSON.stringify([j.tripwire ?? null, j.expected_state ?? null]).includes('planes.forge'))
  if (needsForge) facts.planes.forge = forge.available ? { available: true, slug: forge.slug } : { available: false, reason: forge.reason }
  if (overlay) deepMerge(facts, overlay)
  return facts
}

// GOV-01 core (in-check): given loaded judgments + facts -> { ok, detail }. Invalid /
// expired / tripped are the hard problems that FAIL a blocker; drifted / unresolvable
// surface in the detail as a note but never fail (never guessed). Empty ledger PASSES —
// nothing to keep healthy. Shared with `jdg check` so both agree on "healthy".
export function ledgerHealth(loaded, facts) {
  if (!loaded.length) return { ok: true, detail: 'ledger empty — no judgments to keep healthy' }
  const invalid = loaded.filter(r => r.errors.length).map(r => `${r.name}: ${r.errors[0]}`)
  const evals = loaded.filter(r => !r.errors.length).map(r => evaluateJudgment(r.data, facts))
  const expired = evals.filter(e => e.verdict === 'expired').map(e => `${e.id} expired`)
  const tripped = evals.filter(e => e.verdict === 'tripped').map(e => `${e.id} tripped`)
  const soft = evals.filter(e => e.verdict === 'drifted' || e.verdict === 'unresolvable').map(e => `${e.id} ${e.verdict}`)
  const hard = [...invalid, ...expired, ...tripped]
  if (hard.length) return { ok: false, detail: `ledger unhealthy: ${short(hard)} — re-make or retire (pipeline jdg check)` }
  const note = soft.length ? ` · note: ${short(soft)} (surfaced, not failed)` : ''
  return { ok: true, detail: `${loaded.length} judgment(s): schema-valid, unexpired, no tripwire fired${note}` }
}

// ---- CLI ----
// Minimal, self-contained lazy gh probe for planes.forge facts (the CLI has no evaluators
// forge to borrow; keeps the layering acyclic). One spawn establishes reachability.
function cliForge(REPO) {
  let probed = false, avail = false, reason = 'gh not consulted', slug = null
  const run = a => { try { return execFileSync('gh', a, { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 8 * 1024 * 1024 }).toString('utf8') } catch { return null } }
  const probe = () => { if (probed) return; probed = true; const o = run(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']); if (o && o.trim()) { avail = true; slug = o.trim() } else reason = 'gh unavailable, unauthenticated, or no GitHub remote' }
  return { get available() { probe(); return avail }, get reason() { probe(); return reason }, get slug() { probe(); return slug } }
}

// value-flag parser. A value flag followed by another flag (or nothing) yields `true` —
// the caller checks for `=== true` and errors, so String(true) never becomes a path,
// author name, or silent no-op (baseline's guard). --expect is repeatable.
function makeOpt(argv) {
  const map = {}, expect = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a[0] !== '-') continue
    const next = argv[i + 1]
    const val = (next === undefined || (next[0] === '-' && next !== '-')) ? true : next
    if (a === '--expect') { expect.push(val); if (val !== true) i++; continue }
    if (a === '--json' || a === '--help' || a === '-h') { map[a] = true; continue }
    map[a] = val
    if (val !== true) i++
  }
  map.__expect = expect
  return map
}

const JDG_USAGE = `usage: pipeline jdg new --kind K --subject S --reason "..." --review-by YYYY-MM-DD
              [--by W] [--date YYYY-MM-DD] [--gate "scope"] [--expect path=json ...]
              [--tripwire "fact op value"]   (value may be a date expr: "YYYY-MM-DD+90d" | "today+90d")
       pipeline jdg check [--repo DIR] [--json] [--today YYYY-MM-DD] [--facts FILE]`

export function runJdg(argv, { cwd = process.cwd() } = {}) {
  if (argv[0] === '--help' || argv[0] === '-h') { console.log(`pipeline jdg — author / evaluate the judgment ledger\n  ${JDG_USAGE}`); return 0 }
  const sub = argv[0] && argv[0][0] !== '-' ? argv[0] : null
  const rest = sub ? argv.slice(1) : argv
  const opt = makeOpt(rest)
  const usage = msg => { console.error(`pipeline jdg: ${msg}\n  ${JDG_USAGE}`); return 2 }
  for (const f of ['--repo', '--by', '--date', '--gate', '--kind', '--subject', '--reason', '--review-by', '--facts', '--today', '--tripwire'])
    if (opt[f] === true) return usage(`${f} needs a value`)

  const REPO = path.resolve(String(opt['--repo'] ?? cwd))
  const JSON_OUT = !!opt['--json']
  // one clock: --today (deterministic tests / time-travel), else real today.
  const todayArg = opt['--today']
  const today = (typeof todayArg === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(todayArg)) ? todayArg : new Date().toISOString().slice(0, 10)
  if (typeof todayArg === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(todayArg)) return usage('--today must be YYYY-MM-DD')

  const repo = indexRepo(REPO)

  if (sub === 'check') {
    let overlay = null
    const factsFile = opt['--facts']
    if (typeof factsFile === 'string') { try { overlay = JSON.parse(fs.readFileSync(path.resolve(factsFile), 'utf8')) } catch (e) { return usage(`cannot read --facts file: ${e.message}`) } }
    const loaded = loadJudgments(repo)
    const facts = gatherJdgFacts(repo, { today, forge: cliForge(REPO), records: loaded.filter(r => !r.errors.length).map(r => r.data), overlay })
    const results = loaded.filter(r => !r.errors.length).map(r => evaluateJudgment(r.data, facts))
    const findings = loaded.filter(r => r.errors.length).map(r => ({ file: r.file, error: r.errors[0] }))
    const bad = results.filter(r => r.verdict === 'tripped' || r.verdict === 'expired')
    const exit = (bad.length || findings.length) ? 1 : 0
    if (JSON_OUT) { console.log(JSON.stringify({ repo: REPO, today, results, findings, exit }, null, 2)); return exit }
    const ICON = { ok: '✓', drifted: '≈', unresolvable: '?', expired: '⏰', tripped: '✗' }
    console.log(`\n  Judgments — ${path.basename(REPO)} · ${results.length} record(s)${findings.length ? ` · ${findings.length} INVALID` : ''}  (as of ${today})\n`)
    if (!results.length && !findings.length) { console.log(`  _no judgments recorded (${JUDGMENTS_DIR}/ empty or absent)_\n`); return 0 }
    for (const r of results) {
      console.log(`    ${ICON[r.verdict]} ${r.id}  ${r.kind.padEnd(15)} ${String(r.subject).slice(0, 40).padEnd(40)} ${r.verdict.toUpperCase()}`)
      for (const f of r.findings) console.log(`        ↳ ${f.text}`)
    }
    for (const f of findings) console.log(`    ! ${f.file}  INVALID — ${f.error}`)
    console.log(exit ? `\n  ✗ ledger unhealthy: ${bad.length} voided/expired, ${findings.length} invalid.\n` : `\n  ✓ ledger healthy.\n`)
    return exit
  }

  if (sub === 'new') {
    const kind = opt['--kind']
    if (!KINDS.includes(kind)) return usage(`--kind must be one of ${KINDS.join('|')}`)
    const subject = opt['--subject'], reason = opt['--reason'], review_by = opt['--review-by']
    if (typeof subject !== 'string' || !subject.trim()) return usage('--subject is required (a rule id, a file, or a scope)')
    if (typeof reason !== 'string' || !reason.trim()) return usage('--reason is required — a judgment without a why is a rubber stamp')
    if (typeof review_by !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(review_by)) return usage('--review-by YYYY-MM-DD is required — every judgment expires (pick a real re-look date)')
    const gate = opt['--gate']
    // §7.5: gate is free-form (no admit|reconcile enum) but a break-glass must name what it bypassed.
    if (kind === 'break-glass' && (typeof gate !== 'string' || !gate.trim())) return usage('break-glass requires --gate "scope" (the bypassed mechanism, e.g. ruleset:main, environment:production)')
    const by = String(opt['--by'] || (repo.git(['config', 'user.name']) || '')).trim()
    if (!by) return usage('--by is required (git user.name unset) — a judgment is owned or it is not a judgment')
    const dateArg = opt['--date']
    if (typeof dateArg === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) return usage('--date must be YYYY-MM-DD')

    const expected_state = {}
    for (const kv of opt.__expect) {
      if (kv === true) return usage('--expect needs path=value')
      const i = kv.indexOf('='); if (i < 1) return usage(`--expect wants path=value (got '${kv}')`)
      const k = kv.slice(0, i), raw = kv.slice(i + 1)
      try { expected_state[k] = JSON.parse(raw) } catch { expected_state[k] = raw }
    }
    let tripwire
    const tw = opt['--tripwire']
    if (typeof tw === 'string') {
      const m = tw.trim().match(/^(\S+)\s+(\S+)(?:\s+([\s\S]+))?$/)
      if (!m) return usage(`--tripwire wants "fact op [value]" (got '${tw}')`)
      const [, fact, op, rawVal] = m
      if (op === 'exists' || op === 'absent') { if (rawVal !== undefined) return usage(`tripwire op '${op}' takes no value`); tripwire = { fact, op } }
      else {
        if (rawVal === undefined) return usage(`tripwire op '${op}' needs a value`)
        // §6.1 delta: resolve a date-valued comparand to a literal AT AUTHORING TIME, so
        // the evaluator only ever compares a fact against a literal (baseline's op contract).
        const asDate = resolveDateExpr(rawVal, today)
        let value
        if (asDate) value = asDate
        else { try { value = JSON.parse(rawVal) } catch { value = rawVal } }
        tripwire = { fact, op, value }
      }
    } else if (kind !== 'sign-off') {
      console.error(`  note: no --tripwire — nothing can void this ${kind} automatically before its review_by`)
    }

    const record = { record: 'judgment/1', id: 'JDG-0000', kind, date: typeof dateArg === 'string' ? dateArg : today, by, subject: subject.trim(), reason: reason.trim(), review_by }
    if (Object.keys(expected_state).length) record.expected_state = expected_state
    if (tripwire) record.tripwire = tripwire
    if (kind === 'break-glass') record.gate = gate.trim()

    // number LAST, then validate the finished record.
    const dirAbs = path.join(REPO, JUDGMENTS_DIR)
    let names = []
    try { names = fs.readdirSync(dirAbs) } catch {}
    const max = names.reduce((m, f) => { const x = f.match(/^JDG-(\d{4})\.json$/); return x ? Math.max(m, parseInt(x[1], 10)) : m }, 0)
    record.id = `JDG-${String(max + 1).padStart(4, '0')}`
    const errors = validateRecord('judgment', record)
    if (errors.length) return usage(`record invalid: ${errors.join('; ')}`)

    const rel = `${JUDGMENTS_DIR}/${record.id}.json`
    const abs = path.join(REPO, rel)
    const content = JSON.stringify(record, null, 2) + '\n'
    try { fs.mkdirSync(dirAbs, { recursive: true }) }
    catch (e) { return usage(e.code === 'EEXIST' || e.code === 'ENOTDIR' ? `cannot create ${JUDGMENTS_DIR}/ — a file exists where the directory belongs` : e.message) }
    // wx: never overwrite — the ledger is append-only; a collision means take the next number.
    try { fs.writeFileSync(abs, content, { flag: 'wx' }) }
    catch (e) { return usage(e.code === 'EEXIST' ? `${rel} already exists (parallel write?) — rerun to take the next number` : e.message) }
    if (JSON_OUT) { console.log(JSON.stringify({ written: rel, record }, null, 2)); return 0 }
    console.log(`  ✓ recorded ${rel}  (${record.kind} · ${record.subject} · review by ${record.review_by})`)
    if (tripwire) console.log(`    tripwire: ${tripwire.fact} ${tripwire.op}${'value' in tripwire ? ' ' + JSON.stringify(tripwire.value) : ''}`)
    return 0
  }

  return usage(`unknown subcommand '${sub ?? ''}' (try: new, check)`)
}

// ESM main-module guard (no require.main in ESM) — lets `node src/jdg.mjs new|check ...`
// run before chunk #6 wires `pipeline jdg` into the unified CLI (mirrors validate.mjs).
const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href
if (isMain) process.exit(runJdg(process.argv.slice(2)))
