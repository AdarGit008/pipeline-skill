// The judgment ledger (ARCHITECTURE §6). Pure core: resolveDateExpr, evalCondition,
// evaluateJudgment's worst-wins verdict lattice, selectSignoffs, ledgerHealth, gatherJdgFacts.
// Then the CLI: `jdg new` (never rubber-stamps; resolves date comparands to literals) and
// `jdg check` (exit 1 on tripped/expired/invalid; --today time-travels the whole contract).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  resolveDateExpr, evalCondition, deepEq, evaluateJudgment,
  selectSignoffs, ledgerHealth, gatherJdgFacts, runJdg,
} from '../src/jdg.mjs'
import { mkRepo, captureLog } from './helpers.mjs'

const TODAY = '2026-06-01'
const loaded = (data, errors = []) => ({ file: `x/${data?.id}.json`, name: `${data?.id}.json`, data, errors })

// ---- resolveDateExpr ----
test('resolveDateExpr: literal, today-relative, and non-dates', () => {
  assert.equal(resolveDateExpr('2026-01-01+30d', TODAY), '2026-01-31')
  assert.equal(resolveDateExpr('2026-01-01-1d', TODAY), '2025-12-31')
  assert.equal(resolveDateExpr('today+10d', TODAY), '2026-06-11')
  assert.equal(resolveDateExpr('today', TODAY), TODAY)
  assert.equal(resolveDateExpr('not-a-date', TODAY), null)
  assert.equal(resolveDateExpr(42, TODAY), null)
})

// ---- evalCondition ----
test('evalCondition: comparison ops', () => {
  const f = { a: 5, s: 'x', descriptor: { profile: 'team' } }
  assert.equal(evalCondition({ fact: 'a', op: 'eq', value: 5 }, f).fired, true)
  assert.equal(evalCondition({ fact: 'a', op: 'ne', value: 9 }, f).fired, true)
  assert.equal(evalCondition({ fact: 'a', op: 'gt', value: 3 }, f).fired, true)
  assert.equal(evalCondition({ fact: 'a', op: 'lt', value: 3 }, f).fired, false)
  assert.equal(evalCondition({ fact: 'descriptor.profile', op: 'eq', value: 'team' }, f).fired, true)
})

test('evalCondition: exists / absent', () => {
  const f = { a: 1 }
  assert.equal(evalCondition({ fact: 'a', op: 'exists' }, f).fired, true)
  assert.equal(evalCondition({ fact: 'nope', op: 'exists' }, f).fired, false)
  assert.equal(evalCondition({ fact: 'nope', op: 'absent' }, f).fired, true)
})

test('evalCondition: unresolvable fact path → fired:null (surfaced, never guessed)', () => {
  assert.equal(evalCondition({ fact: 'nope', op: 'eq', value: 1 }, {}).fired, null)
})

test('evalCondition: gt/lt type mismatch → fired:null', () => {
  assert.equal(evalCondition({ fact: 'a', op: 'gt', value: 'str' }, { a: 5 }).fired, null)
})

test('deepEq: primitives, arrays, nested objects', () => {
  assert.equal(deepEq({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true)
  assert.equal(deepEq({ a: 1 }, { a: 2 }), false)
  assert.equal(deepEq([1, 2], [1, 2, 3]), false)
})

// ---- evaluateJudgment verdict lattice ----
const J = over => ({ id: 'JDG-0001', kind: 'risk-acceptance', subject: 'BR-05', review_by: '2026-12-01', ...over })

test('evaluateJudgment: clean sign-off → ok', () => {
  const v = evaluateJudgment({ id: 'JDG-1', kind: 'sign-off', subject: 'RB-02', review_by: '2026-12-01' }, { today: TODAY })
  assert.equal(v.verdict, 'ok')
})

test('evaluateJudgment: review_by passed → expired', () => {
  assert.equal(evaluateJudgment(J({ review_by: '2020-01-01' }), { today: TODAY }).verdict, 'expired')
})

test('evaluateJudgment: expected_state mismatch → drifted', () => {
  const v = evaluateJudgment(J({ kind: 'deviation', expected_state: { 'descriptor.profile': 'critical' } }),
    { today: TODAY, descriptor: { profile: 'team' } })
  assert.equal(v.verdict, 'drifted')
})

test('evaluateJudgment: unresolvable expected_state path → unresolvable', () => {
  const v = evaluateJudgment(J({ kind: 'deviation', expected_state: { 'descriptor.nope': 'x' } }), { today: TODAY, descriptor: {} })
  assert.equal(v.verdict, 'unresolvable')
})

test('evaluateJudgment: missing today → unresolvable (expiry not evaluable)', () => {
  assert.equal(evaluateJudgment(J({ kind: 'sign-off' }), {}).verdict, 'unresolvable')
})

test('evaluateJudgment: tripwire fires → tripped', () => {
  const v = evaluateJudgment(J({ tripwire: { fact: 'descriptor.profile', op: 'eq', value: 'team' } }),
    { today: TODAY, descriptor: { profile: 'team' } })
  assert.equal(v.verdict, 'tripped')
})

test('evaluateJudgment: worst-wins — drifted + tripped → tripped', () => {
  const v = evaluateJudgment(J({
    expected_state: { 'descriptor.profile': 'critical' },
    tripwire: { fact: 'descriptor.profile', op: 'eq', value: 'team' },
  }), { today: TODAY, descriptor: { profile: 'team' } })
  assert.equal(v.verdict, 'tripped')
})

// ---- selectSignoffs ----
test('selectSignoffs: newest per subject; malformed + non-signoff excluded', () => {
  const by = selectSignoffs([
    loaded({ id: 'JDG-0001', kind: 'sign-off', subject: 'RB-02', date: '2026-01-01', review_by: '2026-06-01' }),
    loaded({ id: 'JDG-0002', kind: 'sign-off', subject: 'RB-02', date: '2026-05-01', review_by: '2026-11-01' }), // newer
    loaded({ id: 'JDG-0003', kind: 'deviation', subject: 'RB-02', date: '2026-09-01' }),                          // not a sign-off
    loaded({ id: 'JDG-0004', kind: 'sign-off', subject: 'RB-02', date: '2026-12-01' }, ['schema-invalid']),       // errored
  ])
  assert.equal(by['RB-02'].id, 'JDG-0002')
})

// ---- ledgerHealth ----
test('ledgerHealth: empty ledger → ok', () => {
  assert.equal(ledgerHealth([], { today: TODAY }).ok, true)
})

test('ledgerHealth: an expired record → not ok', () => {
  const l = [loaded({ id: 'JDG-0001', kind: 'sign-off', subject: 'RB-02', review_by: '2020-01-01' })]
  assert.equal(ledgerHealth(l, { today: TODAY }).ok, false)
})

test('ledgerHealth: an invalid record → not ok', () => {
  const l = [loaded({ id: 'JDG-0001' }, ['not valid JSON'])]
  assert.equal(ledgerHealth(l, { today: TODAY }).ok, false)
})

test('ledgerHealth: drifted-only → ok, surfaced as a note (never fails)', () => {
  const l = [loaded({ id: 'JDG-0001', kind: 'deviation', subject: 'x', review_by: '2026-12-01', expected_state: { 'descriptor.profile': 'critical' } })]
  const res = ledgerHealth(l, { today: TODAY, descriptor: { profile: 'team' } })
  assert.equal(res.ok, true)
  assert.match(res.detail, /note/)
})

// ---- gatherJdgFacts ----
test('gatherJdgFacts: descriptor + history facts; forge not probed unless referenced', t => {
  const repo = mkRepo(t, {
    files: { 'pipeline.repo.json': { type: 'service', profile: 'team', branching_model: 'trunk', default_branch: 'main' } },
    gitInit: true,
  }).index()
  const facts = gatherJdgFacts(repo, { today: TODAY, records: [] })
  assert.equal(facts.today, TODAY)
  assert.equal(facts.descriptor.profile, 'team')
  assert.equal(facts.planes.history.available, true)
  assert.equal(facts.planes.forge.available, null) // not probed — no record referenced planes.forge
})

// ---- CLI: jdg new ----
const readJudgment = (dir, id) => JSON.parse(readFileSync(path.join(dir, 'records/judgments', `${id}.json`), 'utf8'))

test('jdg new: authors a schema-valid numbered record', t => {
  const { dir } = mkRepo(t, {})
  const { ret } = captureLog(() => runJdg(
    ['new', '--kind', 'sign-off', '--subject', 'RB-02', '--reason', 'drilled 2026-06', '--review-by', '2026-12-01', '--by', 'adar'],
    { cwd: dir }))
  assert.equal(ret, 0)
  const rec = readJudgment(dir, 'JDG-0001')
  assert.equal(rec.id, 'JDG-0001')
  assert.equal(rec.subject, 'RB-02')
  assert.equal(rec.by, 'adar')
})

test('jdg new: refuses without a reason (no rubber stamp)', t => {
  const { dir } = mkRepo(t, {})
  const { ret } = captureLog(() => runJdg(
    ['new', '--kind', 'sign-off', '--subject', 'RB-02', '--review-by', '2026-12-01', '--by', 'adar'], { cwd: dir }))
  assert.equal(ret, 2)
})

test('jdg new: break-glass requires a --gate', t => {
  const { dir } = mkRepo(t, {})
  const { ret } = captureLog(() => runJdg(
    ['new', '--kind', 'break-glass', '--subject', 'deploy bypass', '--reason', 'sev1', '--review-by', '2026-12-01', '--by', 'adar'], { cwd: dir }))
  assert.equal(ret, 2)
})

test('jdg new: resolves a date-valued tripwire comparand to a literal at authoring', t => {
  const { dir } = mkRepo(t, {})
  const { ret } = captureLog(() => runJdg(
    ['new', '--kind', 'risk-acceptance', '--subject', 'BR-05', '--reason', 'accepted', '--review-by', '2026-12-01',
      '--by', 'adar', '--today', TODAY, '--tripwire', 'descriptor.last_review lt 2026-01-01+30d'], { cwd: dir }))
  assert.equal(ret, 0)
  assert.equal(readJudgment(dir, 'JDG-0001').tripwire.value, '2026-01-31') // computed, not stored as an expression
})

// ---- CLI: jdg check ----
test('jdg check: a clean ledger → exit 0', t => {
  const { dir } = mkRepo(t, {
    files: { 'records/judgments/JDG-0001.json': { record: 'judgment/1', id: 'JDG-0001', kind: 'sign-off', date: '2026-05-01', by: 'adar', subject: 'RB-02', reason: 'drill', review_by: '2026-12-01' } },
  })
  const { ret } = captureLog(() => runJdg(['check', '--today', TODAY], { cwd: dir }))
  assert.equal(ret, 0)
})

test('jdg check: an expired record → exit 1', t => {
  const { dir } = mkRepo(t, {
    files: { 'records/judgments/JDG-0001.json': { record: 'judgment/1', id: 'JDG-0001', kind: 'sign-off', date: '2019-01-01', by: 'adar', subject: 'RB-02', reason: 'drill', review_by: '2020-01-01' } },
  })
  const { ret } = captureLog(() => runJdg(['check', '--today', TODAY], { cwd: dir }))
  assert.equal(ret, 1)
})

test('jdg check --json: reports the exit + results', t => {
  const { dir } = mkRepo(t, {
    files: { 'records/judgments/JDG-0001.json': { record: 'judgment/1', id: 'JDG-0001', kind: 'sign-off', date: '2019-01-01', by: 'adar', subject: 'RB-02', reason: 'drill', review_by: '2020-01-01' } },
  })
  const { ret, out } = captureLog(() => runJdg(['check', '--json', '--today', TODAY], { cwd: dir }))
  assert.equal(ret, 1)
  const j = JSON.parse(out)
  assert.equal(j.exit, 1)
  assert.equal(j.results[0].verdict, 'expired')
})
