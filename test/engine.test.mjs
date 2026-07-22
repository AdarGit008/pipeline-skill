// Engine: the gate → evaluate → tag funnel (ARCHITECTURE §4.3), severity_by_profile
// escalation (§4.2.5 / §7.1), crash-resilient degradation to SKIP (§1.4), and the exit-code
// contract (§10). evalCheck is injected as a stub so these stay pure and deterministic.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runRules, effectiveSeverity, isBlocking, exitCodeOf } from '../src/engine.mjs'
import { rule, stubEval } from './helpers.mjs'

const base = { cfg: { type: 'service' }, ACTIVE: new Set(['core']), declaredTier: 'solo' }
const run = (rules, byId, over = {}) =>
  runRules({ rules, evalCheck: stubEval(byId), ...base, ...over })

test('verdict mapping: ok=true → PASS', () => {
  const [r] = run([rule({ id: 'A' })], { A: { ok: true, detail: 'good' } })
  assert.equal(r.tag, 'PASS')
})

test('verdict mapping: ok=false + warn → WARN', () => {
  const [r] = run([rule({ id: 'A', severity: 'warn' })], { A: { ok: false, detail: 'x' } })
  assert.equal(r.tag, 'WARN')
})

test('verdict mapping: ok=false + blocker → FAIL', () => {
  const [r] = run([rule({ id: 'A', severity: 'blocker', certainty: 'deterministic' })], { A: { ok: false, detail: 'x' } })
  assert.equal(r.tag, 'FAIL')
})

test('verdict mapping: ok=null → SKIP', () => {
  const [r] = run([rule({ id: 'A' })], { A: { ok: null, detail: 'n/a' } })
  assert.equal(r.tag, 'SKIP')
})

test('verdict mapping: sign-off — kind:signoff routes to SIGN-OFF even without the flag', () => {
  const [r] = run([rule({ id: 'A', severity: 'manual', certainty: 'judgment', check: { kind: 'signoff' } })],
    { A: { ok: false, detail: 'no sign-off' } })
  assert.equal(r.tag, 'SIGN-OFF')
})

test('verdict mapping: signoff flag on a manual rule → SIGN-OFF', () => {
  const [r] = run([rule({ id: 'A', severity: 'manual', certainty: 'judgment' })],
    { A: { ok: false, detail: 'lapsed', signoff: true } })
  assert.equal(r.tag, 'SIGN-OFF')
})

test('gate: applies_to excludes the repo type → SKIP labeled n/a', () => {
  const [r] = run([rule({ id: 'A', applies_to: ['app'] })], { A: { ok: true } }, { cfg: { type: 'docs' } })
  assert.equal(r.tag, 'SKIP')
  assert.match(r.detail, /n\/a for docs/)
})

test('gate: profile off the ACTIVE set → SKIP', () => {
  const [r] = run([rule({ id: 'A', profile: 'team' })], { A: { ok: true } })  // ACTIVE = {core}
  assert.equal(r.tag, 'SKIP')
  assert.match(r.detail, /profile 'team' off/)
})

test('gate: FLAG opt-in inactive → SKIP with the opt-in reason', () => {
  const rules = [rule({ id: 'A', category: 'flag', requires: 'uses_feature_flags' })]
  const [r] = runRules({ rules, evalCheck: stubEval({ A: { ok: true } }), ...base, FLAGS_ACTIVE: false, FLAGS_REASON: 'flag opt-in inactive' })
  assert.equal(r.tag, 'SKIP')
  assert.match(r.detail, /opt-in inactive/)
})

test('gate: FLAG opt-in active → rule evaluates', () => {
  const rules = [rule({ id: 'A', category: 'flag', requires: 'uses_feature_flags' })]
  const [r] = runRules({ rules, evalCheck: stubEval({ A: { ok: true } }), ...base, FLAGS_ACTIVE: true })
  assert.equal(r.tag, 'PASS')
})

test('gate: a rule outside the run context is EXCLUDED (no row), not a SKIP', () => {
  const results = run([rule({ id: 'A', contexts: ['reconcile'] }), rule({ id: 'B' })], { A: { ok: true }, B: { ok: true } })
  assert.equal(results.length, 1)
  assert.equal(results[0].r.id, 'B')
})

test('degradation: a thrown evaluator becomes SKIP, never a crash', () => {
  const boom = () => { throw new Error('kaboom') }
  const [r] = runRules({ rules: [rule({ id: 'A' })], evalCheck: boom, ...base })
  assert.equal(r.tag, 'SKIP')
  assert.match(r.detail, /check errored/)
})

test('degradation: an evaluator that returns nothing becomes SKIP', () => {
  const [r] = runRules({ rules: [rule({ id: 'A' })], evalCheck: () => undefined, ...base })
  assert.equal(r.tag, 'SKIP')
  assert.match(r.detail, /returned nothing/)
})

test('escalation: effectiveSeverity resolves severity_by_profile[declaredTier]', () => {
  const r = rule({ id: 'BR-03', severity: 'warn', certainty: 'deterministic', severity_by_profile: { critical: 'blocker' } })
  assert.equal(effectiveSeverity(r, 'team'), 'warn')       // no key for team → base
  assert.equal(effectiveSeverity(r, 'critical'), 'blocker') // escalated
})

test('escalation end-to-end: a failing sbp rule is WARN at team but a blocking FAIL at critical', () => {
  const r = rule({ id: 'BR-03', severity: 'warn', certainty: 'deterministic', severity_by_profile: { critical: 'blocker' } })
  const atTeam = run([r], { 'BR-03': { ok: false, detail: 'no strict checks' } },
    { ACTIVE: new Set(['core', 'team']), declaredTier: 'team' })[0]
  assert.equal(atTeam.tag, 'WARN')
  assert.equal(isBlocking(atTeam), false)

  const atCrit = run([r], { 'BR-03': { ok: false, detail: 'no strict checks' } },
    { ACTIVE: new Set(['core', 'team', 'critical']), declaredTier: 'critical' })[0]
  assert.equal(atCrit.tag, 'FAIL')
  assert.equal(atCrit.severity, 'blocker')
  assert.equal(isBlocking(atCrit), true)
})

test('exit code: 1 iff a blocker FAILed', () => {
  const blockerFail = run([rule({ id: 'A', severity: 'blocker', certainty: 'deterministic' })], { A: { ok: false } })
  assert.equal(exitCodeOf(blockerFail), 1)

  const warnFail = run([rule({ id: 'A', severity: 'warn' })], { A: { ok: false } })
  assert.equal(exitCodeOf(warnFail), 0)   // a non-blocker FAIL (WARN) never sets exit 1

  const allPass = run([rule({ id: 'A', severity: 'blocker', certainty: 'deterministic' })], { A: { ok: true } })
  assert.equal(exitCodeOf(allPass), 0)
})
