# pipeline-skill — Product Spec

**Status: LOCKED (taxonomy v0.1).** Rule IDs are frozen from this point — never renumber. This document is the vision/scope lock; the rule catalog lives in `RULES.md`, the repo design in `ARCHITECTURE.md`, the agent surface in `SKILL-DRAFT.md`.

**Provenance:** the brief named `/Users/adaramir/context.md` and `projects/dev-ops/dev-ops.txt`; neither exists. `wisdom.txt` (cross-checked against `ideas.txt` and `insights.txt`) is the structured summary of the same enterprise-delivery source material and was used as the primary philosophy source (decision D6 **resolved** 2026-07-20: `dev-ops.txt` was renamed to `wisdom.txt` mid-session — same file, same content; no content gap). Baseline conventions were read in full from `/tmp/pi-github-repos/AdarGit008/baseline-skill/`. Every practice claim in the rule catalog is gated on a primary-source citation returned by the four research briefs in `spec/research/`; the lock resolutions are listed in `RULES.md` §Locked resolutions and §Dropped & downgraded candidates.

---

## 1. Vision

**pipeline-skill is a testable delivery-operations standard**: a zero-dependency Node checker that scores a repo's *delivery posture at rest* — branching & PR workflow, CI/CD pipeline stages, environment tiers, infrastructure as code, feature flags, rollback & recovery, hotfix & incident flow — against **39 rules in 9 families**, each backed by a mechanical check or a dated sign-off ledger entry. Blockers fail CI (`exit 1`); the judgment calls a script can't make resolve via the ledger, so even those leave a checkable trace.

The throughline is inherited from its sibling: *don't trust a written promise — make something check it.* A delivery-practices doc drifts; this is the delivery checklist as an exit code.

Where baseline answers *"is this repo ready to build and maintain?"*, pipeline-skill answers *"can this repo ship, recover, and prove it?"* — calibrated to how much a failure would cost.

## 2. Philosophy — complexity scales with failure cost

The source material states the governing principle directly:

> "If you can avoid deferring all this complexity do so and then only start adding in complexity as you find it needed."
> "Instead of doing all the work I just described just get good at fixing bugs right when you deploy a new feature if a user says that something's broken get good at deploying a fix within 30 minutes."
> "If you're working on actually like Health Care Systems or something and if you have three days of downtime because you broke people's insurance that could have huge impacts on people's lives."

— `wisdom.txt` (QUOTES), the enterprise-delivery source

Delivery complexity is a **risk-management choice, not a universal engineering requirement** (`wisdom.txt` INSIGHTS). The same source walks both postures: a startup shipping directly from main with automated deploys and fast fixes, and a healthcare-grade system with gated staging→prod promotion, pre-production data, and hotfix discipline. Neither is wrong; each is wrong *for the other's failure cost*.

pipeline-skill mechanizes this. The repo declares its failure cost once, in a machine-readable descriptor (`pipeline.repo.json → "profile": "solo" | "team" | "critical"`), and the checker holds the repo to **exactly that much process — no more, no less**:

- **solo** — the pipeline must exist, be automated, be alive; rollback must be documented. No required review, no staging mandate, no IaC mandate. The standard refuses to nag a solo dev about process whose failure cost doesn't justify it.
- **team** — PR review, branch protection, declared environments with automated deploy paths, IaC instead of console-clicking, a documented hotfix path. Everything here is mechanically checkable; this tier is the checker's home turf.
- **critical** — gated prod promotion, staging realism, rollback *drills*, drift detection, break-glass accounting. This tier carries the bulk of the sign-off surface, deliberately: at high failure cost the honest answer to "is your staging data realistic?" is a dated human judgment, not a script's guess.

**Honest anchoring (research narrowing, flags-rollback brief §5).** DORA's evidence for lightweight-over-heavyweight process is *criticality-agnostic*:

> "Traditionally, these goals have been met through a heavyweight process involving approval by people external to the team proposing the change: a change advisory board (CAB) or a senior manager. However, DORA's research shows that these approaches have a negative impact on software delivery performance. Further, no evidence was found to support the hypothesis that a more formal, external review process was associated with lower change fail rates."
> — DORA, *Capabilities: Streamlining change approval* — https://dora.dev/capabilities/streamlining-change-approval/

> "DORA's research has repeatedly demonstrated that speed and stability are not tradeoffs. In fact, we see that the metrics are correlated for most teams. Top performers do well across all five metrics, and low performers do poorly."
> — DORA, *DORA's software delivery performance metrics* — https://dora.dev/guides/dora-metrics/

So: the *solo posture* (lightweight process + automation + fast recovery is not a stability compromise) is research-anchored. The *tiering by declared failure cost* — that critical systems warrant more gating — is **the skill's own design judgment**, resting on DORA rather than derived from it. That judgment is itself policed by the checker: DESC-03 (the inverse-nag) fires when observed complexity outruns the declared tier or the declaration outruns reality, and a disagreement resolves as a dated `deviation` judgment, not a silent exception.

## 3. Scope

### IN (locked)
Six delivery-operations domains, expressed as nine rule families:

| Domain | Families |
|---|---|
| Declared delivery posture | `DESC` (descriptor & profile consistency) |
| Branching & PR workflow | `BR` |
| CI/CD pipeline stages | `CI` |
| Environment tiers (dev/staging/prod) | `ENV` |
| Infrastructure as code | `IAC` |
| Feature flags & fast rollback | `FLAG`, `RB` (rollback & recovery) |
| Hotfix flow & incident response | `HOT` |
| The sign-off ledger itself | `GOV` |

Plus the profile system (`solo`/`team`/`critical`) that expresses "complexity only when failure cost justifies it".

### OUT (hard exclusions — no rule family may smuggle these in)
- **Multi-region / data-residency / active-active.** The source's multi-region and data-sovereignty material is explicitly out of scope; no family exists for failover, region pinning, or residency.
- **Enterprise org & team process.** No rules about scrum masters, standups, pairing/mob, demos, client feedback loops, or cross-team coordination.
- **Runtime & cloud-plane truth.** The checker observes a repo *at rest* (tree, git history, forge API). It can never see actual infra, actual staging data, actual flag states, or actual MTTR. It checks that *mechanisms and declarations* exist; everything else is a sign-off ledger entry. This is the honest boundary, not a gap.
- **Anything baseline already owns** (see §5).

## 4. Non-goals

1. **Not a language/build standard.** Build/test/lint/secrets-supply-chain/reproducibility rules are baseline's domain. pipeline-skill never re-asserts them (see §5 overlap control).
2. **Not a YAML parser.** Zero-dependency means no YAML library; all CI-workflow analysis is line/regex scanning (baseline's own convention). Structural workflow claims are labeled `heuristic`; presence/absence claims are `deterministic`.
3. **Not an observability platform.** Alerting quality is unverifiable at rest (research angle (d), claim D7) — it appears as rationale text and sign-off residue, never as a minted tree-checkable rule.
4. **Not a deployment tool.** The checker verifies deploy automation exists; it does not deploy.
5. **Not a canary/progressive-delivery enforcer.** Sourced, but no rule in v1 demands canarying; the citations are parked in `RULES.md` appendix for a future critical-tier candidate.
6. **Not a fork of baseline.** Sibling project, separate repo, installable alongside (§5).
7. **v1 has no cron/reconcile mode and no CONTRACT.md.** `check` + `jdg` + `--self-check` only (decisions D2, D5 — both deferred to v1.1).

## 5. Relationship to baseline-skill

**Sibling, not fork. Installable alongside.**

- **Separate repo** (`pipeline-skill/`, sibling of `baseline-skill/`), separate rule set, separate descriptor (`pipeline.repo.json` vs `baseline.repo.json`), shared ledger format (the judgment record schema is field-identical, so one `records/judgments/` tree serves both checkers — each evaluates the subjects it knows).
- **Architecture imitated, not imported.** Rules-as-data (`rules.json` manifest + one module per family), gate→evaluate→tag engine, verdicts PASS/FAIL/WARN/SIGN-OFF/SKIP, blocker FAIL → exit 1, sign-off ledger, profiles machinery, `--self-check`, score/init/fix/explain modes. pipeline-skill re-implements this shape in its own zero-dependency codebase; the two skills share *conventions*, not code. Deliberate engine deltas are few and documented in `ARCHITECTURE.md` §7.
- **Overlap control.** Three pipeline rules sit adjacent to baseline rules:
  - **IAC-06** (secrets in IaC files) vs baseline SEC — pipeline's rule is strictly narrower (IaC globs only, deterministic signature tier only) and its rationale cross-references baseline's SEC family rather than restating it.
  - **RB-01 / HOT-03** (rollback section / incident doc) vs baseline OPS-05 (generic runbook) — pipeline's checks are deploy-failure-scoped (revert/redeploy-previous steps; who-to-page escalation), a tighter lens on the same artifact class.
  - A repo running both skills gets two lenses, not two competing copies. pipeline's README says so; the sibling note in baseline's README is a tracked follow-up, not part of this build.
- **Different axis.** Baseline's profiles encode *how expert* a repo is (`core/service/advanced`); pipeline's encode *declared failure cost* (`solo/team/critical`). Baseline's `project_types` are language-shaped (`node/python/service/library/docs`); pipeline's are deployment-shaped (`service/app/library/docs/infra`). Same machinery, different semantics — `ARCHITECTURE.md` §4.

## 6. Profile tiers — activation map (locked)

Tiers are **cumulative**: `core` ⊂ `team` ⊂ `critical`. Declaring `solo` activates core only; `team` activates core+team; `critical` activates everything. Off-tier rules SKIP as `n/a` and never count against readiness.

| Tier | Active rules (39 total) | Posture (source-anchored) |
|---|---|---|
| **solo** (core, 11) | DESC-01/02/03 · BR-06 · CI-01/02/03/05 · RB-01 · FLAG-01 (opt-in) · GOV-01 | "Ship directly from main with automated deploys" + "get good at deploying a fix within 30 minutes" (`wisdom.txt`). Mechanized: the pipeline exists, is automated, is alive; rollback is documented; flags optional. DORA's speed-and-stability finding anchors the posture (§2). |
| **team** (+18) | BR-01..05 · CI-06 · ENV-01/02/03 · IAC-01/02/03/06 · FLAG-02/03 (opt-in) · RB-03 · HOT-01/03 | The ~10-dev enterprise walkthrough: PR review ≥1, protected default branch, declared environments each with an automated deploy path, IaC instead of console-clicking, documented hotfix path. Severities mostly `warning`: a team can consciously deviate via the ledger. |
| **critical** (+10) | CI-04 · ENV-04/05/06 · IAC-04/05 · RB-02/04 · HOT-02/04 · escalation: BR-03, ENV-04 become blockers | The healthcare/five-nines posture: "if you break people's insurance that could have huge impacts." Gated prod promotion (blocker), staging data realism (sign-off), rollback drills (sign-off), drift detection, break-glass accounting. |

Two rules carry **profile-escalated severity** (`severity_by_profile`, the one deliberate engine delta — `ARCHITECTURE.md` §7.1): **BR-03** (required status checks incl. strict/up-to-date) and **ENV-04** (gated prod promotion) are `warning` at team, `blocker` at critical. Both are `deterministic` forge checks, so the engine law *a blocker must be deterministic* holds at every tier.

**DESC-03 — the inverse-nag.** The profile system's conscience, active at every tier (locked resolution R4). Fires when observed complexity exceeds the declared tier (a staging+prod+gated-promotion setup under a `solo` declaration — you are paying overhead you declared you don't need) or when the declaration outruns reality (a `critical` declaration with no prod gate — you claim the posture but don't carry it). Resolution is never silent: fix the descriptor, fix the repo, or record a dated `deviation` judgment explaining the mismatch.

## 7. What "done" looks like for v0.1

- The file map in `ARCHITECTURE.md` §2 exists and runs: `node check.mjs --repo <target>` scores any repo; `--self-check` validates the rule set.
- 39 rules, each with a mechanical check or a ledger path; the scorecard leads with blockers.
- `pipeline jdg new|check` authors and evaluates the sign-off ledger.
- A required `pipeline` job in the skill's own CI runs `--self-check` (the rule set can't rot).
- Four modes (score/init/fix/explain) load under any agent that reads `SKILL.md`.
