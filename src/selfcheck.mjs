// --self-check: validate the rule set's structural integrity (ARCHITECTURE §3) and print
// the per-type coverage matrix. Returns the process exit code (1 on any malformed rule) so
// a bad rule set can't merge (§9: the skill's own CI runs this). The runner (check.mjs)
// invokes it; it reads only the rule set + CHECK_KINDS + config-key set — never a target repo.
//
// The two engine laws it enforces (§3), plus the pipeline delta:
//   · a blocker must be `deterministic` — INCLUDING any severity_by_profile escalation to
//     blocker (the §7.1 map may only escalate to blocker when certainty is deterministic);
//   · a `manual` (sign-off) rule must be `judgment`, and the inverse — a judgment rule must
//     route to a sign-off (severity `manual`).
// Plus baseline's structural checks: unknown kind/profile/severity/category/applies_to/
// requires, duplicate ids, orphan types/profiles, and each rule's plane/context/certainty
// metadata. The FLAG family is uniformly opt-in (pipeline's analog of baseline's CLAIM gate).
import { CATS } from './report.mjs'

export function runSelfCheck({ RULES, TYPES, CHECK_KINDS, DEFAULTS, color }) {
  const problems = []
  const typeSet = new Set(TYPES)
  const profileKeys = new Set(Object.keys(RULES.profiles || {}))   // core · team · critical
  const tierSet = new Set(['solo', 'team', 'critical'])            // declared-tier keys severity_by_profile is keyed by
  const sevOk = new Set(['blocker', 'warn', 'manual'])
  const catKeys = new Set(Object.keys(CATS))                       // the nine families (report.mjs)
  const SRC = new Set(['tree', 'history', 'forge', 'ledger'])      // at-rest planes (§1.2, §7.7 adds ledger)
  const UNR = new Set(['skip'])                                    // v1 forge rules degrade to labeled SKIP (§1.3)
  const CTXV = new Set(['check'])                                  // v1 has no admit/reconcile contexts (§3)
  const CERT = new Set(['deterministic', 'heuristic', 'judgment'])
  const ids = new Set()
  const expand = r => r.applies_to === 'all' ? TYPES : (Array.isArray(r.applies_to) ? r.applies_to : [])
  let curId

  // check.kind is valid and every any-of sub-check's kind is too (composition, §5.1).
  const checkKinds = c => {
    if (!c || typeof c !== 'object') return
    if (c.kind && !CHECK_KINDS.has(c.kind)) problems.push(`${curId}: unknown check kind '${c.kind}'`)
    for (const sub of (c.checks || [])) checkKinds(sub)
  }

  for (const r of RULES.rules) {
    curId = r.id || '(rule with no id)'
    if (!r.id) problems.push('a rule is missing "id"')
    else if (ids.has(r.id)) problems.push(`duplicate rule id: ${r.id}`)
    else ids.add(r.id)

    if (r.applies_to === undefined) problems.push(`${curId}: missing applies_to (must be "all" or a subset of project_types)`)
    else if (r.applies_to !== 'all') {
      if (!Array.isArray(r.applies_to) || !r.applies_to.length) problems.push(`${curId}: applies_to must be "all" or a non-empty array`)
      else for (const t of r.applies_to) if (!typeSet.has(t)) problems.push(`${curId}: applies_to has unknown type '${t}' (not in project_types)`)
    }
    if (r.profile !== undefined && !profileKeys.has(r.profile)) problems.push(`${curId}: unknown profile '${r.profile}'`)
    if (!sevOk.has(r.severity)) problems.push(`${curId}: invalid severity '${r.severity}'`)
    if (!catKeys.has(r.category)) problems.push(`${curId}: unknown category '${r.category}'`)
    if (r.requires !== undefined && !(r.requires in DEFAULTS)) problems.push(`${curId}: 'requires' names unknown config key '${r.requires}'`)

    // plane / context / certainty metadata (every rule declares all four).
    if (!Array.isArray(r.sources) || !r.sources.length || !r.sources.every(s => SRC.has(s))) problems.push(`${curId}: sources must be a non-empty subset of {${[...SRC].join('|')}}`)
    if (!UNR.has(r.on_unreachable)) problems.push(`${curId}: on_unreachable must be 'skip' (v1 degrades unreachable planes to a labeled SKIP)`)
    if (!Array.isArray(r.contexts) || !r.contexts.length || !r.contexts.every(c => CTXV.has(c))) problems.push(`${curId}: contexts must be a non-empty subset of {${[...CTXV].join('|')}}`)
    if (!CERT.has(r.certainty)) problems.push(`${curId}: certainty must be one of {${[...CERT].join('|')}}`)

    // severity_by_profile (§7.1 delta): a map keyed by declared tier → severity. Escalation to
    // blocker is the one place the blocker⇒deterministic law bites a map rather than a field.
    if (r.severity_by_profile !== undefined) {
      const m = r.severity_by_profile
      if (m === null || typeof m !== 'object' || Array.isArray(m)) problems.push(`${curId}: severity_by_profile must be an object map`)
      else for (const [tier, sev] of Object.entries(m)) {
        if (!tierSet.has(tier)) problems.push(`${curId}: severity_by_profile key '${tier}' is not a declared tier {${[...tierSet].join('|')}}`)
        if (!sevOk.has(sev)) problems.push(`${curId}: severity_by_profile['${tier}'] = '${sev}' is not a valid severity`)
        if (sev === 'blocker' && r.certainty !== 'deterministic') problems.push(`${curId}: severity_by_profile escalates to blocker at '${tier}' but certainty is '${r.certainty}' — a blocker escalation must be deterministic (§7.1)`)
      }
    }

    // the two engine laws (§3) + the judgment↔manual inverse.
    if (r.severity === 'blocker' && r.certainty !== 'deterministic') problems.push(`${curId}: blocker must be deterministic (got '${r.certainty}') — a blocker can't rest on a heuristic/judgment`)
    if (r.severity === 'manual' && r.certainty !== 'judgment') problems.push(`${curId}: sign-off (manual) must be certainty 'judgment' (got '${r.certainty}')`)
    if (r.certainty === 'judgment' && r.severity !== 'manual') problems.push(`${curId}: certainty 'judgment' must route to a sign-off (severity 'manual', got '${r.severity}')`)

    // FLAG family is uniformly opt-in — a flag rule without the gate would fire on repos that
    // never declared feature flags (baseline's CLAIM-06 wallpaper class, kept fixed here).
    if (r.category === 'flag' && r.requires !== 'uses_feature_flags') problems.push(`${curId}: flag-category rules must carry requires:uses_feature_flags (uniform family opt-in)`)

    checkKinds(r.check)
  }

  for (const t of TYPES) if (!RULES.rules.some(r => expand(r).includes(t))) problems.push(`no rule applies to type '${t}' (orphan type)`)
  for (const p of profileKeys) {
    const has = p === 'core' ? RULES.rules.some(r => !r.profile) : RULES.rules.some(r => r.profile === p)
    if (!has) problems.push(`no rule uses profile '${p}' (orphan profile)`)
  }

  // ---- coverage matrix (applicable rules per type, split by declared profile) + summary ----
  const profOf = r => r.profile || 'core'
  console.log(`\n  pipeline-skill self-check · v${RULES.version} · ${RULES.rules.length} rules · types=[${TYPES.join(', ')}]\n`)
  console.log('  Coverage — rules applicable per project type:')
  console.log('    type          core   team  critical   total')
  for (const t of TYPES) {
    const appl = RULES.rules.filter(r => expand(r).includes(t))
    const by = { core: 0, team: 0, critical: 0 }
    for (const r of appl) by[profOf(r)]++
    console.log(`    ${t.padEnd(10)}  ${String(by.core).padStart(5)}  ${String(by.team).padStart(5)}  ${String(by.critical).padStart(8)}  ${String(appl.length).padStart(6)}`)
  }
  console.log('')
  const cBy = c => RULES.rules.filter(r => r.certainty === c).length
  const sbp = RULES.rules.filter(r => r.severity_by_profile).map(r => r.id)
  console.log(`  Certainty — ${cBy('deterministic')} deterministic · ${cBy('heuristic')} heuristic · ${cBy('judgment')} judgment.`)
  console.log(`  Laws — blocker⇒deterministic · sign-off(manual)⇒judgment · severity_by_profile→blocker requires deterministic [${sbp.join(', ') || 'none'}].\n`)

  if (problems.length) {
    console.log(color(31, `  ✗ ${problems.length} integrity problem(s):`))
    for (const p of problems.slice(0, 60)) console.log('    - ' + p)
    if (problems.length > 60) console.log(`    … and ${problems.length - 60} more`)
    console.log('')
    return 1
  }
  console.log(color(32, `  ✓ rule set is internally consistent — every rule carries a valid applies_to, profile, kind, severity, category, and planes; all ${TYPES.length} types and ${profileKeys.size} profiles are covered.\n`))
  return 0
}
