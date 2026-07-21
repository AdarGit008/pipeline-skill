// Config resolution + descriptor + profile-tier activation (ARCHITECTURE §4.2, §7.3, §8).
// Order: DEFAULTS → auto-detected type → <repo>/pipeline.config.json → --config file,
// then the pipeline.repo.json descriptor's declared `type`/`profile` supersede detection
// (the repo's claim about itself is root intent, not a guess). Missing/invalid descriptor
// → solo (core only) and DESC-01 tells the user why team/critical rules skipped.
import fs from 'node:fs'
import path from 'node:path'
import { validateDescriptor } from './validate.mjs'

export const DESCRIPTOR_FILE = 'pipeline.repo.json'
export const CONFIG_FILE = 'pipeline.config.json'
export const FLAG_RECORD_GLOB = 'records/flags/*.json'

// ---- config keys the engine honors (ARCHITECTURE §8) ----
export function buildDefaults(repo) {
  return {
    type: detectType(repo),
    uses_feature_flags: false,
    stale_branch_days: 30,
    release_mark_grace_days: 90,
    rollback_drill_days: 90,
    permanent_flag_review_days: 365,
    prod_environment_name: 'production',
    deploy_globs: [],
    iac_globs: [],
    required_check_names: [],
    source_globs: [],
  }
}

// Auto-detect the deployment-shaped project type (ARCHITECTURE §7.3). Coarse by design —
// a real repo declares `type` in the descriptor, which supersedes this. IaC markers ⇒ infra
// (unless a code manifest is also present ⇒ service/app); package.json/framework ⇒ app;
// a publishable-manifest-only repo ⇒ library; else docs.
export function detectType(repo) {
  const F = repo.FILES
  const has = g => repo.match(g).length > 0
  const iac = has(['**/*.tf', '**/Pulumi.yaml', '**/cdk.json', '**/serverless.yml', '**/*.bicep', '**/*.template'])
  const node = F.includes('package.json')
  const go = F.includes('go.mod')
  const py = F.includes('pyproject.toml') || F.some(f => /(^|\/)requirements.*\.txt$/.test(f))
  const rust = F.includes('Cargo.toml')
  const code = node || go || py || rust
  if (iac && !code) return 'infra'
  if (go) return 'service'
  if (node) {
    let pkg = {}
    try { pkg = JSON.parse(repo.read('package.json') || '{}') } catch {}
    const appish = pkg.private === true || !!(pkg.scripts && (pkg.scripts.start || pkg.scripts.dev || pkg.scripts.serve))
    const libish = !!(pkg.name && pkg.version && (pkg.main || pkg.module || pkg.exports || pkg.bin)) && pkg.private !== true
    if (appish) return 'app'
    if (libish) return 'library'
    return 'app'
  }
  if (py || rust) return code && !iac ? 'app' : 'app'
  return 'docs'
}

// -> { present, valid, data, errors }. `data` is parsed even when invalid (diagnostics);
// consumers gate on `valid` before trusting a field.
export function loadDescriptor(repo) {
  const raw = repo.read(DESCRIPTOR_FILE)
  if (raw == null) return { present: false, valid: false, data: null, errors: [] }
  let data
  try { data = JSON.parse(raw) } catch { return { present: true, valid: false, data: null, errors: ['not valid JSON'] } }
  const errors = validateDescriptor(data)
  return { present: true, valid: errors.length === 0, data, errors }
}

// Cumulative tier → active profile set (ARCHITECTURE §4.2): core always; +team when
// declared tier ∈ {team, critical}; +critical when tier = critical. solo = core only.
export function activeProfiles(tier) {
  const A = new Set(['core'])
  if (tier === 'team' || tier === 'critical') A.add('team')
  if (tier === 'critical') A.add('critical')
  return A
}

export function resolveConfig(repo, { cliConfigPath = null } = {}) {
  const DEFAULTS = buildDefaults(repo)
  let cfg = { ...DEFAULTS }
  const EXPLICIT = new Set()
  const applyCfg = obj => { for (const k of Object.keys(obj)) if (!k.startsWith('_')) EXPLICIT.add(k); cfg = { ...cfg, ...obj } }
  const inRepo = repo.read(CONFIG_FILE); if (inRepo) try { applyCfg(JSON.parse(inRepo)) } catch {}
  if (cliConfigPath && typeof cliConfigPath === 'string') {
    try { applyCfg(JSON.parse(fs.readFileSync(path.resolve(cliConfigPath), 'utf8'))) } catch (e) { console.error('bad --config:', e.message) }
  }

  // Descriptor supersedes detection (ARCHITECTURE §4.2.1 / §7.3).
  const DESCRIPTOR = loadDescriptor(repo)
  if (DESCRIPTOR.valid && DESCRIPTOR.data.type) cfg.type = DESCRIPTOR.data.type

  // Declared failure-cost tier drives activation; invalid/absent descriptor → solo.
  const declaredTier = (DESCRIPTOR.valid && DESCRIPTOR.data.profile) || 'solo'
  const ACTIVE = activeProfiles(declaredTier)

  // FLAG family opt-in (ARCHITECTURE §4.2.4): descriptor uses_feature_flags:true, OR config
  // uses_feature_flags:true, OR a non-empty records/flags/ directory.
  const flagRecords = repo.match(FLAG_RECORD_GLOB)
  const declaredFlags = (DESCRIPTOR.valid && DESCRIPTOR.data.uses_feature_flags === true) || cfg.uses_feature_flags === true
  const FLAGS_ACTIVE = declaredFlags || flagRecords.length > 0
  const FLAGS_REASON = FLAGS_ACTIVE ? null : 'flag family opt-in (set uses_feature_flags:true or add records/flags/) '

  return { cfg, DEFAULTS, EXPLICIT, DESCRIPTOR, declaredTier, ACTIVE, FLAGS_ACTIVE, FLAGS_REASON }
}
