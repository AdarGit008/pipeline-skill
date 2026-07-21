#!/usr/bin/env node
// pipeline-skill checker — zero-dependency. Scores a repo against rules.json.
// Usage: node check.mjs [--repo DIR] [--config FILE] [--json] [--no-exec] [--self-check]
//   --repo DIR      the target repo (default: cwd)
//   --config FILE   extra config overlay (after <repo>/pipeline.config.json)
//   --json          machine output instead of the scorecard
//   --no-exec       reserved — v1 has no exec-class checks (accepted for CLI parity)
//   --self-check    validate the rule set's structural laws + coverage, then exit
// Exit: 1 iff a blocker FAILed (or, under --self-check, a malformed rule set). See README.md.
//
// This is the thin CLI; the runner lives in src/ (index → config → evaluate → tag → report).
// check.mjs, rules.json, rules/, and src/ are CO-LOCATED — invoke by absolute path, never
// copy this file away from them (it loads the rule set from its own directory, §10).
import path from 'node:path'
import { loadRules, runRules } from './src/engine.mjs'
import { indexRepo } from './src/repo.mjs'
import { resolveConfig, buildDefaults } from './src/config.mjs'
import { CHECK_KINDS, makeEvalCheck } from './src/evaluators.mjs'
import { makeColor, reportJson, reportHuman } from './src/report.mjs'
import { runSelfCheck } from './src/selfcheck.mjs'

const major = Number(process.versions.node.split('.')[0])
if (Number.isNaN(major) || major < 18) { console.error(`pipeline-skill requires Node ≥ 18 (found ${process.version})`); process.exit(2) }

const args = process.argv.slice(2)
const has = f => args.includes(f)
// value flag → its next token, unless that token is another flag (or absent) → `true` (a
// mistake the caller must catch, never String(true) into a path).
const optVal = f => { const i = args.indexOf(f); if (i < 0) return null; const v = args[i + 1]; return (v === undefined || v.startsWith('--')) ? true : v }
for (const f of ['--repo', '--config']) if (optVal(f) === true) { console.error(`check: ${f} needs a value`); process.exit(2) }

const JSON_OUT = has('--json')
const color = makeColor(JSON_OUT)
const RULES = loadRules()
const TYPES = RULES.project_types

// --self-check validates the RULE SET, not a target repo: build the config-key set from a
// stub repo (no filesystem walk) so it runs anywhere, even outside a repo.
if (has('--self-check')) {
  const DEFAULTS = buildDefaults({ FILES: [], match: () => [], read: () => null })
  process.exit(runSelfCheck({ RULES, TYPES, CHECK_KINDS, DEFAULTS, color }))
}

const REPO = path.resolve(typeof optVal('--repo') === 'string' ? optVal('--repo') : process.cwd())
const repo = indexRepo(REPO)
const { cfg, DESCRIPTOR, declaredTier, ACTIVE, FLAGS_ACTIVE, FLAGS_REASON } = resolveConfig(repo, {
  cliConfigPath: typeof optVal('--config') === 'string' ? optVal('--config') : null,
})
const evalCheck = makeEvalCheck({ repo, cfg, DESCRIPTOR, declaredTier })
const results = runRules({ rules: RULES.rules, cfg, ACTIVE, FLAGS_ACTIVE, FLAGS_REASON, declaredTier, evalCheck })

process.exit(JSON_OUT
  ? reportJson({ results, REPO, cfg, declaredTier, ACTIVE, HEAD: repo.HEAD, version: RULES.version })
  : reportHuman({ results, REPO, cfg, declaredTier, ACTIVE, HEAD: repo.HEAD, version: RULES.version, color }))
