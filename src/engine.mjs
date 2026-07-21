// The gate → evaluate → tag pipeline (ARCHITECTURE §4.3). Gates short-circuit a rule to
// SKIP (wrong type, off tier, FLAG opt-in inactive) before its check runs; a rule outside
// the run's context is EXCLUDED (no row) rather than wallpapered as a SKIP. Effective
// severity is resolved at tag time from `severity_by_profile[declaredTier] ?? severity`
// (the one engine delta, §4.2.5 / §7.1). An erroring check degrades to SKIP, never a crash.
import fs from 'node:fs'

// Load rules.json + rules/*.json from THIS module's directory (invoke by absolute path;
// the checker loads its rule set from its own tree, never the target repo's — §10).
export function loadRules() {
  const manifest = JSON.parse(fs.readFileSync(new URL('../rules.json', import.meta.url), 'utf8'))
  const rules = []
  for (const mod of manifest.modules) {
    const m = JSON.parse(fs.readFileSync(new URL('../' + mod, import.meta.url), 'utf8'))
    for (const r of m.rules) rules.push(r)
  }
  return { ...manifest, rules }
}

// Effective severity after any per-tier escalation. Pure map lookup (§4.2.5): v1 users are
// BR-03 and ENV-04 (warn at team → blocker at critical).
export function effectiveSeverity(rule, declaredTier) {
  return (rule.severity_by_profile && rule.severity_by_profile[declaredTier]) || rule.severity
}

// evalCheck is injected (chunk #4 provides it via evaluators.mjs). It returns
// { ok: true|false|null, detail: string, signoff?: bool }. Keeping it a parameter is the
// clean chunk seam: the engine owns the funnel, the evaluators own the checks.
export function runRules({ rules, cfg, ACTIVE, FLAGS_ACTIVE = false, FLAGS_REASON = null, declaredTier = 'solo', evalCheck, context = 'check' }) {
  const results = []
  for (const r of rules) {
    // context gate: a rule outside the run's context is excluded (no row), never a SKIP —
    // a "wrong context" row on every run is the wallpaper the other gates exist to kill.
    if (!Array.isArray(r.contexts) || !r.contexts.includes(context)) continue

    if (r.applies_to && r.applies_to !== 'all' && !r.applies_to.includes(cfg.type)) {
      results.push({ r, tag: 'SKIP', detail: `n/a for ${cfg.type}`, severity: effectiveSeverity(r, declaredTier) }); continue
    }
    if (r.profile && !ACTIVE.has(r.profile)) {
      results.push({ r, tag: 'SKIP', detail: `profile '${r.profile}' off (declared ${declaredTier})`, severity: effectiveSeverity(r, declaredTier) }); continue
    }
    if (r.requires === 'uses_feature_flags' && !FLAGS_ACTIVE) {
      results.push({ r, tag: 'SKIP', detail: FLAGS_REASON || 'FLAG opt-in inactive', severity: effectiveSeverity(r, declaredTier) }); continue
    }

    // crash-resilient evaluation: a broken check degrades to SKIP (§1 constraint 4).
    let res
    try { res = evalCheck(r.check, r) } catch (e) { res = { ok: null, detail: 'check errored: ' + String(e && e.message).slice(0, 80) } }
    if (!res || typeof res !== 'object') res = { ok: null, detail: 'evaluator returned nothing' }

    const sev = effectiveSeverity(r, declaredTier)
    let tag
    if (res.ok === null || res.ok === undefined) tag = 'SKIP'
    else if (res.ok === true) tag = 'PASS'
    else if (res.signoff || (r.check && r.check.kind === 'signoff')) tag = 'SIGN-OFF' // manual rule awaiting a dated sign-off
    else tag = sev === 'blocker' ? 'FAIL' : 'WARN'

    results.push({ r, tag, detail: res.detail, severity: sev })
  }
  return results
}

// Exit code from a result set: only a blocker FAIL sets 1 (§4.1 / §10).
export const isBlocking = x => x.severity === 'blocker' && x.tag === 'FAIL'
export const exitCodeOf = results => results.some(isBlocking) ? 1 : 0
