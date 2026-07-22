// Config resolution + profile activation (ARCHITECTURE §4.2, §7.3, §8): auto-detected type,
// the cumulative tier → ACTIVE set, descriptor supersession, the missing/invalid → solo
// fallback, and the FLAG-family opt-in (descriptor · config · records/flags/).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activeProfiles, detectType, loadDescriptor, resolveConfig, buildDefaults } from '../src/config.mjs'
import { mkRepo } from './helpers.mjs'

test('activeProfiles: cumulative tiers', () => {
  assert.deepEqual([...activeProfiles('solo')], ['core'])
  assert.deepEqual([...activeProfiles('team')].sort(), ['core', 'team'])
  assert.deepEqual([...activeProfiles('critical')].sort(), ['core', 'critical', 'team'])
})

test('detectType: IaC-only → infra', t => {
  const repo = mkRepo(t, { files: { 'main.tf': 'resource "x" {}' } }).index()
  assert.equal(detectType(repo), 'infra')
})

test('detectType: go.mod → service', t => {
  const repo = mkRepo(t, { files: { 'go.mod': 'module x\n' } }).index()
  assert.equal(detectType(repo), 'service')
})

test('detectType: package.json with start script → app', t => {
  const repo = mkRepo(t, { files: { 'package.json': { name: 'x', scripts: { start: 'node .' } } } }).index()
  assert.equal(detectType(repo), 'app')
})

test('detectType: publishable package (name+version+main, not private) → library', t => {
  const repo = mkRepo(t, { files: { 'package.json': { name: 'x', version: '1.0.0', main: 'index.js' } } }).index()
  assert.equal(detectType(repo), 'library')
})

test('detectType: nothing recognizable → docs', t => {
  const repo = mkRepo(t, { files: { 'README.md': '# hi' } }).index()
  assert.equal(detectType(repo), 'docs')
})

test('loadDescriptor: absent → present:false, valid:false', t => {
  const d = loadDescriptor(mkRepo(t, { files: { 'README.md': '#' } }).index())
  assert.equal(d.present, false)
  assert.equal(d.valid, false)
})

test('loadDescriptor: present but not JSON → present:true, valid:false', t => {
  const d = loadDescriptor(mkRepo(t, { files: { 'pipeline.repo.json': 'not json{' } }).index())
  assert.equal(d.present, true)
  assert.equal(d.valid, false)
  assert.ok(d.errors.length)
})

test('loadDescriptor: present + schema-valid → valid:true with parsed data', t => {
  const d = loadDescriptor(mkRepo(t, {
    files: { 'pipeline.repo.json': { type: 'service', profile: 'team', branching_model: 'trunk', default_branch: 'main' } },
  }).index())
  assert.equal(d.valid, true)
  assert.equal(d.data.profile, 'team')
})

test('loadDescriptor: present but schema-invalid (bad enum) → valid:false', t => {
  const d = loadDescriptor(mkRepo(t, {
    files: { 'pipeline.repo.json': { type: 'widget', profile: 'team', branching_model: 'trunk', default_branch: 'main' } },
  }).index())
  assert.equal(d.present, true)
  assert.equal(d.valid, false)
})

test('resolveConfig: a valid descriptor supersedes auto-detection + drives the tier', t => {
  // repo LOOKS like a go service, but the descriptor declares docs/critical → both win.
  const repo = mkRepo(t, {
    files: {
      'go.mod': 'module x\n',
      'pipeline.repo.json': { type: 'docs', profile: 'critical', branching_model: 'trunk', default_branch: 'main' },
    },
  }).index()
  const { cfg, declaredTier, ACTIVE } = resolveConfig(repo)
  assert.equal(cfg.type, 'docs')
  assert.equal(declaredTier, 'critical')
  assert.deepEqual([...ACTIVE].sort(), ['core', 'critical', 'team'])
})

test('resolveConfig: absent descriptor → solo (core only) + detected type', t => {
  const repo = mkRepo(t, { files: { 'go.mod': 'module x\n' } }).index()
  const { cfg, declaredTier, ACTIVE } = resolveConfig(repo)
  assert.equal(declaredTier, 'solo')
  assert.deepEqual([...ACTIVE], ['core'])
  assert.equal(cfg.type, 'service')
})

test('resolveConfig: invalid descriptor → solo (never trusts an invalid tier)', t => {
  const repo = mkRepo(t, {
    files: { 'pipeline.repo.json': { type: 'service', profile: 'critical', branching_model: 'trunk' } }, // missing default_branch
  }).index()
  const { declaredTier, ACTIVE } = resolveConfig(repo)
  assert.equal(declaredTier, 'solo')
  assert.deepEqual([...ACTIVE], ['core'])
})

test('resolveConfig: FLAG opt-in via descriptor uses_feature_flags', t => {
  const repo = mkRepo(t, {
    files: { 'pipeline.repo.json': { type: 'service', profile: 'team', branching_model: 'trunk', default_branch: 'main', uses_feature_flags: true } },
  }).index()
  assert.equal(resolveConfig(repo).FLAGS_ACTIVE, true)
})

test('FLAG opt-in via a non-empty records/flags/ directory', t => {
  const repo = mkRepo(t, {
    files: {
      'pipeline.repo.json': { type: 'service', profile: 'team', branching_model: 'trunk', default_branch: 'main' },
      'records/flags/FLAG-0001.json': { record: 'flag/1', id: 'FLAG-0001', name: 'x', owner: 'a', type: 'release', created: '2026-01-01', review_by: '2026-02-01' },
    },
  }).index()
  assert.equal(resolveConfig(repo).FLAGS_ACTIVE, true)
})

test('FLAG opt-in absent → inactive with a labeled reason', t => {
  const repo = mkRepo(t, { files: { 'README.md': '#' } }).index()
  const { FLAGS_ACTIVE, FLAGS_REASON } = resolveConfig(repo)
  assert.equal(FLAGS_ACTIVE, false)
  assert.match(FLAGS_REASON, /opt-in/)
})

test('buildDefaults: the §8 config keys with their documented defaults', t => {
  const d = buildDefaults(mkRepo(t, { files: { 'README.md': '#' } }).index())
  assert.equal(d.stale_branch_days, 30)
  assert.equal(d.rollback_drill_days, 90)
  assert.equal(d.permanent_flag_review_days, 365)
  assert.equal(d.prod_environment_name, 'production')
  assert.deepEqual(d.deploy_globs, [])
})
