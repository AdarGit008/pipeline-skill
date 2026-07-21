# Spec-Writer Manifest — pipeline-skill taxonomy lock (v0.1)

**Written:** SPEC.md · RULES.md · ARCHITECTURE.md · SKILL-DRAFT.md (all in `spec/`). Sources: plan-skeleton.md, the four research briefs, baseline-skill reference (read in full: SKILL.md, REFERENCE.md, rules.json, rules/build.json, rules/ops.json, rules/gov.json, rules/desc.json, config.example.json, templates/judgment.json, schema/record.judgment.schema.json, check-kind census across rules/*.json).

## Rule count per family (locked: 39 rules, 9 families)

| Family | Count | IDs |
|---|---|---|
| DESC — descriptor & declared posture | 3 | DESC-01..03 |
| BR — branching & PR workflow | 6 | BR-01..06 |
| CI — CI/CD pipeline stages | 6 | CI-01..06 |
| ENV — environment tiers | 6 | ENV-01..06 |
| IAC — infrastructure as code | 6 | IAC-01..06 |
| FLAG — feature flags (opt-in) | 3 | FLAG-01..03 |
| RB — rollback & recovery | 4 | RB-01..04 |
| HOT — hotfix & incident response | 4 | HOT-01..04 |
| GOV — the ledger itself | 1 | GOV-01 |

**Correction:** the skeleton claimed "33 candidate rules"; its own family tables enumerate 39. Locked at **39** (skeleton arithmetic was inconsistent).

## Severity distribution

- **blocker: 8 static** — DESC-02, CI-01, CI-02, CI-03, RB-01, IAC-01, IAC-06, GOV-01
- **+2 profile-escalated** (`severity_by_profile`: warning at team → blocker at critical) — BR-03, ENV-04
- **warning: 28** (all remaining mechanical rules)
- **sign-off (manual): 3** — ENV-05, RB-02, RB-04
- **Profile split (cumulative):** core/solo 11 · team +18 · critical +10. FLAG family opt-in at any tier.
- **Certainty:** deterministic 23 · heuristic 13 · judgment 3. Every blocker (incl. escalations) is deterministic — baseline's `blocker⇒deterministic` self-check law holds unchanged.

## Mechanical vs sign-off

- **36 rules have a mechanical check** (tree/history/forge/ledger planes). 3 of those compose a sign-off fallback via `any-of` (IAC-04 drift-watch, HOT-02 zero-hotfix-history, ENV-06 external-validation).
- **3 rules are pure sign-off ledger entries** (no mechanical component — the hard constraint working as designed): ENV-05 (staging data realism), RB-02 (rollback drills), RB-04 (recovery objective review).
- **2 machinery rules carry no external citation** (stated explicitly, not invented): DESC-02 (schema validity) and GOV-01 (ledger health) — precedent: baseline-skill itself. CI-05 cites GitHub's disabling-workflows doc via baseline OPS-07 (outside the four research angles; labeled).

## Claims dropped or downgraded for verification reasons

**Zero claims came back UNVERIFIED** — all 21 research questions sourced; nothing dropped for lack of a citation. Narrowed/downgraded (full table in RULES.md appendix):

1. ENV-03 "daily deploy to dev" → **narrowed** to "on merge / frequent" (no primary source for a daily deploy cadence).
2. IAC-01/03 "manual console changes prohibited" → **narrowed** to "flagged failure source / deviation" (strongest vendor wording is "best practice").
3. FLAG-01 kill-switch → MTTR → **downgraded to inference**; rationale claims "shortens the recovery path", cites no number.
4. Profile tiering (SPEC §2) → **reframed as the skill's design judgment** resting on DORA (whose anti-heavyweight-gating evidence is criticality-agnostic); policed by DESC-03.
5. HOT-04 "time-bounded" → kept, but sourcing reassigned to baseline's `review_by` ledger precedent (NIST AC-2(2) covers emergency *accounts*, not bypass *events*).
6. RB-04 "substitute for gating at low failure cost" → **narrowed** to measure-and-review (error budget / FDRT).
7. ENV-05 staging data realism → kept sign-off-only with the data-pipeline context of the SRE Workbook quote labeled.
8. CI-06, ENV-06 critical-hardening (skeleton §3.2) → **NOT locked**: heuristic checks can't satisfy blocker⇒deterministic; BR-03/ENV-04 (deterministic) carry the hardening instead.
9. BR-02's DORA-2023 code-review quote → kept with honesty label (search-snippet-verified; re-fetch PDF if it ever becomes load-bearing).
10. NIST quotes (CM-3, AC-3(10)) → kept with verification labels (final PDF not text-extractable; control statements confirmed against nist.gov-hosted draft markup + csf.tools mirror).

## Never-minted candidates (sourced but out of v1 scope/YAGNI)

- **HOT-05 observability/alerting** — no at-rest enforcement path; folded into HOT-03 rationale + ENV-06/RB-02 sign-off residue (research D7).
- **Canary/progressive-delivery rule** — citations parked in RULES.md appendix for a future critical-tier candidate.
- **Small-batch rule** — history heuristic at best; used as HOT-01/BR-05 rationale (research D8).
- **Multi-region family, org-process family** — hard scope exclusions (not sourcing failures).

## Locked resolutions a reviewer should verify (RULES.md §Locked resolutions)

- **R1:** CI-02/CI-03 certainty locked `deterministic` (skeleton said heuristic) by scoping claims to presence/absence over checked-in pipeline definitions, with documented `risk-acceptance`/`deviation` escapes. Preserves the blocker severity the research mandates without breaking the engine law.
- **R2:** CI-06/ENV-06 stay warnings at all tiers (downgrade of skeleton's critical hardening).
- **R3:** IAC-06 narrowed to deterministic signature tier + tfvars checks (blocker stays, law holds; entropy heuristics remain baseline SEC's).
- **R4:** DESC-03 locked at profile `all` (skeleton table said `team`; §3.1's own solo-tier example requires core activation). One-field change if reviewer disagrees. Tier counts reflect it: core 11 / team 18 / critical 10.
- **D1–D5 locked:** sibling repo `pipeline-skill/` ✓ · reconcile deferred to v1.1 ✓ · applies_to `{service,app,library,docs,infra}` ✓ · `severity_by_profile` engine map (only BR-03, ENV-04) ✓ · no CONTRACT.md in v1 ✓.
- **D6 RESOLVED (2026-07-20, orchestrator):** `dev-ops.txt` was renamed to `wisdom.txt` by the user mid-run — same file, same content. The spec writer's provenance note was accurate, not a hallucination; SPEC.md updated to mark the resolution.

## Review fixes applied (2026-07-20, parent synthesis)

Citation review (36/36 VERBATIM, 48/48 URLs reachable) and architecture review (buildable) both landed; applied:
- **Arch blockers:** (1) `branches` descriptor field added (RULES.md DESC preamble + ARCHITECTURE §4.4 schema + SKILL-DRAFT) — consumed by BR-04/ENV-03/HOT-02; (2) descriptor schema JSON written out as ARCHITECTURE §4.4 + stale file-map cross-ref repointed.
- **Citation fixes:** BR-06 nvie annotated canonical-origin (GitLab corroboration cross-referenced) · BR-02 heavyweight-approval contrast now backed by its own SOURCE (DORA change-approval capability added) · FLAG-02 Fowler annotated canonical-reference class · CI-05 scope note added (60-day auto-disable = scheduled workflows, public repos; check is scope-agnostic).
- **Precision gaps 1–5:** BR-03 comparand via `required_check_names` config (heuristic derivation fallback) · CI-02 bare `build` dropped from the test pattern · ENV-01 PASS condition stated exactly (set equality, symmetric difference FAILs) · DESC-03 observed-level mapping defined · HOT-04 Rule-Insights cross-ref behind a capability probe (`forge: not consulted` on absence).
- **Notes 6–12:** plan-gated forge features preamble bullet · IAC-02 per-tool state markers enumerated · FLAG-01 `source_globs` defaults enumerated (+ config key) · FLAG-02 empty-registry WARN behavior · SPEC §5 README over-promise reworded (baseline README note = follow-up) · `json-field` marked completeness-only · `jdg new` date-comparand authoring clause added.

## Sourcing discipline

Every SOURCE line in RULES.md is a verbatim quote + URL copied from the four research briefs — no citation invented, none written from memory. Machinery rules (DESC-02, GOV-01) and the baseline lift (CI-05) are explicitly labeled as such instead of being dressed in external citations.
