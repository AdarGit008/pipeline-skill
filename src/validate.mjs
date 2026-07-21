// The zero-dependency subset validator — a small, deterministic slice of JSON Schema,
// enough for the descriptor (schema/repo.schema.json) and the two record schemas and no
// more: type, enum, pattern, minLength, maxLength, required, additionalProperties:false,
// nested properties, array items/maxItems. Ported field-for-field from baseline-skill's
// src/validate.mjs so the two skills validate with the identical engine; pipeline-skill
// has no separate records.mjs, so the schema-loading wrappers (validateDescriptor,
// validateRecord) live here too. Messages are input-derived only (no absolute paths or
// run dates) so golden pins stay stable. Keys prefixed with _ are inline notes, ignored
// (the config-file convention — the descriptor's `_comment` rides through additionalProperties).
import fs from 'node:fs'

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
function matchesType(v, t) {
  switch (t) {
    case 'object':  return v !== null && typeof v === 'object' && !Array.isArray(v)
    case 'array':   return Array.isArray(v)
    case 'integer': return typeof v === 'number' && Number.isInteger(v)
    case 'number':  return typeof v === 'number'
    case 'string':  return typeof v === 'string'
    case 'boolean': return typeof v === 'boolean'
    default:        return true
  }
}
const describe = v => (v !== null && typeof v === 'object') ? (Array.isArray(v) ? 'array' : 'object') : JSON.stringify(v)
const childPath = (where, k) => where ? `${where}.${k}` : k

// A schema node may use { enum: [...] } with no `type` (the descriptor's `type`/`profile`
// fields do exactly this) — enum/pattern/minLength are checked regardless of a `type` key.
export function validateAgainst(value, schema, where, errors) {
  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${where || 'descriptor'} must be ${schema.type} (got ${describe(value)})`)
    return // a type mismatch cascades into noise — stop at this node
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${where || 'value'} must be one of ${schema.enum.join('|')} (got ${describe(value)})`)
  if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) errors.push(`${where} must match ${schema.pattern} (got ${describe(value)})`)
  if (schema.minLength != null && typeof value === 'string' && value.length < schema.minLength) errors.push(`${where} must be non-empty`)
  if (schema.maxLength != null && typeof value === 'string' && value.length > schema.maxLength) errors.push(`${where} must be at most ${schema.maxLength} characters`)
  if (schema.maxItems != null && Array.isArray(value) && value.length > schema.maxItems) errors.push(`${where} must have at most ${schema.maxItems} items`)
  // Object walk: honor properties + required + additionalProperties:false at any node that
  // declares properties (the descriptor's top level has no `type: object` but does have
  // `properties`), so validate on either signal.
  if ((schema.type === 'object' || schema.properties) && matchesType(value, 'object')) {
    const props = schema.properties || {}
    for (const req of (schema.required || [])) if (!(req in value)) errors.push(`${where ? where + ': ' : ''}missing required field '${req}'`)
    for (const k of Object.keys(value)) {
      if (k.startsWith('_')) continue // inline comment keys, ignored (matches the config-file convention)
      // hasOwn, not `in`: a field named __proto__/constructor/toString would match the
      // prototype chain and read as "known", skipping the unknown-field error entirely.
      if (!hasOwn(props, k)) { if (schema.additionalProperties === false) errors.push(`'${childPath(where, k)}' is not a known field`); continue }
      validateAgainst(value[k], props[k], childPath(where, k), errors)
    }
  }
  if (schema.type === 'array' && Array.isArray(value) && schema.items) value.forEach((el, i) => validateAgainst(el, schema.items, `${where}[${i}]`, errors))
}

// ---- schema loaders (resolved relative to this module, never CWD) ----
const SCHEMA_FILES = {
  descriptor: 'repo.schema.json',
  judgment:   'record.judgment.schema.json',
  flag:       'record.flag.schema.json',
}
const _cache = {}
export function loadSchema(kind) {
  if (!SCHEMA_FILES[kind]) throw new Error(`unknown schema '${kind}' (known: ${Object.keys(SCHEMA_FILES).join(', ')})`)
  return _cache[kind] ??= JSON.parse(fs.readFileSync(new URL('../schema/' + SCHEMA_FILES[kind], import.meta.url), 'utf8'))
}

// -> [] when valid; array of error strings otherwise (the descriptor's message style).
export function validateDescriptor(obj) {
  const errors = []
  validateAgainst(obj, loadSchema('descriptor'), '', errors)
  return errors
}

// kind ∈ {judgment, flag}
export function validateRecord(kind, obj) {
  const errors = []
  validateAgainst(obj, loadSchema(kind), '', errors)
  return errors
}

// ---- CLI / self-test ----
// `node src/validate.mjs <descriptor|judgment|flag> <file.json>` -> validate a file.
// `node src/validate.mjs --self-test` -> run embedded good/bad fixtures (used by chunk-1
// acceptance: "validates a sample descriptor + record"). Zero-dep, node-only.
function report(label, errors) {
  if (errors.length === 0) { console.log(`  OK    ${label}`); return true }
  console.log(`  ERR   ${label}`)
  for (const e of errors) console.log(`          - ${e}`)
  return false
}

function selfTest() {
  let allPass = true
  const expect = (label, errors, shouldPass) => {
    const passed = errors.length === 0
    const good = passed === shouldPass
    allPass = allPass && good
    const mark = good ? '✓' : '✗'
    console.log(`  ${mark} ${label} — ${passed ? 'valid' : 'invalid'} (expected ${shouldPass ? 'valid' : 'invalid'})`)
    if (!passed && !shouldPass) for (const e of errors) console.log(`        · ${e}`)
    if (!good) for (const e of errors) console.log(`        UNEXPECTED: ${e}`)
  }

  console.log('descriptor:')
  expect('minimal valid descriptor', validateDescriptor({
    type: 'service', profile: 'team', branching_model: 'trunk', default_branch: 'main',
  }), true)
  expect('full valid descriptor', validateDescriptor({
    type: 'service', profile: 'critical', branching_model: 'dev-staging-main', default_branch: 'main',
    environments: [{ name: 'staging', tier: 'staging' }, { name: 'production', tier: 'prod', gated: true }],
    iac: { tool: 'terraform', state_backend: 's3' },
    uses_feature_flags: true,
    branches: { integration: 'dev', staging: 'staging', production: 'main' },
    recovery_objective: 'failed deployment recovery time < 30 min',
    _note: 'additionalProperties:true — custom keys ride through',
  }), true)
  expect('bad enum + missing required', validateDescriptor({
    type: 'widget', profile: 'team', branching_model: 'trunk',
  }), false)
  expect('bad environments tier', validateDescriptor({
    type: 'app', profile: 'solo', branching_model: 'trunk', default_branch: 'main',
    environments: [{ name: 'prod', tier: 'production' }],
  }), false)

  console.log('judgment record:')
  expect('valid sign-off', validateRecord('judgment', {
    record: 'judgment/1', id: 'JDG-0001', kind: 'sign-off', date: '2026-07-20',
    by: 'adar', subject: 'RB-02', reason: 'drilled 2026-07-20: rollback ok', review_by: '2026-10-01',
  }), true)
  expect('valid break-glass w/ free-form gate', validateRecord('judgment', {
    record: 'judgment/1', id: 'JDG-0002', kind: 'break-glass', date: '2026-07-20',
    by: 'adar', subject: 'deploy v1.4.2 bypass', reason: 'sev1 hotfix', review_by: '2026-08-01',
    gate: 'environment:production',
  }), true)
  expect('bad id pattern + unknown field', validateRecord('judgment', {
    record: 'judgment/1', id: 'JDG-1', kind: 'sign-off', date: '2026-07-20',
    by: 'adar', subject: 'RB-02', reason: 'x', review_by: '2026-10-01', bogus: true,
  }), false)

  console.log('flag record:')
  expect('valid flag', validateRecord('flag', {
    record: 'flag/1', id: 'FLAG-0001', name: 'new-checkout-flow', owner: 'adar',
    type: 'release', created: '2026-07-01', review_by: '2026-08-10',
  }), true)
  expect('bad type enum + missing owner', validateRecord('flag', {
    record: 'flag/1', id: 'FLAG-0002', name: 'x', type: 'toggle', created: '2026-07-01',
  }), false)

  console.log(allPass ? '\nself-test: ALL PASS' : '\nself-test: FAILURES ABOVE')
  return allPass
}

// ESM main-module guard (no require.main in ESM).
const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href
if (isMain) {
  const [, , a, b] = process.argv
  if (a === '--self-test' || a === undefined) {
    process.exit(selfTest() ? 0 : 1)
  } else {
    const kind = a === 'descriptor' ? 'descriptor' : a
    const known = ['descriptor', 'judgment', 'flag']
    if (!known.includes(kind)) { console.error(`usage: node src/validate.mjs <${known.join('|')}> <file.json>  |  --self-test`); process.exit(2) }
    let data
    try { data = JSON.parse(fs.readFileSync(b, 'utf8')) } catch (e) { console.error(`cannot read/parse ${b}: ${e.message}`); process.exit(2) }
    const errors = kind === 'descriptor' ? validateDescriptor(data) : validateRecord(kind, data)
    const okp = report(`${kind} ${b}`, errors)
    process.exit(okp ? 0 : 1)
  }
}
