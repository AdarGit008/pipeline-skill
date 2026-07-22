# Changelog

All notable changes to pipeline-skill. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); versions track `rules.json`.

## [0.1.0] — 2026-07-22

First implementation of the locked v0.1 spec: **39 rules across 9 families**
(DESC, BR, CI, ENV, IAC, FLAG, RB, HOT, GOV), a zero-dependency Node ≥ 18 engine,
the judgment ledger, both CLIs, and a self-gating CI job.

### Added
- **Engine** — `src/{repo,config,validate,evaluators,engine,jdg,report,selfcheck}.mjs`:
  the gate → evaluate → tag funnel, 24 check kinds, crash-resilient degradation to a
  labeled SKIP, and the blockers-first scorecard (`--json` for machine output).
- **CLIs** — `check.mjs` (score a repo · `--self-check` · `--json`) and `pipeline.mjs`
  (`check` · `jdg new|check` · `help`).
- **Judgment ledger** — `records/judgments/JDG-NNNN.json` with `sign-off` · `deviation` ·
  `risk-acceptance` · `break-glass` kinds; `pipeline jdg` authors and evaluates it, and
  GOV-01 runs that evaluator in-check.
- **Scaffolding** — `templates/`, `config-presets/{solo,team,critical}.repo.json`,
  `config.example.json`, and the agent/human docs (`SKILL.md`, `REFERENCE.md`, `GLOSSARY.md`).
- **Tests + CI** — `test/` (`node --test`, zero-dep) and `.github/workflows/ci.yml`, which
  runs `--self-check`, the unit tests, and a `check.mjs --repo .` self-score on every PR.

### Deliberate engine deltas vs baseline-skill (ARCHITECTURE §7)
1. **`severity_by_profile`** — an optional per-rule map resolved at tag time; the one
   functional engine change. v1 users: **BR-03, ENV-04** (`warn` at team → `blocker` at
   critical). `--self-check` law: an escalation to `blocker` requires `certainty: deterministic`.
2. **Profiles are failure-cost tiers** (`core`/`team`/`critical`), declared in the descriptor
   rather than via a `--profile` flag.
3. **Delivery-shaped `project_types`** — `{service, app, library, docs, infra}`; the
   descriptor's `type` supersedes auto-detection.
4. **Ten new check kinds + a `forge-protection` parameter extension**; the reused kinds keep
   baseline semantics.
5. **Free-form `gate`** on break-glass judgments — v1 has no admit/reconcile gates.
6. **No CONTRACT.md, no reconcile mode** — the CLI surface is `check` + `jdg` + `--self-check`.
7. **A `ledger` plane** joins baseline's `tree|history|forge` plane vocabulary (GOV-01,
   HOT-04, the sign-off rules).
