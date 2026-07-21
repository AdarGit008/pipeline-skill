// Scorecard rendering (ARCHITECTURE §4; SKILL-DRAFT "How the runner decides"): human report
// leads with blockers, then warnings grouped by family; --json emits machine output. Both
// return the process exit code (1 iff a blocker FAILed). isBlocking reads the EFFECTIVE
// severity the engine resolved, so a critical-tier BR-03/ENV-04 escalation counts.
import path from 'node:path'
import { isBlocking } from './engine.mjs'

// Family display names (the nine rule categories).
export const CATS = {
  desc: 'Descriptor & declared posture',
  br: 'Branching & PR workflow',
  ci: 'CI/CD pipeline stages',
  env: 'Environment tiers',
  iac: 'Infrastructure as code',
  flag: 'Feature flags',
  rb: 'Rollback & recovery',
  hot: 'Hotfix & incident flow',
  gov: 'The judgment ledger',
}

export function makeColor(JSON_OUT) {
  return (c, s) => (process.stdout.isTTY && !JSON_OUT) ? `\x1b[${c}m${s}\x1b[0m` : s
}

// repo-authored strings (detail lines carry descriptor fields; titles are rule text) are
// stripped of terminal control bytes before printing — no cursor-move that overwrites a
// printed FAIL with a fake PASS. --json is unaffected (JSON escapes them).
const sanitizeTTY = s => s == null ? s : String(s).replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')

const countTag = (results, t) => results.filter(x => x.tag === t).length

export function reportJson({ results, REPO, cfg, declaredTier, ACTIVE, HEAD, version }) {
  const blockers = results.filter(isBlocking).length
  const out = {
    skill: 'pipeline-skill', version, repo: REPO, type: cfg.type, tier: declaredTier, profiles: [...ACTIVE], head: HEAD,
    results: results.map(x => ({ id: x.r.id, category: x.r.category, severity: x.severity, declared_severity: x.r.severity, profile: x.r.profile || 'core', tag: x.tag, detail: x.detail })),
    summary: {
      blockers,
      pass: countTag(results, 'PASS'),
      fail: countTag(results, 'FAIL'),
      warn: countTag(results, 'WARN'),
      signoff: countTag(results, 'SIGN-OFF'),
      skip: countTag(results, 'SKIP'),
      total: results.length,
    },
  }
  console.log(JSON.stringify(out, null, 2))
  return blockers ? 1 : 0
}

export function reportHuman({ results, REPO, cfg, declaredTier, ACTIVE, HEAD, version, color }) {
  const TAG = { PASS: color(32, 'PASS'), FAIL: color(31, 'FAIL'), WARN: color(33, 'WARN'), SKIP: color(90, 'SKIP'), 'SIGN-OFF': color(35, 'SIGN-OFF') }
  const TAGW = 8
  const tagCell = t => TAG[t] + ' '.repeat(Math.max(1, TAGW - t.length + 1))
  const S = sanitizeTTY
  const row = x => `    ${tagCell(x.tag)} ${x.r.id.padEnd(8)} ${S(x.r.title)}\n            ${color(90, '↳ ' + S(x.detail))}`

  console.log(`\n  pipeline-skill v${version}  ·  ${path.basename(REPO)}  ·  type=${cfg.type}  ·  tier=${declaredTier}  ·  profiles=[${[...ACTIVE].join(',')}]  ·  HEAD=${HEAD || 'n/a'}\n`)

  // lead with blockers (SKILL-DRAFT line 84): the FAILs that set exit 1.
  const fails = results.filter(isBlocking)
  if (fails.length) {
    console.log('  ' + color(31, `✗ Blockers (${fails.length}) — fail CI`))
    for (const x of fails) console.log(row(x))
    console.log('')
  }

  // then the full scorecard grouped by family.
  for (const cat of Object.keys(CATS)) {
    const rows = results.filter(x => x.r.category === cat); if (!rows.length) continue
    console.log('  ' + color(1, CATS[cat]))
    for (const x of rows) console.log(row(x))
    console.log('')
  }

  const scored = results.filter(x => x.tag !== 'SKIP').length
  const blockers = fails.length
  console.log('  ' + color(1, 'Summary') + `  ${color(32, countTag(results, 'PASS') + ' pass')} · ${color(31, countTag(results, 'FAIL') + ' fail')} · ${color(33, countTag(results, 'WARN') + ' warn')} · ${color(35, countTag(results, 'SIGN-OFF') + ' sign-off')} · ${color(90, countTag(results, 'SKIP') + ' n/a')}`)
  console.log(`  Readiness: ${Math.round(100 * countTag(results, 'PASS') / Math.max(1, scored))}%  (${countTag(results, 'PASS')}/${scored} applicable)`)
  console.log(blockers ? color(31, `\n  ✗ ${blockers} blocker(s) — not delivery-ready.\n`) : color(32, `\n  ✓ no blockers.\n`))
  return blockers ? 1 : 0
}
