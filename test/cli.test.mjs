// End-to-end CLI contract (ARCHITECTURE §10): check.mjs and pipeline.mjs spawned as real
// processes. Covers the exit-code contract (0 clean · 1 on a blocker · 2 on a usage error),
// the --json scorecard shape, pipeline's subcommand routing with inherited exit codes, and
// the standing acceptance criterion that this repo self-scores 0 blockers (AC #4).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkRepo, runCheck, runPipeline, ROOT, CLEAN_DOCS_REPO } from './helpers.mjs'

test('check.mjs --self-check → exit 0 on the locked rule set', () => {
  assert.equal(runCheck(['--self-check']).status, 0)
})

test('check.mjs --repo <this repo> → exit 0, 0 blockers (AC #4: the standard self-scores clean)', () => {
  const r = runCheck(['--repo', ROOT, '--json'])
  assert.equal(r.status, 0)
  const j = JSON.parse(r.stdout)
  assert.equal(j.summary.blockers, 0)
  assert.equal(j.skill, 'pipeline-skill')
})

test('check.mjs --repo <clean docs fixture> → exit 0', t => {
  const { dir } = mkRepo(t, { files: CLEAN_DOCS_REPO })
  assert.equal(runCheck(['--repo', dir]).status, 0)
})

test('check.mjs: a present-but-invalid descriptor fails DESC-02 (blocker) → exit 1', t => {
  const { dir } = mkRepo(t, {
    files: {
      'pipeline.repo.json': { type: 'widget', profile: 'solo', branching_model: 'trunk', default_branch: 'main' }, // bad type enum
      'RUNBOOK.md': '# runbook\n\n## Rollback\nrevert and redeploy the previous version\n',                        // isolate DESC-02
    },
  })
  const r = runCheck(['--repo', dir, '--json'])
  assert.equal(r.status, 1)
  const j = JSON.parse(r.stdout)
  assert.equal(j.summary.blockers, 1)
  const desc02 = j.results.find(x => x.id === 'DESC-02')
  assert.equal(desc02.tag, 'FAIL')
})

test('check.mjs --json: the scorecard shape', t => {
  const { dir } = mkRepo(t, { files: CLEAN_DOCS_REPO })
  const j = JSON.parse(runCheck(['--repo', dir, '--json']).stdout)
  assert.equal(j.tier, 'solo')
  assert.equal(j.type, 'docs')
  assert.ok(Array.isArray(j.results) && j.results.length === 39)
  for (const k of ['blockers', 'pass', 'fail', 'warn', 'signoff', 'skip', 'total']) assert.ok(k in j.summary)
})

test('check.mjs: a value flag with no value → exit 2', () => {
  assert.equal(runCheck(['--repo']).status, 2)
})

// ---- pipeline.mjs routing ----
test('pipeline check delegates to check.mjs and inherits exit 0 (clean)', t => {
  const { dir } = mkRepo(t, { files: CLEAN_DOCS_REPO })
  assert.equal(runPipeline(['check', '--repo', dir]).status, 0)
})

test('pipeline with a leading --flag is treated as check (inherits exit 1 on a blocker)', t => {
  const { dir } = mkRepo(t, { files: { 'go.mod': 'module x\n' } }) // detects service → CI-01/RB-01 blockers fire
  assert.equal(runPipeline(['--repo', dir]).status, 1)
})

test('RB-01 is n/a for a docs repo — a missing rollback note is not a blocker (follow-up #9)', t => {
  const { dir } = mkRepo(t, { files: { 'pipeline.repo.json': { type: 'docs', profile: 'solo', branching_model: 'trunk', default_branch: 'main' } } })
  const r = runCheck(['--repo', dir, '--json'])
  assert.equal(r.status, 0)
  const j = JSON.parse(r.stdout)
  assert.equal(j.summary.blockers, 0)
  assert.equal(j.results.find(x => x.id === 'RB-01').tag, 'SKIP')
})

test('RB-01 still fires for a deployable (service) repo lacking a rollback note → blocker', t => {
  const { dir } = mkRepo(t, { files: { 'go.mod': 'module x\n', 'README.md': '# no rollback here' } })
  const r = runCheck(['--repo', dir, '--json'])
  assert.equal(r.status, 1)
  assert.equal(JSON.parse(r.stdout).results.find(x => x.id === 'RB-01').tag, 'FAIL')
})

test('pipeline jdg check routes to the ledger evaluator (empty ledger → exit 0)', t => {
  const { dir } = mkRepo(t, { files: CLEAN_DOCS_REPO })
  assert.equal(runPipeline(['jdg', 'check', '--repo', dir]).status, 0)
})

test('pipeline help → exit 0', () => {
  const r = runPipeline(['help'])
  assert.equal(r.status, 0)
  assert.match(r.stdout, /check/)
})

test('pipeline <unknown command> → exit 2', () => {
  assert.equal(runPipeline(['flibbertigibbet']).status, 2)
})
