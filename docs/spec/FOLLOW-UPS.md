# Build-session follow-ups (from spec-session reviews, 2026-07-20)

Carry these into the build session; none block the build start.

1. **Baseline README sibling note** — SPEC.md §5 promises a cross-reference note in baseline-skill's README ("two lenses, not two competing copies"). That repo is outside this build; tracked here as a follow-up task on AdarGit008/baseline-skill.
2. **BR-02 DORA 2023 PDF** — citation is search-snippet-verified (label in the rule). Re-fetch the full PDF if the citation ever becomes load-bearing (severity upgrade, dispute).
3. **HOT-04 Rule Insights endpoint** — verify at build time whether a public REST endpoint exists for ruleset bypass insights; the cross-ref is behind a capability probe either way (`forge: not consulted` on absence). If none exists, demote to a documented manual step in REFERENCE.md.
4. **Templates + REFERENCE/GLOSSARY content** — `templates/hotfix.md`, `templates/incident-response.md`, `templates/runbook-rollback.md`, `templates/flag.json`, REFERENCE.md, GLOSSARY.md are referenced in the spec but authored at build time (from rule FIX fields + baseline's structure).
5. **NIST final-PDF quotes (CM-3, AC-3(10))** — verbatim-confirmed via csrc.nist.gov draft markup + csf.tools mirror (labels in rules); final PDF was not text-extractable in the research pipeline. Re-verify if NIST publishes an extractable revision.
6. **Flag registry zero-records behavior** — FLAG-02 WARNs `flag registry empty` when opt-in is active with zero records; mirror baseline's claims-field zero-records behavior at build time (check baseline `rules/claim.json`).
