# Baseline scorecard — pipeline-skill (2026-07-20, post-spec scaffold)

Scored with baseline-skill v2 (90 rules): **0 blockers · 6 pass · 7 warn · 1 sign-off · 74 n/a — readiness 43% (6/14 applicable)**.
This list is the build session's readiness TODO; work it alongside the spec build.

- [ ] SEC-05 — add dependabot/renovate config (`.github/dependabot.yml`)
- [ ] SEC-06 — add `SECURITY.md` with a reporting channel
- [ ] GOV-03 — add `.github/CODEOWNERS` naming an owner
- [ ] COMM-02 — README newcomer-critical sections (install/usage once `check.mjs` exists)
- [ ] COMM-03 — `CHANGELOG.md` with an Unreleased section
- [ ] CTX-03 — declare `sources_of_truth` in `baseline.config.json`
- [ ] CTX-04 — sign-off: no frozen/consolidated doc without banners (ledger entry)
- [ ] DESC-01 — add `baseline.repo.json` descriptor (posture preset: `readiness-only` or `docs` — the repo is a zero-dep docs/distribution repo like baseline-skill itself)

Notes: workflow-contract families (FLOW/DIV/lane) correctly SKIP — pipeline-skill adopts baseline's readiness posture, not its lane workflow. Re-score after the build session lands the file map (ARCHITECTURE.md §2); target stays 0 blockers, readiness rising as applicable rules grow.
