// Repo index + read + git helpers — the at-rest tree and git-history seam.
// Everything the evaluators (chunk #4) learn about the target repo flows through here.
// Zero-dependency; git is required on PATH, gh is not (forge reads live in evaluators).
// Small helpers (globToRe/asArr/parseDate/getPath) are inlined here rather than in a
// util.mjs (ARCHITECTURE §2's src map has none) and re-exported for the evaluators.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

// ---- inlined helpers (ported from baseline src/util.mjs) ----
export const asArr = v => v == null ? [] : Array.isArray(v) ? v : [v]
export const parseDate = s => { const d = new Date(s); return isNaN(d) ? null : d }
export const getPath = (obj, dotted) => String(dotted).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
// glob → anchored RegExp. `**` crosses `/`, `*` does not; adjacent identical quantifiers
// collapse (catastrophic-backtracking fuel, same set). Ported verbatim from baseline.
export function globToRe(g) {
  let re = ''
  const push = frag => { if ((frag === '.*' || frag === '[^/]*') && re.endsWith(frag)) return; re += frag }
  for (let i = 0; i < g.length; i++) {
    const c = g[i]
    if (c === '*') { if (g[i + 1] === '*') { push('.*'); i++; if (g[i + 1] === '/') i++ } else push('[^/]*') }
    else if (c === '?') re += '.'
    else if ('/.+^${}()|[]\\'.includes(c)) re += '\\' + c
    else re += c
  }
  return new RegExp('^' + re + '$')
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.turbo', 'coverage', '.next', '__pycache__', 'vendor', '.venv', 'venv'])

function walk(dir, base = dir, out = []) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of ents) {
    if (SKIP_DIRS.has(e.name)) continue
    const full = path.join(dir, e.name)
    const rel = path.relative(base, full).split(path.sep).join('/')
    if (e.isDirectory()) walk(full, base, out)
    else out.push(rel)
  }
  return out
}

export function indexRepo(REPO) {
  const FILES = walk(REPO)
  // literal argv (execFileSync, no shell) — filenames/refs are never interpolated into a
  // shell string. Every git helper is crash-resilient: unreadable → null/[]/false, never throw.
  const git = (args, { max = 64 * 1024 * 1024 } = {}) => {
    try { return execFileSync('git', args, { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: max }).toString('utf8') }
    catch { return null }
  }

  // git-tracked set (for tracked_only checks); null when not a git repo. -z keeps
  // non-ASCII names literal so they match the fs-walked FILES spelling.
  let TRACKED = null
  { const out = git(['ls-files', '-z']); if (out != null) TRACKED = new Set(out.split('\0').filter(Boolean)) }
  const HEAD = (git(['rev-parse', '--short', 'HEAD']) || '').trim() || null
  // current branch; detached HEAD → null (a CI checkout / bisect is not a branch)
  const _b = (git(['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim()
  const BRANCH = (_b && _b !== 'HEAD') ? _b : null

  // match globs against the repo, with optional tracked-only, allow (exclude) and exclude_globs
  function match(globs, { tracked = false, exclude = [], excludeGlobs = [] } = {}) {
    const pool = (tracked && TRACKED) ? [...TRACKED] : FILES
    const res = asArr(globs).map(globToRe)
    const exRes = [...asArr(exclude), ...asArr(excludeGlobs)].map(globToRe)
    return pool.filter(f => res.some(r => r.test(f)) && !exRes.some(r => r.test(f)))
  }
  const read = rel => { try { return fs.readFileSync(path.join(REPO, rel), 'utf8') } catch { return null } }
  // content scanning: skip large / binary files
  function readText(rel) {
    try {
      const full = path.join(REPO, rel)
      if (fs.statSync(full).size > 512 * 1024) return null
      const buf = fs.readFileSync(full)
      if (buf.includes(0)) return null
      return buf.toString('utf8')
    } catch { return null }
  }
  // raw read for secret scans: DO NOT skip large/binary — a committed secret hides in either
  function readRaw(rel) {
    try { const full = path.join(REPO, rel); if (fs.statSync(full).size > 8 * 1024 * 1024) return null; return fs.readFileSync(full, 'latin1') } catch { return null }
  }

  // ---- git-plane helpers used by the history/forge evaluators (chunk #4) ----
  const tags = () => { const o = git(['tag', '-l']); return o == null ? null : o.split('\n').map(s => s.trim()).filter(Boolean) }
  // remote heads (BR-04/HOT-02); null when offline/no remote so the evaluator degrades to localHeads(), labeled.
  const lsRemoteHeads = () => {
    const o = git(['ls-remote', '--heads'])
    if (o == null) return null
    return o.split('\n').map(l => l.split('\t')[1]).filter(Boolean).map(r => r.replace(/^refs\/heads\//, ''))
  }
  const localHeads = () => {
    const o = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes'])
    return o == null ? null : o.split('\n').map(s => s.trim()).filter(Boolean)
  }
  // ISO committer date of a ref (branch tip / sha); null if unresolved.
  const commitISO = ref => { const o = git(['log', '-1', '--format=%cI', ref]); return o == null ? null : (o.trim() || null) }
  const firstCommitISO = () => { const o = git(['log', '--reverse', '--format=%cI', '--max-parents=0']); return o == null ? null : (o.split('\n')[0]?.trim() || null) }
  // exit status of `git merge-base --is-ancestor a of`: 0 = ancestor, 1 = not, null = unresolvable.
  const isAncestor = (a, of = 'HEAD') => {
    try { execFileSync('git', ['merge-base', '--is-ancestor', a, of], { cwd: REPO, stdio: 'ignore' }); return 0 }
    catch (e) { return e.status === 1 ? 1 : null }
  }
  const gitObjExists = ref => { try { execFileSync('git', ['cat-file', '-e', ref], { cwd: REPO, stdio: 'ignore' }); return true } catch { return false } }
  const gitCatFile = (ref, rel) => git(['cat-file', 'blob', `${ref}:${rel}`], { max: 256 * 1024 * 1024 })

  return {
    REPO, FILES, TRACKED, HEAD, BRANCH,
    match, read, readText, readRaw,
    git, tags, lsRemoteHeads, localHeads, commitISO, firstCommitISO, isAncestor, gitObjExists, gitCatFile,
  }
}
