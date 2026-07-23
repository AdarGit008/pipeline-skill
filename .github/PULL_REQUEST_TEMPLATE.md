<!--
Thanks for contributing! Keep the change focused and see CONTRIBUTING.md.
Security fix? Coordinate privately first — see SECURITY.md.
-->

## What & why

<!-- What does this change do, and what problem/issue does it address? -->

Closes #

## Type of change

- [ ] Bug fix (evaluator / CLI / scorecard behavior)
- [ ] Rule data (new rule, or a taxonomy/profile/certainty change)
- [ ] Docs (SPEC / RULES / REFERENCE / SKILL / GLOSSARY)
- [ ] Tooling / CI
- [ ] Other:

## Checklist

- [ ] `node check.mjs --self-check` passes (exit 0)
- [ ] `node --test` passes
- [ ] `node check.mjs --repo .` is **0 blockers**
- [ ] Added/updated a test for the behavior change (if any)
- [ ] Updated `CHANGELOG.md` under `## [Unreleased]`
- [ ] If the taxonomy changed: `docs/spec/RULES.md`, `test/selfcheck.test.mjs` pins, and `rules.json` `version` are in sync
- [ ] No new runtime dependency (Node stdlib only)
