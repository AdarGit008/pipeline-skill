#!/usr/bin/env node
// The pipeline-skill CLI — the unified entry point. Routes subcommands:
//   check   score a repo's delivery posture (the default; delegates to the intact check.mjs,
//           so CI and any driver can keep invoking check.mjs directly)
//   jdg     author / evaluate the judgment ledger (new|check — sign-offs, deviations,
//           risk-acceptances, break-glass)
//   help    usage
// Zero-dependency. pipeline.mjs / check.mjs / rules.json / rules/ / src/ are co-located —
// invoke by absolute path (§10). Requires Node ≥ 18 and git; gh optional (forge rules SKIP
// labeled offline).
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const major = Number(process.versions.node.split('.')[0])
if (Number.isNaN(major) || major < 18) { console.error(`pipeline-skill requires Node ≥ 18 (found ${process.version})`); process.exit(2) }

const HERE = path.dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
// A leading non-flag token is the subcommand; a leading --flag (or nothing) means `check`,
// so `pipeline --repo x` stays equivalent to `check.mjs --repo x`. --help/-h reaches help.
const cmd = (argv[0] === '--help' || argv[0] === '-h') ? 'help'
  : (argv[0] && !argv[0].startsWith('-')) ? argv[0] : 'check'
const rest = (argv[0] === cmd) ? argv.slice(1) : argv

if (cmd === 'check') {
  // delegate to the intact checker CLI, inheriting its exit code (blocker FAIL → 1).
  try { execFileSync(process.execPath, [path.join(HERE, 'check.mjs'), ...rest], { stdio: 'inherit' }) }
  catch (e) { process.exit(e.status ?? 1) }
  process.exit(0)
} else if (cmd === 'jdg') {
  const { runJdg } = await import('./src/jdg.mjs')
  process.exit(runJdg(rest))
} else if (cmd === 'help') {
  console.log(`pipeline <command> [options]

  check [--repo DIR] [--config FILE] [--json] [--no-exec]   score a repo's delivery posture (default)
  check --self-check                                        validate the rule set's structural laws + coverage
  jdg new --kind K --subject S --reason "..."               record a judgment (sign-off · deviation ·
      --review-by DATE [--gate "scope"] [--expect p=v]      risk-acceptance · break-glass); date-valued
      [--tripwire "fact op value"]                          tripwire comparands resolve to literals at authoring
  jdg check [--repo DIR] [--json] [--today DATE]            evaluate the ledger: tripwires · expiry · drift
      [--facts FILE]                                        (exit 1 on tripped/expired/invalid)
  help                                                      this message

  Run \`pipeline\` with no command (or a leading --flag) to score, e.g. \`pipeline --repo .\`.
  Invoke by absolute path; requires Node ≥ 18 and git (gh optional — forge rules SKIP labeled offline).`)
  process.exit(0)
} else {
  console.error(`pipeline: unknown command '${cmd}' (try: check, jdg, help)`)
  process.exit(2)
}
