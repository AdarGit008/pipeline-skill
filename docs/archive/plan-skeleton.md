# pipeline-skill — Spec Skeleton

**Status: DRAFT.** The rule-family taxonomy in §1–§3 is a proposal; it **locks only after the research phase (§5) returns with primary-source citations**. Nothing here is final spec prose — this is the skeleton an executor can build the spec from.

**Provenance notes (read first):**
- The brief named `/Users/adaramir/context.md` and `projects/dev-ops/dev-ops.txt`; neither exists. `projects/dev-ops/` contains `wisdom.txt`, `ideas.txt`, `insights.txt`. `wisdom.txt` is the full structured summary (SUMMARY/IDEAS/INSIGHTS/QUOTES/HABITS/FACTS/REFERENCES/RECOMMENDATIONS) of the same enterprise-delivery source material and was used as the primary source, cross-checked against `ideas.txt` and `insights.txt`. No content gap resulted, but the orchestrator should confirm `wisdom.txt` == intended `dev-ops.txt`.
- Baseline reference read in full: `SKILL.md`, `README.md`, `REFERENCE.md`, `rules.json`, `rules/ops.json`, `rules/gov.json`, `rules/ctx.json` (sign-off examples), `config.example.json`, `templates/`, plus a structural skim of `check.mjs` and a census of all `check.kind` values across `rules/*.json`.

**Scope lock (approved, unchanged):**
- IN: branching & PR workflow · CI/CD pipeline stages · environment tiers (dev/staging/prod) · infrastructure as code · feature flags & fast rollback · "complexity only when failure cost justifies it" expressed as a solo/team/critical profile system.
- OUT (hard exclusions — no rule family may smuggle these in): multi-region / data-residency / active-active; enterprise org & team-process topics (scrum masters, standups, pairing/mob, demos, client feedback loops, cross-team coordination).

**Hard constraint (applies to every rule below):** no rule may rest on a written promise alone. Every rule is either (a) mechanically checkable by a zero-dependency Node script on a repo **at rest** (tree = file presence/content, history = git, forge = `gh` API) or (b) an explicit, dated, expiring **sign-off ledger entry** (baseline's `signoff` check kind + `records/judgments/JDG-*.json`). Several rules below are a *pair*: a mechanical presence check for the mechanism, plus a sign-off for the judgment the machine can't make.

---

## 0. Design constraints inherited from the baseline reference

These bound every decision below:

1. **Zero-dependency Node ≥ 18.** No npm packages. Consequence: **there is no YAML parser**. All "CI YAML parsing" is line/regex scanning of workflow files (exactly how baseline's `SEC` `workflow-permissions` kind works). Structural claims about workflows (job ordering via `needs:`, per-job `environment:`) are therefore `certainty: heuristic`; pure presence/absence claims are `deterministic`. **Do not spec a YAML parser** — that breaks the zero-dep premise.
2. **At-rest planes only:** tree, history (local git), forge (`gh`, degrading to honest labeled SKIP offline/token-denied, per baseline's `on_unreachable: skip` convention). **No cloud-plane access**: the checker cannot observe actual infra, actual staging data, actual flag states, or actual MTTR. It can only check that *mechanisms and declarations* exist at rest; everything else is sign-off. This is the honest boundary and it is what makes the hard constraint satisfiable.
3. **Imitate baseline's architecture exactly** (§4): rules-as-data, gate→evaluate→tag engine, verdicts PASS/FAIL/WARN/SIGN-OFF/SKIP, blocker FAIL → exit 1, sign-off ledger, profiles, `--self-check`, score/init/fix/explain modes, CI gating.
4. **No duplication of baseline's own coverage.** baseline already owns build/test/security-supply-chain/secrets/reproducibility/ops-generic rules (action SHA-pinning, `.env` hygiene, generic runbook, health endpoints). pipeline-skill rules are *delivery-operations* rules. Where adjacency exists (secrets in `.tf` files, deploy runbooks), the pipeline rule is deliberately narrower and cross-references baseline rather than re-asserting its rule (see §4 "overlap control").

---

## 1. Rule-family taxonomy proposal — **DRAFT** (locks after research returns)

Nine candidate families, ~33 candidate rules. ID prefixes follow baseline convention (2–5 caps). Each rule: candidate ID, one-line title, proposed severity (`blocker|warn|manual`), proposed profile tier (`core|team|critical` — see §3), certainty (`deterministic|heuristic|judgment`).

### 1.1 `DESC` — descriptor & declared posture
| ID | Title | Severity | Profile | Certainty |
|---|---|---|---|---|
| DESC-01 | `pipeline.repo.json` descriptor exists | warn | core | deterministic |
| DESC-02 | Descriptor schema-validates (incl. `profile ∈ solo\|team\|critical`) | blocker | core | deterministic |
| DESC-03 | Declared profile matches observed complexity (the inverse-nag: heavy multi-tier setup under a `solo` declaration, or `critical` declaration with no staging) | warn | team | heuristic |

### 1.2 `BR` — branching & PR workflow
| ID | Title | Severity | Profile | Certainty |
|---|---|---|---|---|
| BR-01 | Default branch is protected (no force-push / no direct push) | warn | team | deterministic (forge) |
| BR-02 | PR review required (required approving review count ≥ 1) | warn | team | deterministic (forge) |
| BR-03 | Required status checks on default branch include the CI pipeline, strict/up-to-date | blocker | critical (warn at team) | deterministic (forge) |
| BR-04 | Declared branching model (`trunk` \| `dev-staging-main` \| `gitflow`) matches observed remote branches | warn | team | deterministic (history/forge) |
| BR-05 | No stale unmerged long-lived branches (tips inactive > N days) | warn | team | heuristic (history) |
| BR-06 | Release points are marked (git tags or forge releases exist) | warn | core | deterministic (history/forge) |

### 1.3 `CI` — CI/CD pipeline stages
| ID | Title | Severity | Profile | Certainty |
|---|---|---|---|---|
| CI-01 | A CI pipeline definition exists (`.github/workflows/*`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/`, `azure-pipelines.yml`) | blocker | core | deterministic (tree) |
| CI-02 | Pipeline builds & tests on PR/push to integration branches (trigger scan) | blocker | core | heuristic (tree) |
| CI-03 | Deployment is automated — a deploy step/workflow exists | blocker | core | heuristic (tree) |
| CI-04 | Post-deploy smoke test step exists in the deploy workflow | warn | critical | heuristic (tree) |
| CI-05 | Pipeline liveness — the workflow is not disabled at the forge (the silent-death mode; lifts baseline OPS-07's `workflow-state` pattern) | warn | core | deterministic (forge) |
| CI-06 | Deploy jobs depend on green build/test jobs (`needs:` ordering in the same workflow) | warn | team (blocker at critical) | heuristic (tree) |

### 1.4 `ENV` — environment tiers
| ID | Title | Severity | Profile | Certainty |
|---|---|---|---|---|
| ENV-01 | Environments are declared — descriptor tier list agrees with forge environments (`gh api …/environments`) and/or `environment:` keys in workflows | warn | team | deterministic (forge+tree cross-check) |
| ENV-02 | Every declared tier has an automated deploy path | warn | team | heuristic (tree) |
| ENV-03 | Dev tier deploys automatically on merge to the integration branch | warn | team | heuristic (tree) |
| ENV-04 | Prod promotion is gated (required reviewers / protection rules on the prod environment) | blocker | critical (warn at team) | deterministic (forge) |
| ENV-05 | Staging data realism (pre-production data, realistic volume) | manual | critical | judgment → sign-off only |
| ENV-06 | Pre-prod validation stage (smoke/load test job) runs in staging before prod promotion | warn | critical | heuristic (tree) for presence; adequacy is sign-off residue |

### 1.5 `IAC` — infrastructure as code
| ID | Title | Severity | Profile | Certainty |
|---|---|---|---|---|
| IAC-01 | An IaC tool is present (`*.tf`, `Pulumi.yaml`, `cdk.json`, `serverless.yml`, CFN templates, Bicep) | blocker | team | deterministic (tree) |
| IAC-02 | IaC state is remote/shared — backend config present; local state files git-ignored | warn | team | deterministic (tree) |
| IAC-03 | IaC is applied by the pipeline, not by hand (`apply/up/deploy` invoked in workflows) | warn | team | heuristic (tree) |
| IAC-04 | Config drift is detected — scheduled drift-detection (cron `plan`) exists, **or** drift-watch sign-off | warn | critical | heuristic (tree) + sign-off fallback |
| IAC-05 | Per-environment IaC configuration is separated (workspaces / per-env tfvars / per-env stacks) | warn | critical | heuristic (tree) |
| IAC-06 | No plaintext secrets in IaC files (narrow delivery-ops twin of baseline SEC; `.tfvars`/`.tf` scan + tfvars git-ignore) | blocker | team | heuristic (tree) |

### 1.6 `FLAG` — feature flags (opt-in family, claims-style activation)
Activation: `uses_feature_flags: true` in config/descriptor, or a flag registry file exists (mirrors baseline's claims opt-in). A `solo` repo may legitimately skip the whole family.
| ID | Title | Severity | Profile | Certainty |
|---|---|---|---|---|
| FLAG-01 | A flag mechanism exists — flag SDK import (OpenFeature/LaunchDarkly/Unleash/Flagsmith/ConfigCat/Split) or a declared config-driven flag store | warn | core (opt-in) | heuristic (tree) |
| FLAG-02 | A flag registry exists — every flag named with an owner (one flag, one record; mirrors baseline per-claim records) | warn | team | deterministic (tree) |
| FLAG-03 | Flags carry expiry — registry entries have `review_by`, none past-due (flag debt is checked, not promised) | warn | team | deterministic (tree) |

### 1.7 `RB` — rollback & recovery
| ID | Title | Severity | Profile | Certainty |
|---|---|---|---|---|
| RB-01 | A rollback path is documented (runbook/README section: revert/redeploy-previous steps) | blocker | core | deterministic (tree) |
| RB-02 | Rollback is verified by drill within N days (recovery capability is demonstrated, not asserted) | manual | critical | judgment → sign-off with `review_by` + tripwire |
| RB-03 | A mechanical fast-rollback path exists (deploy workflow accepts a prior version/ref input; or revert-and-redeploy flow) | warn | team | heuristic (tree) |
| RB-04 | A recovery objective is declared (target MTTR / "fix within 30 min" posture) and reviewed | manual | critical | judgment → sign-off |

### 1.8 `HOT` — hotfix flow & incident response
| ID | Title | Severity | Profile | Certainty |
|---|---|---|---|---|
| HOT-01 | A hotfix path is documented (branch off main, expedited pipeline, who may approve) | warn | team | deterministic (tree) |
| HOT-02 | Hotfix back-merge is practiced (history heuristic: `hotfix/*` tips appear in dev-branch ancestry) **or** back-merge sign-off | warn | critical | heuristic (history) + sign-off fallback |
| HOT-03 | Incident response doc exists (deploy-failure escalation: who to page, first moves) | warn | team | deterministic (tree) |
| HOT-04 | Break-glass events are recorded as expiring judgments (`break-glass` kind, gate named, lands via its own PR) | warn | critical | deterministic (ledger) |

### 1.9 `GOV` — the ledger itself
| ID | Title | Severity | Profile | Certainty |
|---|---|---|---|---|
| GOV-01 | The judgment ledger is healthy — no expired, tripped, or invalid judgments (`jdg check` as a scored rule) | blocker | core | deterministic (ledger) |

**Count:** 33 candidate rules (core 8 · team 14 · critical 11, some dual-tier). Deliberately narrower than baseline's 90 — the scope is one domain.

---

## 2. Per-rule: mechanically checkable at rest vs sign-off residue

Zero-dependency means the mechanical column uses only: **file presence/content** (tree), **git** (history), **`gh` API** (forge), and **the judgment ledger** (records). "Sign-off residue" is what remains that a script can never judge — it becomes a dated `JDG` entry or the rule doesn't exist.

| Rule | Mechanical check (plane · kind) | Sign-off residue |
|---|---|---|
| DESC-01 | tree · `descriptor` (presence) | none |
| DESC-02 | tree · `descriptor-valid` (JSON Schema, hand-rolled validator as in baseline `src/validate.mjs`) | none |
| DESC-03 | cross-check: descriptor `profile` vs which profile-gated artifacts exist (staging workflows, forge environments) · new kind `profile-consistency`, heuristic | disagreement explained → `deviation` judgment |
| BR-01 | forge · reuse baseline `forge-protection` (rulesets/protected flag) | none (SKIPs offline, honestly) |
| BR-02 | forge · `forge-protection` extension: required approving review count | none |
| BR-03 | forge · `forge-protection` extension: required checks + strict policy | none |
| BR-04 | history/forge · new kind `branch-model`: descriptor model vs `git ls-remote --heads` | none |
| BR-05 | history · new kind `stale-branches`: unmerged tips older than `stale_branch_days` | long-lived branch justified → `risk-acceptance` |
| BR-06 | history/forge · `any-of` (tags present, releases endpoint non-empty, release workflow file) | trunk-shop that cut no release yet → SKIP, not theater |
| CI-01 | tree · `any-of` over known CI paths (`any-file`) | none |
| CI-02 | tree · `file-contains` on workflow files: trigger keys (`pull_request`, `push`) + a test-ish step regex | "our CI is external/unreadable" → `risk-acceptance` (rare) |
| CI-03 | tree · grep deploy keywords/actions in workflows (`deploy`, `environment:`, `aws … deploy`, `flyctl`, `vercel`, `kubectl apply`, `terraform apply`) | deploy genuinely manual by design → `deviation` (and the rule's rationale says why that's flagged) |
| CI-04 | tree · grep smoke/health-check step after deploy in deploy workflow | smoke adequacy → folded into ENV-06 sign-off |
| CI-05 | forge · reuse `workflow-state` (one recorded query per workflow) | none |
| CI-06 | tree · line-scan: `deploy` job block contains `needs:` referencing test/build job (heuristic — no YAML parser, §0.1) | none |
| ENV-01 | forge `…/environments` + tree scan of `environment:` keys, cross-checked against descriptor `environments[]` · new kind `env-inventory` | none |
| ENV-02 | tree · per declared tier, a workflow references it (`environment: <tier>` or per-tier workflow file) | tier deployed by external system → `deviation` |
| ENV-03 | tree · dev-tier workflow triggers on push to integration branch | none |
| ENV-04 | forge · new kind `env-protection`: prod environment protection rules (required reviewers/wait timer) | none |
| ENV-05 | **none — not checkable at rest** | entire rule is a dated sign-off (staging data realism reviewed, `review_by` set) |
| ENV-06 | tree · staging workflow contains test-job regex (presence only) | load-test *adequacy* for the failure-cost tier → sign-off |
| IAC-01 | tree · `any-of` `any-file` over IaC tool markers | "no infra" (pure docs/library repo) → `applies_to` SKIP, not sign-off |
| IAC-02 | tree · `file-contains` backend block + `any-file mode:absent` local state, gitignore scan | none |
| IAC-03 | tree · workflows invoke the IaC tool's apply command | manual apply accepted → `deviation` |
| IAC-04 | tree · scheduled workflow cron running `plan`/drift command (presence of the *mechanism* — the checker never sees the cloud, §0.2) | no drift automation → sign-off that a human reviews drift on a cadence |
| IAC-05 | tree · per-env config layout (workspaces/`*.tfvars`/stack dirs) heuristic | mono-env shop → SKIP via profile |
| IAC-06 | tree · grep secret-shapes over IaC globs + tfvars gitignore (narrow reuse of baseline scrub patterns) | false positive → `deviation` naming the finding (baseline's `--allow` pattern) |
| FLAG-01 | tree · grep flag-SDK imports / config-flag pattern | homegrown flag store → descriptor declaration satisfies (declaration is config, not a promise: FLAG-02/03 then police it) |
| FLAG-02 | tree · registry file present, entries parse, owner field non-empty (`json-field`) | none |
| FLAG-03 | tree · registry `review_by` dates evaluated against run date (`doc-freshness`-style date math) | expired flag kept deliberately → `risk-acceptance` with tripwire |
| RB-01 | tree · `file-contains` rollback/revert section (baseline OPS-05 pattern, deploy-scoped) | none |
| RB-02 | **none** | entire rule: drill evidence + date + `review_by` + tripwire ("last drilled < N days") |
| RB-03 | tree · deploy workflow exposes version/ref input (`workflow_dispatch` input) or documented revert-redeploy | none |
| RB-04 | descriptor declares recovery objective (declaration enables the check…) | …but the objective being *met* is sign-off with drill/incident evidence |
| HOT-01 | tree · `file-contains` hotfix doc (branch-off-main + expedited path + approver) | none |
| HOT-02 | history · `hotfix/*` merge ancestry scan (heuristic; a shop with zero hotfixes yet SKIPs) | no hotfix history → sign-off that back-merge is the agreed practice, `review_by` |
| HOT-03 | tree · `file-contains` incident/escalation doc (baseline OPS-05 pattern, deploy-scoped) | none |
| HOT-04 | ledger · `break-glass` judgments exist when protection was bypassed, all expiring (git/forge cross-ref: bypass events vs ledger) | none — the ledger entry *is* the mechanism |
| GOV-01 | ledger · `jdg check` evaluated in-run | none |

**Pattern made explicit:** mechanical column proves the *mechanism exists at rest*; sign-off column covers *practice, adequacy, and recency*. Rules with empty mechanical columns (ENV-05, RB-02, RB-04) exist **only** as ledger entries — that is the hard constraint working as designed, not a gap.

---

## 3. Profile design: solo / team / critical

### 3.1 Mechanism
- Declared in the descriptor: `pipeline.repo.json → "profile": "solo" | "team" | "critical"` (DESC-02 enforces the enum). Mirrors baseline's profile gating exactly: a rule carries `profile: core|team|critical`; the engine activates `core` always, `team` when declared tier ≥ team, `critical` when declared tier = critical. **Tiers are cumulative** (core ⊂ team ⊂ critical); `solo` = core only.
- This *is* the source philosophy mechanized — "complexity should be introduced only when the cost of failure justifies the added overhead": the descriptor is where you declare your failure cost, and the checker holds you to exactly that much process, no more, no less.
- DESC-03 is the **inverse-nag**: it fires when observed complexity exceeds the declared tier (a staging+prod+gated-promotion setup under `solo`) or when the declaration outruns reality (`critical` with no prod gate) — you either justify the overhead in the descriptor or stop paying it.

### 3.2 Activation map & rationale

| Tier | Families/rules active | Rationale (anchored in source material) |
|---|---|---|
| **solo** (= core) | DESC-01/02 · CI-01/02/03/05 · RB-01 · BR-06 · FLAG-01 (opt-in) · GOV-01 | The startup posture from the source: "ship directly from main with automated deploys" and "get good at deploying a fix within 30 minutes." Mechanized: the pipeline must exist, be automated, be alive; rollback must be documented; flags optional. **No required review, no staging, no IaC mandate** — the standard refuses to nag a solo dev about process whose failure-cost doesn't justify it. |
| **team** (core +) | BR-01..05 · ENV-01..03 · IAC-01/02/03/06 · CI-06 · HOT-01/03 · FLAG-02/03 (opt-in) · RB-03 · DESC-03 | The ~10-dev enterprise walkthrough: daily integration to a shared branch, PR review ≥1, dev environment deployed daily, IaC instead of console-clicking, documented hotfix path. Everything here is mechanically checkable — this tier is the checker's home turf. Severities mostly `warn`: a team can consciously deviate via ledger. |
| **critical** (team +) | ENV-04/05/06 · CI-04 · IAC-04/05 · RB-02/04 · HOT-02/04 · hardening: BR-03, CI-06, ENV-06 become blockers | The healthcare/five-nines posture: "if you break people's insurance that could have huge impacts." Gated prod promotion, staging realism (sign-off), rollback *drills* (sign-off), drift detection, break-glass accounting. This tier carries the bulk of the sign-off surface — deliberately: at high failure cost the honest answer to "is staging realistic?" is a dated human judgment, not a script's guess. |

### 3.3 Open design point (needs a decision before spec lock)
**Severity-per-profile.** Baseline severities are static per rule. Three rules above want `warn` at team but `blocker` at critical (BR-03, CI-06, ENV-04/06). Options:
- **(a) Duplicate rule entries** sharing one check (e.g. `BR-03` warn@team, `BR-03C` blocker@critical). Zero engine change; uglier taxonomy.
- **(b) Add optional `severity_by_profile` to the rule schema** — a small, contained engine extension, but it *is* a divergence from baseline's engine.
Recommendation: **(b)**, implemented as a pure map lookup at tag time, flagged clearly in CHANGELOG as the one deliberate engine delta. Research phase does not gate this; the spec author decides.

---

## 4. Architecture decisions — what to lift from baseline vs what is new

### 4.1 Lift verbatim (imitate exactly; do not redesign)
From `/tmp/pi-github-repos/AdarGit008/baseline-skill/`:

| Asset | What carries over |
|---|---|
| `check.mjs` + `src/` split | Thin CLI → `repo` index → `config` resolution → `evaluators` → `engine` (gate→evaluate→tag) → `report`. Invoke by absolute path; never copy away from `rules/` + `src/`. |
| Rules-as-data | `rules.json` manifest (name, version, project_types, profiles, module list) + `rules/<family>.json`, one module per family. Rule fields verbatim: `id, title, category, severity, profile, applies_to, source, lesson, rationale, fix, sources[], on_unreachable, contexts[], certainty, check{}`. |
| Severity model | `blocker` (exit 1) / `warn` / `manual` (sign-off). Verdicts PASS/FAIL/WARN/SIGN-OFF/SKIP; SKIP never counts against readiness. |
| Certainty model | `deterministic` / `heuristic` / `judgment` — used exactly as baseline uses it (heuristics are labeled, never dressed up as proof). |
| Sign-off ledger | `records/judgments/JDG-NNNN.json` + `schema/record.judgment.schema.json` + `jdg new|check` + kinds `sign-off|deviation|risk-acceptance|break-glass` + `review_by` expiry + `tripwire`. **This is how the hard constraint is satisfied.** |
| Check kinds to reuse | `any-file, grep, file-contains, json-field, any-of, command, required-files, signoff, descriptor, descriptor-valid, workflow-state, forge-protection` (and the scrub secret-patterns for IAC-06). |
| Profiles machinery | Activation gating (`ACTIVE` set), SKIP-as-`n/a` for off profiles. Repurposed (see 4.2) but the mechanism is unchanged. |
| Modes | `score` (default; blockers-first scorecard), `init` (descriptor-first scaffold from presets, never overwrite), `fix` (apply each rule's `fix`; manual rules → real dated judgments, never rubber-stamped), `explain` (read the rule from `rules.json`). |
| `--self-check` | Rule-set integrity: unknown kind/profile/severity/category/applies_to, duplicate ids, orphan profiles, coverage matrix. Wire into the skill repo's own CI. |
| CI gating | REFERENCE.md's "wire it into CI as a required check" pattern, incl. the meta-rule analog of BUILD-06: *the pipeline check itself runs as a required CI job* (self-gating). |
| Config layout | `config.example.json` → `<repo>/pipeline.config.json` override; auto-detect with explicit pin; `_comment` documentation convention. |
| Templates/presets | `templates/` (descriptor, judgment, flag-registry record, hotfix doc, runbook section) + `config-presets/` per tier (`solo.repo.json`, `team.repo.json`, `critical.repo.json`). |
| Degradation honesty | `on_unreachable: skip`, crash-resilient evaluation (a broken rule → SKIP, never a crashed run), offline-labeled forge SKIPs. |

**Deliberately NOT lifted** (belong to baseline's multi-agent lane workflow, out of this skill's domain): `orient`, `lane claim/reclaim`, `admit`, `log` session records, FLOW/DIV/MERGE families, claims register machinery (the *pattern* is reused for the flag registry, not the code), records scrub hooks. Candidate exception: `reconcile` (post-merge cron revalidation) maps naturally onto pipeline concerns — cron liveness (CI-05), judgment-expiry sweeps (GOV-01), drift-detection cadence (IAC-04). **Decision D2: adopt `reconcile` in v1 or defer.** Lean: defer to v1.1; CI-05 works in check-mode without it.

### 4.2 New in pipeline-skill

1. **Descriptor `pipeline.repo.json` + `schema/repo.schema.json`** — fields: `type`, `profile` (solo/team/critical), `branching_model` (trunk/dev-staging-main/gitflow), `default_branch`, `environments[]` (name, tier, gated?), `iac` (tool, state backend), `uses_feature_flags`, `recovery_objective`. Every cross-check rule (DESC-03, BR-04, ENV-01, RB-04) reads this; it is the single declaration point the whole taxonomy polices.
2. **Profiles repurposed: expertise levels → failure-cost tiers.** Baseline's `core/service/advanced` encode *how expert* a repo is; pipeline-skill's `core/team/critical` encode *declared failure cost*. Same gating machinery, different semantics — the philosophy item made structural.
3. **`project_types` axis change.** Baseline's closed set is language-shaped (`node/python/service/library/docs`). Delivery posture isn't language-shaped; it's deployment-shaped. Proposed closed set: `service | app | library | docs | infra`, with most delivery rules `applies_to: ["service","app","infra"]`. (`infra` = a repo whose primary content is IaC — where IAC-01's `any-of` would otherwise be circular.) **Decision D3.**
4. **New check kinds** (each small, each following the crash-resilient evaluator contract):
   - `env-inventory` (forge environments + workflow `environment:` keys vs descriptor) — ENV-01.
   - `env-protection` (protection rules on a named environment) — ENV-04.
   - `branch-model` (descriptor model vs `git ls-remote --heads`) — BR-04.
   - `stale-branches` (unmerged tips older than config `stale_branch_days`) — BR-05.
   - `hotfix-backmerge` (hotfix tips in dev ancestry; SKIP when no hotfix history) — HOT-02.
   - `profile-consistency` (descriptor tier vs observed artifacts) — DESC-03.
   - `flag-registry` (entries parse; owner + `review_by` present and unexpired) — FLAG-02/03 (or compose from `json-field` + date math; prefer composed if feasible — fewer kinds).
   - `workflow-job-order` (line-scan `needs:` ordering) — CI-06, explicitly `heuristic`.
   - Extend `forge-protection` for review-count/required-checks reads (BR-02/03) rather than new kinds.
5. **Flag registry as records** (`records/flags/FLAG-NNNN.json` + schema), patterned on baseline's per-claim records: one flag, one record, owner + `review_by`. Opt-in activation exactly like claims (`uses_feature_flags` or registry presence).
6. **Overlap control with baseline.** IAC-06 (secrets in IaC) and HOT-03/RB-01 (runbooks) sit adjacent to baseline SEC/OPS. Resolution: pipeline rules are strictly narrower in glob/scope (IaC files only; deploy-failure sections only) and their `rationale` cross-references the baseline rule rather than restating it. A repo running both skills gets two lenses, not two competing copies. Document this in both READMEs.
7. **Proposed repo layout** (mirror of baseline; final location = **D1**, likely sibling of baseline-skill):
   ```
   pipeline-skill/
     SKILL.md  README.md  REFERENCE.md  GLOSSARY.md  CONTRACT.md(?)
     check.mjs  pipeline.mjs(CLI)  rules.json  rules/{desc,br,ci,env,iac,flag,rb,hot,gov}.json
     src/  schema/  templates/  config-presets/  config.example.json  test/
   ```
   `CONTRACT.md` inclusion = D5 (baseline's is lane-workflow-specific; a delivery-ops plain-git contract may still earn its place — decide at spec lock).

### 4.3 Explicit exclusions enforced by the taxonomy
No family exists for multi-region/failover/data-residency (source sections on active-active, EU→US replication are **out of scope**) and none for org-process (standups, scrum, pairing, demos, team coordination). If research (§5) surfaces a citation that *only* supports an excluded topic, the question is dropped, not the scope.

---

## 5. RESEARCH QUESTIONS — four angles

Each question states **the specific claim that needs a primary-source citation** to justify a rule, the rule(s) it gates, and candidate sources to fetch first. A rule whose claim fails to source gets cut or downgraded to sign-off at taxonomy lock — that is the gate. (Baseline precedent: every rule carries `source` + `lesson`; the same bar applies here.)

### (a) CI/CD & environment tiers
1. **Claim:** "Every change must be built and tested by an automated pipeline on every PR/push, and a failing pipeline must block merge." Gates **CI-02, BR-03** (both proposed blockers — the highest bar). Candidates: GitHub Docs — required status checks/protected branches; GitLab CI Docs; DORA *Accelerate*/State of DevOps CI practice findings.
2. **Claim:** "Deployment to production must be performed by the pipeline (automation), not by hand." Gates **CI-03** (blocker at *core* — needs a citation strong enough to hold at the *solo* tier). Candidates: DORA deployment-automation capability; GitHub Actions environments/deployments docs; Google SRE Book — Release Engineering chapter.
3. **Claim:** "A dedicated dev environment receiving frequent (daily) automated deploys catches integration failures before staging/prod." Gates **ENV-03**. Candidates: 12-factor (dev/prod parity); DORA test-environment practices; AWS Well-Architected (deployment pipelines). *Risk: may only find weak support → downgrade to team-tier warn.*
4. **Claim:** "Promotion into production for high-criticality systems must be gated by explicit approval." Gates **ENV-04** (blocker at critical). Candidates: GitHub Docs — environment required reviewers; GitLab protected environments; NIST SP 800-53 change-control (if an official control citation is wanted).
5. **Claim:** "An automated smoke test must run immediately after each deployment to confirm core functionality survived the release." Gates **CI-04**. Candidates: Google SRE Book/Workbook (canarying, release validation); AWS Well-Architected deployment practices; launch-checklist literature.
6. **Claim:** "Staging must mirror production closely, including realistic data volume, to make pre-prod validation meaningful." Gates **ENV-05/06** (sign-off + presence). Candidates: 12-factor dev/prod parity; Google SRE launch coordination; Azure/AWS architecture-center staging guidance. *Known-hard to source; expected outcome is ENV-05 staying judgment-only.*

### (b) IaC & config drift
1. **Claim:** "All infrastructure must be defined as code and version-controlled with the application; manual console changes are prohibited." Gates **IAC-01/03**. Candidates: HashiCorp Terraform Docs (why IaC); AWS Well-Architected — IaC best practice; Microsoft/Azure IaC guidance.
2. **Claim:** "Configuration drift between declared IaC and real infrastructure is an expected failure mode and must be detected (e.g., scheduled plan/drift detection), not assumed absent." Gates **IAC-04**. Candidates: HashiCorp drift-detection docs (Terraform Cloud/Health); Spacelift/env0 drift-detection docs as secondary. *Note: the checker verifies the mechanism's presence at rest, never the cloud itself (§0.2) — the citation justifies why the mechanism matters.*
3. **Claim:** "IaC state must be stored remotely/shared (with locking) for any team, and local state files must never be committed." Gates **IAC-02**. Candidates: HashiCorp backend/state docs (official, primary).
4. **Claim:** "Environment parity (dev≈staging≈prod) is achieved by replicating one IaC definition across tiers with per-environment configuration separated from shared definition." Gates **IAC-05, ENV-01/02**. Candidates: 12-factor config + dev/prod parity (12factor.net — primary, two URLs); Terraform workspaces / per-env patterns docs.
5. **Claim:** "Secrets must not be committed in IaC source or variable files (tfvars etc.); secret material belongs in a manager or protected CI variables." Gates **IAC-06**. Candidates: HashiCorp sensitive-variables docs; GitHub Actions encrypted-secrets docs; OWASP secrets-management cheat sheet as secondary.

### (c) Feature flags & rollback/recovery
1. **Claim:** "Feature flags decouple deployment from release, making a broken feature instantly disableable without redeploying (kill-switch), thereby reducing mean time to recovery." Gates **FLAG-01** + the family's rationale. Candidates: martinfowler.com — *Feature Toggles* (canonical published article); OpenFeature spec (openfeature.dev); LaunchDarkly/Microsoft feature-management docs.
2. **Claim:** "Feature flags are debt: every flag must have an owner and an expiry/cleanup date, or the flag system itself becomes an operational hazard." Gates **FLAG-02/03** (the registry + expiry rules — the strongest novelty claims in the taxonomy, so they need the strongest citations). Candidates: Fowler *Feature Toggles* (toggle-debt sections); Flagsmith/Unleash technical-debt docs; IEEE/academic flag-debt studies if accessible.
3. **Claim:** "Every deployment must have a documented, fast rollback path (revert/redeploy-previous), known before the deploy happens." Gates **RB-01/03**. Candidates: Google SRE Book — Release Engineering / rollback discussions; GitHub Actions re-run/revert docs; DORA 'ability to roll back' capability.
4. **Claim:** "Recovery capability must be demonstrated by practice (drills/game days), not asserted — an untested rollback is assumed broken." Gates **RB-02** (pure sign-off — needs a citation to justify *why* a drill ledger entry is a legitimate requirement). Candidates: AWS Well-Architected Reliability Pillar (game days); Google SRE Workbook — emergency/diRT exercises; DORA MTTR findings.
5. **Claim:** "For low-criticality systems, observability plus fast rollback can substitute for heavy multi-tier release gating." Gates **the solo tier's entire shape (§3.2)** — the philosophy claim that authorizes the profile system. Candidates: DORA *Accelerate* (throughput/stability without heavyweight process); trunkbaseddevelopment.com (secondary); SRE Book on error budgets as the governing trade-off. *Highest-risk question: if this fails to source, the profile system loses its theoretical anchor — flag to the orchestrator immediately if so.*

### (d) Hotfix flow & incident response
1. **Claim:** "Critical production defects warrant an expedited hotfix path branching directly from main/production, bypassing the normal release train." Gates **HOT-01**. Candidates: nvie — *A successful Git branching model* (the original GitFlow post, hotfix-branches section — primary for the model); GitLab Flow docs; GitHub Docs on hotfix patterns if present.
2. **Claim:** "A hotfix merged to production must be back-merged into development branches, or the fix silently regresses in the next release." Gates **HOT-02** (mechanical heuristic + sign-off fallback). Candidates: nvie GitFlow post (hotfix merge-back into develop — the canonical statement); git-flow tooling docs; Atlassian GitFlow tutorial as secondary.
3. **Claim:** "A deploy-failure/incident response document (who to page, first diagnostic moves, escalation) must exist before an incident, not be written during one." Gates **HOT-03**. Candidates: Google SRE Book — Emergency Response chapter; PagerDuty incident-response docs (vendor-secondary); Atlassian incident handbook.
4. **Claim:** "Emergency bypasses of release gates (break-glass) must be recorded, owned, time-bounded, and reviewed after the fact — bypass without a record is the failure, not the bypass itself." Gates **HOT-04** + the ledger's break-glass kind. Candidates: NIST SP 800-53 AC-family emergency-access controls; GitHub rulesets bypass/audit docs; healthcare break-glass literature (HL7/HIMSS) as domain-secondary. *Expected to be sourceable via NIST; if not, HOT-04 rests on baseline's existing ledger precedent.*
5. **Claim:** "A declared recovery-time objective (e.g., 'fix within 30 minutes') is a legitimate, measurable substitute for preventive gating at low failure cost — and must be reviewed against actual incidents." Gates **RB-04** + reinforces the solo tier. Candidates: DORA four keys (MTTR); Google SRE Book — SLO/error-budget chapters (objective + measurement framing).

---

## Appendix A — Open decisions register
| # | Decision | Options / lean | Gate |
|---|---|---|---|
| D1 | Repo location & name for the new skill | sibling of baseline-skill (`pipeline-skill`); confirm before scaffold | spec lock |
| D2 | Adopt `reconcile` cron mode in v1? | lean: defer to v1.1; CI-05/GOV-01 work without it | spec lock |
| D3 | `project_types` closed set: `{service,app,library,docs,infra}` | lean: adopt; delivery-shaped not language-shaped | spec lock |
| D4 | Severity-per-profile: duplicate rules vs `severity_by_profile` map | lean: (b) engine map, documented as the one engine delta | spec lock |
| D5 | Ship `CONTRACT.md` (plain-git twin)? | lean: yes but delivery-scoped, not lane-scoped | spec lock |
| D6 | Confirm `wisdom.txt` == intended `dev-ops.txt` source | provenance only; no content gap observed | orchestrator |

## Appendix B — What the research phase must return for taxonomy lock
1. One primary-source URL (or a documented failure-to-source) per question in §5 — 21 questions across the 4 angles.
2. Per question: the claim survives as written / is narrowed / is dropped → the mapped rule keeps its severity, is downgraded (blocker→warn, mechanical→sign-off), or is cut.
3. §5(c)-5 (solo-tier anchor) and §5(a)-1/2 (core-tier blockers) are the load-bearing citations; report them first.
4. After lock: freeze §1 IDs (IDs are stable from that point — never renumber), then write final spec prose per family.
