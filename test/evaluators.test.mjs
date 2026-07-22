// Check-kind evaluators (ARCHITECTURE §5). Focus: the DESC-02 absent→SKIP pin (§5.3),
// forge degradation honesty (a labeled null, never a silent PASS — AC #3), the reused tree
// kinds, the flag registry, a history-plane kind, and the GOV-01 jdg-health wiring.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeEvalCheck } from '../src/evaluators.mjs'
import { buildDefaults, loadDescriptor } from '../src/config.mjs'
import { mkRepo, descriptorResult } from './helpers.mjs'

const R = { id: 'X-01' } // rule arg — only signoff/detail read it

// build an evalCheck over a repo, with an explicit DESCRIPTOR + a fixed clock; forge OFF so
// forge-plane kinds degrade deterministically regardless of whether gh exists in the env.
function evalOn(t, { files = {}, gitInit = false, DESCRIPTOR, tier = 'solo', today = '2026-06-01', noForge = true } = {}) {
  const repo = mkRepo(t, { files, gitInit }).index()
  const cfg = buildDefaults(repo)
  const desc = DESCRIPTOR ?? loadDescriptor(repo)
  return makeEvalCheck({ repo, cfg, DESCRIPTOR: desc, declaredTier: tier, noForge, today })
}

// ---- DESC-01 / DESC-02 ----
test('descriptor-valid: ABSENT descriptor → null (SKIP), not a blocker FAIL (§5.3 pin)', t => {
  const ev = evalOn(t, { DESCRIPTOR: descriptorResult(null, { present: false, valid: false }) })
  const res = ev({ kind: 'descriptor-valid' }, R)
  assert.equal(res.ok, null)
  assert.match(res.detail, /DESC-01/)
})

test('descriptor-valid: PRESENT-but-invalid → ok:false (the blocker fires)', t => {
  const ev = evalOn(t, { DESCRIPTOR: descriptorResult({ type: 'widget' }, { present: true, valid: false, errors: ['type must be one of ...'] }) })
  assert.equal(ev({ kind: 'descriptor-valid' }, R).ok, false)
})

test('descriptor-valid: valid descriptor → ok:true', t => {
  const ev = evalOn(t, { DESCRIPTOR: descriptorResult({ type: 'docs', profile: 'solo', branching_model: 'trunk', default_branch: 'main' }) })
  assert.equal(ev({ kind: 'descriptor-valid' }, R).ok, true)
})

test('descriptor (DESC-01): absent → ok:false; present → ok:true', t => {
  assert.equal(evalOn(t, { DESCRIPTOR: descriptorResult(null, { present: false, valid: false }) })({ kind: 'descriptor' }, R).ok, false)
  assert.equal(evalOn(t, { DESCRIPTOR: descriptorResult({ type: 'docs', profile: 'solo', branching_model: 'trunk', default_branch: 'main' }) })({ kind: 'descriptor' }, R).ok, true)
})

// ---- forge degradation: labeled null, never a silent PASS (AC #3) ----
const VALID_DESC = descriptorResult({
  type: 'service', profile: 'critical', branching_model: 'trunk', default_branch: 'main',
  environments: [{ name: 'production', tier: 'prod' }],
})

test('forge-protection offline → null + labeled "forge: not consulted"', t => {
  const res = evalOn(t, { DESCRIPTOR: VALID_DESC })({ kind: 'forge-protection', gov: 'protection' }, R)
  assert.equal(res.ok, null)
  assert.match(res.detail, /forge: not consulted/)
})

test('env-protection offline → null + labeled', t => {
  const res = evalOn(t, { DESCRIPTOR: VALID_DESC })({ kind: 'env-protection', prod_environment_from_config: 'prod_environment_name' }, R)
  assert.equal(res.ok, null)
  assert.match(res.detail, /forge: not consulted/)
})

test('workflow-state offline (with a workflow present) → null + labeled', t => {
  const res = evalOn(t, { files: { '.github/workflows/ci.yml': 'name: ci\non: [push]\n' } })({ kind: 'workflow-state' }, R)
  assert.equal(res.ok, null)
  assert.match(res.detail, /forge: not consulted/)
})

// ---- reused tree kinds ----
test('any-file present / absent modes', t => {
  const ev = evalOn(t, { files: { 'LICENSE': 'MIT' } })
  assert.equal(ev({ kind: 'any-file', globs: ['LICENSE'] }, R).ok, true)
  assert.equal(ev({ kind: 'any-file', globs: ['NOPE'] }, R).ok, false)
  assert.equal(ev({ kind: 'any-file', globs: ['*.env'], mode: 'absent' }, R).ok, true) // none present = good
})

test('grep finds / misses a pattern', t => {
  const ev = evalOn(t, { files: { 'a.txt': 'hello world' } })
  assert.equal(ev({ kind: 'grep', globs: ['*.txt'], pattern: 'world' }, R).ok, true)
  assert.equal(ev({ kind: 'grep', globs: ['*.txt'], pattern: 'zzz' }, R).ok, false)
})

test('file-contains: RB-01-style rollback lookahead over README', t => {
  const pattern = '(?=[\\s\\S]*(rollback|revert|redeploy))(?=[\\s\\S]*(deploy|release|version|previous))'
  const good = evalOn(t, { files: { 'README.md': 'to revert, redeploy the previous version' } })
  assert.equal(good({ kind: 'file-contains', globs: ['README.md'], pattern }, R).ok, true)
  const bad = evalOn(t, { files: { 'README.md': 'no relevant content here' } })
  assert.equal(bad({ kind: 'file-contains', globs: ['README.md'], pattern }, R).ok, false)
  const absent = evalOn(t, { files: { 'other.md': 'x' } })
  assert.equal(absent({ kind: 'file-contains', globs: ['README.md'], pattern }, R).ok, false) // file absent
})

// ---- flag registry (FLAG-02 owner / FLAG-03 freshness) ----
const flagRec = over => ({ record: 'flag/1', id: 'FLAG-0001', name: 'checkout', owner: 'adar', type: 'release', created: '2026-01-01', review_by: '2026-12-01', ...over })

test('flag-registry: empty registry → ok:false', t => {
  const res = evalOn(t)({ kind: 'flag-registry', assert: 'owner' }, R)
  assert.equal(res.ok, false)
  assert.match(res.detail, /empty/)
})

test('flag-registry owner: a valid owned record → ok:true', t => {
  const ev = evalOn(t, { files: { 'records/flags/FLAG-0001.json': flagRec() } })
  assert.equal(ev({ kind: 'flag-registry', assert: 'owner' }, R).ok, true)
})

test('flag-registry freshness: past-due review_by → ok:false', t => {
  const ev = evalOn(t, { files: { 'records/flags/FLAG-0001.json': flagRec({ review_by: '2020-01-01' }) }, today: '2026-06-01' })
  const res = ev({ kind: 'flag-registry', assert: 'freshness', permanent_types: ['kill-switch', 'permission'], permanent_days_from_config: 'permanent_flag_review_days', default_permanent_days: 365 }, R)
  assert.equal(res.ok, false)
  assert.match(res.detail, /past due/)
})

test('flag-registry freshness: missing review_by → ok:false', t => {
  const rec = flagRec(); delete rec.review_by
  const ev = evalOn(t, { files: { 'records/flags/FLAG-0001.json': rec } })
  const res = ev({ kind: 'flag-registry', assert: 'freshness', permanent_types: [], permanent_days_from_config: 'permanent_flag_review_days', default_permanent_days: 365 }, R)
  assert.equal(res.ok, false)
  assert.match(res.detail, /no review_by/)
})

test('flag-registry freshness: all unexpired → ok:true', t => {
  const ev = evalOn(t, { files: { 'records/flags/FLAG-0001.json': flagRec({ review_by: '2026-12-01' }) }, today: '2026-06-01' })
  assert.equal(ev({ kind: 'flag-registry', assert: 'freshness', permanent_types: [], permanent_days_from_config: 'permanent_flag_review_days', default_permanent_days: 365 }, R).ok, true)
})

// ---- history plane: stale-branches (BR-05) ----
test('stale-branches: an old unmerged branch → ok:false', t => {
  const r = mkRepo(t, { files: { 'README.md': '# x' }, gitInit: true, date: '2026-01-01T00:00:00Z' })
  r.git(['checkout', '-q', '-b', 'feature/old'], '2020-01-01T00:00:00Z')
  r.write({ 'feature.txt': 'work' })
  r.commit('old work', '2020-01-01T00:00:00Z')
  r.git(['checkout', '-q', 'main'])
  const cfg = buildDefaults(r.index())
  const ev = makeEvalCheck({ repo: r.index(), cfg, DESCRIPTOR: loadDescriptor(r.index()), declaredTier: 'solo', noForge: true })
  const res = ev({ kind: 'stale-branches', days_from_config: 'stale_branch_days', default_days: 30 }, R)
  assert.equal(res.ok, false)
  assert.match(res.detail, /feature\/old/)
})

test('stale-branches: only the default branch → ok:true', t => {
  const r = mkRepo(t, { files: { 'README.md': '# x' }, gitInit: true })
  const cfg = buildDefaults(r.index())
  const ev = makeEvalCheck({ repo: r.index(), cfg, DESCRIPTOR: loadDescriptor(r.index()), declaredTier: 'solo', noForge: true })
  assert.equal(ev({ kind: 'stale-branches', days_from_config: 'stale_branch_days', default_days: 30 }, R).ok, true)
})

// ---- ledger plane: GOV-01 jdg-health wiring ----
test('jdg-health: empty ledger → ok:true', t => {
  assert.equal(evalOn(t)({ kind: 'jdg-health' }, R).ok, true)
})

test('jdg-health: an expired judgment → ok:false (GOV-01 fails)', t => {
  const rec = { record: 'judgment/1', id: 'JDG-0001', kind: 'sign-off', date: '2019-01-01', by: 'adar', subject: 'RB-02', reason: 'drill', review_by: '2020-01-01' }
  const ev = evalOn(t, { files: { 'records/judgments/JDG-0001.json': rec }, today: '2026-06-01' })
  const res = ev({ kind: 'jdg-health' }, R)
  assert.equal(res.ok, false)
  assert.match(res.detail, /unhealthy/)
})
