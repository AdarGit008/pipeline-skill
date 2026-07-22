// Shared test scaffolding — zero-dependency, node:test only. This file exports helpers and
// registers NO tests, so the `node --test` discovery that loads every test/*.mjs treats it as
// an empty (0-test) file. Nothing here runs at import time except function definitions.
//
// Two ways to get a target repo:
//   mkRepo(t, { files, gitInit, date })  — a real tmp dir (indexRepo walks it), optional git.
//   the returned api.index()             — a fresh repo index (re-walk after mutations).
// Plus process spawners for the CLIs (runCheck / runPipeline) and small fixture builders.
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { indexRepo } from '../src/repo.mjs'

// repo root — where check.mjs / pipeline.mjs / rules.json live.
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function writeFiles(dir, files) {
  for (const [rel, content] of Object.entries(files || {})) {
    const abs = path.join(dir, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n')
  }
}

// deterministic git identity + clock so history-plane fixtures are reproducible.
const gitEnv = date => ({
  ...process.env,
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid',
  GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date,
})
const rawGit = (dir, args, date) =>
  execFileSync('git', args, { cwd: dir, env: gitEnv(date), stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8')

// mkRepo(t, opts) — a throwaway repo under the OS temp dir, auto-removed after the test.
export function mkRepo(t, { files = {}, gitInit = false, date = '2026-01-01T00:00:00Z' } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), 'pipeline-test-'))
  if (t && typeof t.after === 'function') t.after(() => { try { rmSync(dir, { recursive: true, force: true }) } catch {} })
  writeFiles(dir, files)
  if (gitInit) {
    rawGit(dir, ['init', '-q', '-b', 'main'], date)
    rawGit(dir, ['add', '-A'], date)
    rawGit(dir, ['commit', '-q', '-m', 'init', '--allow-empty'], date)
  }
  return {
    dir,
    index: () => indexRepo(dir),                                   // fresh index (re-walk)
    git: (args, d = date) => rawGit(dir, args, d),
    write: more => writeFiles(dir, more),
    commit: (msg = 'c', d = date) => { rawGit(dir, ['add', '-A'], d); rawGit(dir, ['commit', '-q', '-m', msg, '--allow-empty'], d) },
  }
}

// spawn a CLI by absolute path; returns { status, stdout, stderr } (never throws on non-zero).
export function runNode(scriptRel, args = [], { cwd = ROOT } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [path.join(ROOT, scriptRel), ...args], { cwd, encoding: 'utf8' })
    return { status: 0, stdout, stderr: '' }
  } catch (e) {
    return { status: e.status ?? 1, stdout: (e.stdout || '').toString(), stderr: (e.stderr || '').toString() }
  }
}
export const runCheck = (args, opts) => runNode('check.mjs', args, opts)
export const runPipeline = (args, opts) => runNode('pipeline.mjs', args, opts)

// a complete-enough rule object for engine unit tests (defaults are self-check-legal).
export function rule(o = {}) {
  return {
    id: 'GOV-99', title: 'test rule', category: 'gov', severity: 'warn', applies_to: 'all',
    sources: ['tree'], on_unreachable: 'skip', contexts: ['check'], certainty: 'heuristic',
    check: { kind: 'noop' }, ...o,
  }
}

// an evalCheck stub keyed by rule id → { ok, detail } (engine tests inject verdicts).
export function stubEval(byId = {}) {
  return (_check, r) => (r.id in byId ? byId[r.id] : { ok: null, detail: 'no stub' })
}

// run fn with console.log/error captured; returns { ret, out }. Keeps CLI/self-check noise
// out of the test log and lets a test assert on printed text when it needs to.
export function captureLog(fn) {
  const orig = { log: console.log, error: console.error }
  const lines = []
  console.log = (...a) => lines.push(a.map(String).join(' '))
  console.error = (...a) => lines.push(a.map(String).join(' '))
  try { const ret = fn(); return { ret, out: lines.join('\n') } }
  finally { console.log = orig.log; console.error = orig.error }
}

// a valid descriptor load-result ({ present, valid, data, errors }) for evaluator tests.
export const descriptorResult = (data, { present = true, valid = true, errors = [] } = {}) =>
  ({ present, valid, data, errors })

// a minimal "clean, delivery-ready docs repo" file set — 0 blockers at solo/docs.
export const CLEAN_DOCS_REPO = {
  'pipeline.repo.json': { type: 'docs', profile: 'solo', branching_model: 'trunk', default_branch: 'main' },
  'RUNBOOK.md': '# Runbook\n\n## Rollback\n\nTo revert a bad release, `git revert` the deploy commit and redeploy the previous version.\n',
  'README.md': '# fixture\n',
}
