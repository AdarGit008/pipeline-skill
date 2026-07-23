# Contributing to pipeline-skill

Thanks for helping improve **pipeline-skill** — the zero-dependency delivery-operations
checker. This guide covers how to build, test, and land a change. It's short by design;
the repo is small and the rules are data.

## Ground rules

- **Zero dependencies.** The runtime is Node's standard library only — no `npm install`,
  no lockfile, no third-party packages. A change that adds a runtime dependency will not
  be merged. (The one exception is a SHA-pinned GitHub Action in CI.)
- **Node ≥ 18** and `git` on `PATH`. `gh` is optional — the forge-reading rules degrade to
  a labeled `SKIP` when it is absent or unauthenticated.
- **Rules are data.** A rule lives in `rules/<family>.json` as a JSON object (see
  `docs/spec/ARCHITECTURE.md` §3 for the field contract); the engine and evaluators are
  generic. Prefer adding/adjusting rule data over adding code.

## Local setup

```sh
git clone git@github.com:AdarGit008/pipeline-skill.git
cd pipeline-skill
node check.mjs --self-check     # validate the rule set's structural laws + coverage
node --test                     # run the full unit suite (zero-dep node:test)
node check.mjs --repo .         # self-score this repo (must be 0 blockers)
```

## The three gates a PR must pass

CI runs exactly these on every push and pull request (`.github/workflows/ci.yml`):

1. `node check.mjs --self-check` — a malformed rule set can't merge.
2. `node --test` — the engine, config, evaluators, ledger, self-check, and CLI suites.
3. `node check.mjs --repo .` — the standard checks its own repo; **exit 1 on any blocker**.

Run all three locally before opening a PR. A secret-scan gate (gitleaks) also runs in CI.

## Making a change

1. **Open (or claim) an issue** describing the change and its motivation.
2. **Branch off `main`** — `git checkout -b <type>/<short-topic>` (e.g. `fix/rb-01-gating`,
   `docs/glossary`). Don't commit to `main` directly.
3. **Keep the change focused** and match the surrounding style. If you touch a rule's
   taxonomy (id, family, profile, certainty), update `docs/spec/RULES.md`, the self-check
   pins in `test/selfcheck.test.mjs`, and bump `rules.json`'s `version`.
4. **Add or update a test** in `test/` for any behavior change — the suite is the
   regression guard.
5. **Update `CHANGELOG.md`** under `## [Unreleased]`.
6. **Commit** with a [Conventional Commits](https://www.conventionalcommits.org/) subject
   (`fix(rb-01): …`, `docs(spec): …`, `build(engine): …`) — it's what the history uses.
7. **Open a PR into `main`.** Fill in the template; link the issue.

## Judgment calls (the ledger)

Some rules resolve through a dated human sign-off rather than a hard pass/fail. Author one
with the CLI — never hand-fabricate an agent rubber-stamp:

```sh
node pipeline.mjs jdg new --kind sign-off --subject RB-02 \
  --reason "quarterly rollback drill ran green" --review-by 2026-10-01
node pipeline.mjs jdg check     # exit 1 on any tripped / expired / invalid record
```

Records live in `records/judgments/JDG-NNNN.json`, one owned file each. Every judgment is
dated, attributed to a person, and expires (`review_by`).

## Reporting bugs & security issues

- **Bugs / feature ideas:** open an issue using the templates in `.github/ISSUE_TEMPLATE/`.
- **Security vulnerabilities:** do **not** open a public issue — follow
  [`SECURITY.md`](SECURITY.md) (private GitHub security advisory).

## Code of conduct

Participation is governed by the [Contributor Covenant](CODE_OF_CONDUCT.md). By taking part
you agree to uphold it.
