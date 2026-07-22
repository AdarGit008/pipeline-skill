# pipeline-skill — Reference (v0.1)

Full reference for the delivery-operations checker: what it reads, how it decides, how to
configure it, how to wire it into CI, and the ledger format. For the agent-facing surface see
`SKILL.md`; for term definitions see `GLOSSARY.md`; for the normative design see `docs/spec/`.

pipeline-skill answers one question — **"can this repo ship, recover, and prove it?"** — with 39
rules across 9 families, each backed by a check a zero-dependency Node runner executes on the repo
*at rest*. It is the delivery sibling of **baseline-skill** (repo readiness), not a fork: same rule
engine, same `records/judgments/` ledger format, a narrower and non-overlapping question.

---

## Profiles — complexity scales with failure cost

You declare a tier in the descriptor (`pipeline.repo.json`); the active rule set is cumulative.

| tier | active set | what it adds |
|---|---|---|
| **solo** | core (11) | The pipeline must exist, be automated, be alive; a rollback path is documented. No required review, no staging, no IaC mandate. |
| **team** | core + team (→ 30) | Protected default branch, PR review ≥ 1, each declared environment with an automated deploy path, IaC that isn't console-clicking, a documented hotfix path. |
| **critical** | core + team + critical (→ 39) | Gated prod promotion (**blocker**), staging data realism (sign-off), rollback **drills** (sign-off), drift detection, break-glass accounting. |

Engine tier split: **core 11 · team 19 · critical 9** = 39. Off-tier rules SKIP as `n/a` and never
count against readiness. Two rules escalate severity by tier via `severity_by_profile` — **BR-03**
and **ENV-04**: `warn` at team, `blocker` at critical. Declaring `critical` is a commitment, not a
badge — **DESC-03** (the inverse-nag) compares the declaration to observed reality and flags a
mismatch in either direction; resolve it in the descriptor, in the repo, or as a dated `deviation`.

Missing descriptor → profile defaults to `solo` (core only); DESC-01 warns and DESC-02 SKIPs (an
absent descriptor is never a blocker FAIL).

## Project types & `applies_to`

Closed set `{service, app, library, docs, infra}`. Auto-detect: IaC markers ⇒ `infra` (unless a code
manifest is present ⇒ `service`/`app`); `package.json`/framework markers ⇒ `app`; publishable
manifest only ⇒ `library`; else `docs`. The descriptor's `type` supersedes auto-detection. Each rule
declares `applies_to` (`"all"` or a subset); a rule whose set excludes the repo's type SKIPs `n/a`.

## Architecture & data flow

Four at-rest planes, no cloud-plane access — the checker never observes real infra, staging data,
flag states, or MTTR. It verifies that *mechanisms and declarations* exist at rest; everything else
is a ledger entry.

- **tree** — file presence/content (globs, regex; no YAML parser — workflow scans are line/regex).
- **history** — local git (branches, tags, ancestry, tip age).
- **forge** — `gh` API (protection, rulesets, environments, workflow state). Optional; every
  forge-reading rule carries `on_unreachable: skip` and degrades to a labeled SKIP when offline or
  token-denied. A SKIP on a gating rule (BR-03, ENV-04) means *unverified*, not *fine*.
- **ledger** — `records/judgments/` and `records/flags/`.

The run is a funnel per rule (`src/engine.mjs`):

```
index (src/repo.mjs)  →  config (src/config.mjs)  →  for each rule:
  applies_to includes type?  →  profile in ACTIVE set?  →  requires satisfied (FLAG opt-in)?
  →  evaluate check.kind (src/evaluators.mjs / src/jdg.mjs)  →  map ok→verdict, resolve severity
  →  report (src/report.mjs, blockers-first scorecard or --json)
```

Verdicts: **PASS / FAIL / WARN / SIGN-OFF / SKIP**. Only a `blocker` FAIL sets exit 1.
- **SKIP** — the rule didn't apply (off-type, off-tier, FLAG opt-in inactive, or nothing to check —
  incl. forge unreachable). Never counts against readiness.
- **SIGN-OFF** — a `manual` rule satisfied by a dated, unexpired `kind: sign-off` judgment whose
  `subject` is the rule id. The ledger is the only sign-off path; a lapsed sign-off is honestly unsigned.

Every evaluator returns `ok ∈ {true, false, null}`; `null` → SKIP with a reason. Crash-resilient: a
broken rule degrades to SKIP, never a crashed run. Certainty is labeled per rule and never dressed
up: **deterministic** (23 — presence/absence, set comparison), **heuristic** (13 — line-scan
inference), **judgment** (3 — ledger only).

## CLIs

Invoke by **absolute path** — the runner loads `rules.json` + `rules/` + `src/` from its own
directory; never copy `check.mjs` away from them. Requires Node ≥ 18 and `git` on PATH.

```bash
node "<abs>/pipeline.mjs" check [--repo DIR] [--config FILE] [--json] [--no-exec]   # score (default)
node "<abs>/pipeline.mjs" jdg new … | jdg check [--today YYYY-MM-DD] [--facts FILE] # ledger
node "<abs>/pipeline.mjs" help
node "<abs>/check.mjs" --self-check                                                 # validate the rule set
```

`pipeline check` delegates to `check.mjs` (inherits its exit code); a leading `--flag` implies
`check`. `--no-exec` is reserved (v1 has no exec-class checks; kept for CLI parity). `check.mjs`
scores against the real wall clock — only `jdg` exposes `--today`/`--facts` for deterministic
ledger evaluation.

## Configuration — `config.example.json` → `<repo>/pipeline.config.json`

Auto-detect is sensible; override only what you need. The descriptor declares posture; this file
tunes checks. Every key the engine reads (copy `config.example.json` and edit):

| key | default | effect |
|---|---|---|
| `type` | auto | Project type. Superseded by the descriptor's `type` when present. |
| `uses_feature_flags` | `false` | `true` (or a non-empty `records/flags/` dir) activates the opt-in FLAG family. |
| `stale_branch_days` | `30` | BR-05 flags unmerged branch tips older than this. |
| `release_mark_grace_days` | `90` | BR-06 SKIPs repos younger than this (first-commit date) — no release-theater. |
| `rollback_drill_days` | `90` | RB-02's sign-off prompt expects drill evidence fresher than this. |
| `permanent_flag_review_days` | `365` | FLAG-03: kill-switch/permission flags need `review_by` within this window. |
| `prod_environment_name` | `production` | Which `environments[]` entry ENV-04 treats as the gated prod tier (matched on `tier:prod` first, name second). |
| `deploy_globs` | `[]` | OPT-IN extra globs CI-03/04/06 scan as deploy definitions (non-standard CD layouts). |
| `iac_globs` | `[]` | OPT-IN extra globs IAC-03/04/06 scan (custom IaC layouts). |
| `required_check_names` | `[]` | BR-03: status checks the default-branch ruleset must require. Empty = derive from CI-01 workflows' `name:` lines (heuristic). |
| `source_globs` | `[]` | OPT-IN source/dependency globs FLAG-01 scans for flag-SDK imports. Empty = language defaults. |

## The descriptor — `pipeline.repo.json`

The one file pipeline requires (schema: `schema/repo.schema.json`, DESC-02 validates it). Required:
`type`, `profile`, `branching_model`, `default_branch`. Optional: `environments[]` (each `name` +
`tier ∈ {dev,staging,prod}`, `gated`), `iac` (`tool`, `state_backend`), `uses_feature_flags`,
`branches` (tier-branch names; unset keys fall back to `branching_model` conventions),
`recovery_objective`. Start from a tier preset (`config-presets/{solo,team,critical}.repo.json`) or
the blank `templates/pipeline.repo.json`.

## Records & the sign-off ledger

The rules a script can't decide, and the exceptions you consciously accept, are ledger records —
not chat. One judgment, one file: `records/judgments/JDG-NNNN.json` (schema:
`schema/record.judgment.schema.json`). Author and evaluate with `pipeline jdg new|check`.

```json
{
  "record": "judgment/1",
  "id": "JDG-0001",
  "kind": "sign-off | deviation | risk-acceptance | break-glass",
  "date": "2026-07-21",
  "by": "human-handle",
  "subject": "RB-02",
  "reason": "why this judgment holds",
  "review_by": "2026-10-01",
  "expected_state": { "descriptor.profile": "critical" },
  "tripwire": { "fact": "descriptor.profile", "op": "ne", "value": "critical" },
  "gate": "environment:production   (break-glass only)"
}
```

- **Kinds:** `sign-off` satisfies a manual rule (subject = rule id, unexpired: ENV-05, RB-02, RB-04)
  · `deviation` accepts a rule violation (CI-03, ENV-02, IAC-03, IAC-06, DESC-03 escapes) ·
  `risk-acceptance` accepts a risk with expiry + tripwire (BR-05, FLAG-03, CI-02 escapes) ·
  `break-glass` records a gate bypass (HOT-04; additionally carries the free-form `gate`).
- **Evaluation (`jdg check`):** `expected_state` mismatch → **DRIFTED** (≈) · tripwire true →
  **TRIPPED** (✗, voids) · `review_by` passed → **EXPIRED** (⏰) · unresolvable fact → **?** ·
  schema-invalid → **INVALID** (!). Exit 1 on tripped/expired/invalid. Facts namespace:
  `descriptor.*` · `planes.{tree,history,forge}` · `git.{branch,head}` · `today`. **GOV-01** runs
  this evaluator in-check, so an expired judgment can't silently void the rule it satisfied.
- **Authoring (`jdg new`):** date-valued tripwire comparands are resolved to literal ISO dates at
  authoring time (e.g. `today+90d` → a concrete date in the record) — the evaluator only ever
  compares a fact against a literal. `jdg new` requires `--by`, `--reason`, and `--review-by`; it
  **never fakes a sign-off** — a real dated judgment by a person, or nothing.
- **Secrets note (build follow-up #11):** unlike baseline, `jdg new` ships no secret-scrub gate.
  A judgment `reason`/`subject` is prose you type, not harvested config — **do not embed live
  secrets** (tokens, keys) in it; the record is committed as-is.

### Flag registry — `records/flags/FLAG-NNNN.json`

One flag, one file (schema: `schema/record.flag.schema.json`). Opt-in with the FLAG family. FLAG-02
requires a non-empty `owner`; FLAG-03 requires `review_by` present and not past-due unless
`type ∈ {kill-switch, permission}` (permanent-class, reviewed within `permanent_flag_review_days`).
When the family is active but zero records exist, FLAG-02 WARNs `flag registry empty` — the opt-in
declares flags exist, so an empty registry is a finding, not a vacuous pass. Default review horizons:
release 40d · experiment 40d · operational 7d · sunset 90d · kill-switch/permission permanent-class.

## The rules (39 across 9 families)

| family | count | scope |
|---|---|---|
| **DESC** | 3 | Descriptor presence/validity/consistency (incl. the inverse-nag). |
| **BR** | 6 | Branching model, protected default branch, PR review, required checks, stale branches, release marks. |
| **CI** | 6 | CI/CD presence, pinned actions, deploy stage, job ordering, deploy triggers. |
| **ENV** | 6 | Environment inventory, deploy path, promotion trigger, prod gating, staging data realism. |
| **IAC** | 6 | IaC presence, remote state, no committed state/secrets, plan-on-PR. |
| **FLAG** | 3 | Flag-SDK detection (opt-in), registry+owner, expiry freshness. |
| **RB** | 4 | Rollback documented, drill sign-off, big-red-button, reviewed recovery objective. |
| **HOT** | 4 | Hotfix path, back-merge, incident-response doc, break-glass accounting. |
| **GOV** | 1 | Ledger health (the `jdg check` evaluator run in-check). |

Read any rule with `explain` mode or straight from `rules.json` + `rules/*.json` (`title`,
`rationale`, `fix`, `source`, `check`). The full per-rule spec with verbatim citations is in
`docs/spec/RULES.md`.

## Check kinds (how the runner verifies, zero-dep)

24 kinds in use. **Reused from baseline** (same semantics): `any-file`, `grep`, `file-contains`,
`any-of`, `descriptor` / `descriptor-valid`, `workflow-state`, `forge-protection` (extended with
`gov: reviews | required-checks`), `signoff`. **New:** `env-inventory`, `env-protection`,
`branch-model`, `stale-branches`, `release-marks`, `hotfix-backmerge`, `profile-consistency`,
`flag-registry`, `workflow-job-order`, `env-deploy-path`, `env-trigger`, `iac-state`, `iac-secrets`,
`jdg-health`, `breakglass-ledger`. Every evaluator is crash-resilient and degradation-honest — forge
evaluators report `forge: not consulted` when degraded rather than guessing.

## Rule-set integrity — `--self-check`

```bash
node "<abs>/check.mjs" --self-check
```

Validates the rule set (never a target): exits 1 on a missing/typo'd `applies_to`, an unknown
check-kind / profile / severity / category / `requires` key, a duplicate id, an orphan type/profile,
a non-deterministic blocker (including any `severity_by_profile` escalation to `blocker`), or a
non-judgment sign-off — and prints a per-type **coverage matrix**. Wire it into the skill's own CI so
a malformed rule set can't merge.

## Wire it into CI (the point)

The standard only bites if CI runs it on every PR (the self-gating meta-rule):

```yaml
  pipeline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<sha>
      - uses: actions/setup-node@<sha>
        with: { node-version: 22 }
      - run: node tools/pipeline/check.mjs          # scorecard; exit 1 on blockers
      # optional, machine output for artifacts:  node tools/pipeline/check.mjs --json
```

Make `pipeline` a **required** status check (which is itself BR-03's verify surface at team+).
Offline/forge-less runners still work: forge rules SKIP labeled, tree/history/ledger rules score
fully — the degradation is visible on the scorecard, never silent.

## Deltas vs baseline (flagged in the skill's CHANGELOG)

`severity_by_profile` (tag-time severity map; v1 users BR-03, ENV-04) · profiles repurposed to
failure-cost tiers declared in the descriptor (no `--profile` flag) · delivery-shaped `project_types`
· ten+ new check kinds + a `forge-protection` param extension · free-form `gate` on break-glass
judgments · no CONTRACT.md / reconcile mode (ledger hand-forms documented here) · `ledger` added to
the plane vocabulary. Everything else imitates baseline exactly. See `docs/spec/ARCHITECTURE.md §7`.
