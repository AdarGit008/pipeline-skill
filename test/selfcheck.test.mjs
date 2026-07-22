// --self-check: the structural-law validator that keeps the rule set from rotting
// (ARCHITECTURE §3, §7.1). Three things: it passes on the locked catalog, the locked
// taxonomy is what the spec says it is (a regression pin), and every injected violation is
// caught (exit 1). runSelfCheck is wrapped in captureLog so its coverage matrix stays out of
// the test log; we assert only its return code.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runSelfCheck } from '../src/selfcheck.mjs'
import { loadRules } from '../src/engine.mjs'
import { CHECK_KINDS } from '../src/evaluators.mjs'
import { buildDefaults } from '../src/config.mjs'
import { captureLog } from './helpers.mjs'

const RULES = loadRules()
const DEFAULTS = buildDefaults({ FILES: [], match: () => [], read: () => null })
const noColor = (_c, s) => s
const clone = () => structuredClone(RULES)
const find = (R, pred) => R.rules[R.rules.findIndex(pred)]
const check = R => captureLog(() => runSelfCheck({ RULES: R, TYPES: R.project_types, CHECK_KINDS, DEFAULTS, color: noColor })).ret

test('the locked rule set passes --self-check', () => {
  assert.equal(check(RULES), 0)
})

test('locked taxonomy pin: 39 rules across the 9 families', () => {
  const fam = {}
  for (const r of RULES.rules) fam[r.category] = (fam[r.category] || 0) + 1
  assert.equal(RULES.rules.length, 39)
  assert.deepEqual(fam, { desc: 3, br: 6, ci: 6, env: 6, iac: 6, flag: 3, rb: 4, hot: 4, gov: 1 })
})

test('locked taxonomy pin: profile split core 11 / team 19 / critical 9', () => {
  const by = { core: 0, team: 0, critical: 0 }
  for (const r of RULES.rules) by[r.profile || 'core']++
  assert.deepEqual(by, { core: 11, team: 19, critical: 9 })
})

test('locked taxonomy pin: certainty 23 deterministic / 13 heuristic / 3 judgment', () => {
  const by = {}
  for (const r of RULES.rules) by[r.certainty] = (by[r.certainty] || 0) + 1
  assert.deepEqual(by, { deterministic: 23, heuristic: 13, judgment: 3 })
})

test('locked taxonomy pin: sign-offs and severity_by_profile users', () => {
  const manual = RULES.rules.filter(r => r.severity === 'manual').map(r => r.id).sort()
  const sbp = RULES.rules.filter(r => r.severity_by_profile).map(r => r.id).sort()
  const blockers = RULES.rules.filter(r => r.severity === 'blocker').map(r => r.id).sort()
  assert.deepEqual(manual, ['ENV-05', 'RB-02', 'RB-04'])
  assert.deepEqual(sbp, ['BR-03', 'ENV-04'])
  assert.deepEqual(blockers, ['CI-01', 'CI-02', 'CI-03', 'DESC-02', 'GOV-01', 'IAC-01', 'IAC-06', 'RB-01'])
})

// ---- injected violations: each must trip --self-check (exit 1) ----
test('violation: a blocker resting on a heuristic', () => {
  const R = clone(); const r = R.rules[0]; r.severity = 'blocker'; r.certainty = 'heuristic'
  assert.equal(check(R), 1)
})

test('violation: a manual (sign-off) rule that is not judgment', () => {
  const R = clone(); const r = R.rules[0]; r.severity = 'manual'; r.certainty = 'deterministic'
  assert.equal(check(R), 1)
})

test('violation: a judgment rule not routed to a sign-off (severity manual)', () => {
  const R = clone(); const r = R.rules[0]; r.certainty = 'judgment'; r.severity = 'warn'
  assert.equal(check(R), 1)
})

test('violation: severity_by_profile escalates to blocker on a non-deterministic rule', () => {
  const R = clone(); const r = find(R, x => x.certainty === 'heuristic' && x.severity === 'warn')
  r.severity_by_profile = { critical: 'blocker' }
  assert.equal(check(R), 1)
})

test('violation: a duplicate rule id', () => {
  const R = clone(); R.rules[1].id = R.rules[0].id
  assert.equal(check(R), 1)
})

test('violation: an unknown check kind', () => {
  const R = clone(); R.rules[0].check = { kind: 'no-such-kind' }
  assert.equal(check(R), 1)
})

test('violation: a flag-family rule missing requires:uses_feature_flags', () => {
  const R = clone(); const r = find(R, x => x.category === 'flag'); delete r.requires
  assert.equal(check(R), 1)
})

test('violation: an unknown severity', () => {
  const R = clone(); R.rules[0].severity = 'catastrophe'
  assert.equal(check(R), 1)
})

test('violation: applies_to names a type outside project_types', () => {
  const R = clone(); R.rules[0].applies_to = ['nonsense']
  assert.equal(check(R), 1)
})

test('violation: a sources plane outside {tree,history,forge,ledger}', () => {
  const R = clone(); R.rules[0].sources = ['cloud']
  assert.equal(check(R), 1)
})
