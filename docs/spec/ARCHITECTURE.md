# pipeline-skill — Architecture Spec (v0.1)

How the future repo is shaped. Everything here either imitates baseline-skill's architecture exactly (§1, §3–§6, §8) or is a small, documented delta (§7). The binding constraints from the planning skeleton §0 are restated where they bite.

---

## 1. Design constraints (binding)

1. **Zero-dependency Node ≥ 18.** No npm packages, ever. Consequence: **no YAML parser** — all CI-workflow analysis is line/regex scanning (baseline's `workflow-permissions` precedent). Presence/absence claims are `deterministic`; structural workflow claims are `heuristic` and labeled as such.
2. **At-rest planes only:** tree (file presence/content), history (local git), forge (`gh` API), ledger (records). **No cloud-plane access** — the checker never observes real infra, staging data, flag states, or MTTR. It checks that *mechanisms and declarations* exist at rest; everything else is a sign-off ledger entry.
3. **`git` required on PATH; `gh` optional.** Every forge-reading rule carries `on_unreachable: skip` and degrades to an honest, labeled SKIP when offline or token-denied (baseline's convention). A SKIP never counts against readiness.
4. **Crash-resilient evaluation.** A broken rule degrades to SKIP, never a crashed run (baseline's evaluator contract).
5. **No duplication of baseline's coverage.** Overlap control per SPEC.md §5: pipeline rules adjacent to baseline rules are strictly narrower and cross-reference, never restate.

## 2. File map (the future repo)

Sibling of `baseline-skill/` (decision D1):

```
pipeline-skill/
  SKILL.md                 # agent surface — see SKILL-DRAFT.md
  README.md                # human surface: what it is, quickstart, relationship to baseline
  REFERENCE.md             # full reference: data flow, config keys, CI wiring, ledger format (baseline REFERENCE.md structure)
  GLOSSARY.md              # term definitions (profile tier, descriptor, sign-off ledger, break-glass, drift, FDRT…)
  check.mjs                # thin CLI over src/ — the checker; --repo/--config/--json/--no-exec/--self-check
  pipeline.mjs             # unified CLI: check (delegates to check.mjs) · jdg new|check · help
  rules.json               # rule-set manifest (name, version, project_types, profiles, modules)
  rules/
    desc.json  br.json  ci.json  env.json  iac.json  flag.json  rb.json  hot.json  gov.json
                           # one module per family — 39 rules total
  src/
    repo.mjs               # file index + git helpers (ls-files, ls-remote, tag list, ancestry)
    config.mjs             # DEFAULTS → detect → pipeline.config.json → --config
    validate.mjs           # hand-rolled JSON-schema validator (descriptor + records; zero-dep)
    evaluators.mjs         # one evaluator per check kind (§5)
    engine.mjs             # gate → evaluate → tag (§3), severity_by_profile resolution
    jdg.mjs                # judgment author + evaluator (new|check; expected_state/tripwire/review_by)
    report.mjs             # scorecard (blockers-first) + --json
  schema/
    repo.schema.json       # the descriptor schema (written out in §4.4)
    record.judgment.schema.json   # judgment record schema (§6) — field-identical to baseline's
    record.flag.schema.json       # flag registry record schema (§6.3)
  templates/
    pipeline.repo.json     # blank descriptor scaffold
    judgment.json          # judgment record scaffold (baseline's, re-homed)
    flag.json              # flag registry record scaffold
    hotfix.md              # HOT-01 section scaffold
    incident-response.md   # HOT-03 doc scaffold
    runbook-rollback.md    # RB-01 section scaffold
  config-presets/
    solo.repo.json  team.repo.json  critical.repo.json   # descriptor presets per tier
  config.example.json      # documented override keys (§8)
  test/                    # node:test unit tests for evaluators + engine (zero-dep, node --test)
```

Not in v1 (deferred, decisions D2/D5): `reconcile` cron mode, CONTRACT.md, hooks/, lane/admit/orient machinery (baseline's multi-agent lane workflow — out of this skill's domain).

## 3. Rule schema (copied from baseline, verbatim fields)

Rules are data. `rules.json` is the manifest:

```json
{
  "name": "pipeline-skill",
  "version": "0.1.0",
  "project_types": ["service", "app", "library", "docs", "infra"],
  "description": "Testable delivery-operations standard. 39 rules across descriptor, branching, CI/CD, environments, IaC, flags, rollback, hotfix/incident, and the ledger itself. Complexity scales with declared failure cost: profiles solo/team/critical.",
  "profiles": {
    "core": "Always on (= solo tier). Universal delivery-floor rules.",
    "team": "Active when the descriptor declares team or critical.",
    "critical": "Active only when the descriptor declares critical."
  },
  "modules": ["rules/desc.json", "rules/br.json", "rules/ci.json", "rules/env.json", "rules/iac.json", "rules/flag.json", "rules/rb.json", "rules/hot.json", "rules/gov.json"]
}
```

Each rule in `rules/*.json` carries baseline's field set verbatim:

| field | meaning |
|---|---|
| `id` | `FAMILY-NN` — frozen at taxonomy lock |
| `title` | one line |
| `category` | family name |
| `severity` | `blocker` \| `warn` \| `manual` |
| `severity_by_profile` | **NEW (delta §7.1)** — optional `{ "critical": "blocker" }`-style map; resolved at tag time |
| `profile` | `core` \| `team` \| `critical` (absent = core) |
| `applies_to` | `"all"` or subset of the closed set `service \| app \| library \| docs \| infra` |
| `source` | citation URL(s) (RULES.md carries the verbatim quotes) |
| `lesson` | short provenance tag |
| `rationale` | why the rule exists |
| `fix` | concrete remediation the `fix` mode applies |
| `sources` | ground-truth planes read: `tree` · `history` · `forge` · `ledger` |
| `on_unreachable` | `skip` (default) |
| `contexts` | `["check"]` (v1 has no admit/reconcile contexts) |
| `certainty` | `deterministic` \| `heuristic` \| `judgment` |
| `requires` | opt-in gate: `uses_feature_flags` for the FLAG family (baseline's `makes_external_claims` pattern) |
| `check` | `{ "kind": ..., ... }` — see §5 |

**Structural laws enforced by `--self-check`** (inherited from baseline, both hold across the locked catalog):
- a blocker must be `deterministic` — including any `severity_by_profile` escalation (the map may only escalate to `blocker` when `certainty` is `deterministic`);
- a `manual` (sign-off) rule must be `judgment`.

Plus baseline's structural checks: unknown kind/profile/severity/category/`applies_to`/`requires`, duplicate ids, orphan profiles, and a per-type coverage matrix.

## 4. Engine: gate → evaluate → tag

### 4.1 Verdicts
Per rule, one of **PASS / FAIL / WARN / SIGN-OFF / SKIP**; only a `blocker` FAIL sets exit 1.
- **SKIP** = the rule didn't apply: `applies_to` excludes the repo's `type` (`n/a for <type>`), an off profile tier (`profile 'critical' off`), FLAG opt-in not active, or nothing to check (`ok = null`, incl. forge unreachable with `on_unreachable: skip`). A skip never counts against readiness; forge SKIPs are labeled offline/token-denied.
- **SIGN-OFF** = a `manual` rule satisfied by a dated, unexpired `kind: sign-off` judgment whose `subject` is the rule id. The judgment ledger is the ONLY sign-off path; a lapsed sign-off is honestly not signed.

### 4.2 Profiles implementation (failure-cost tiers)
1. The descriptor's `profile` (`solo|team|critical`) is read from `pipeline.repo.json` at the target (its `type` supersedes auto-detection, exactly as baseline).
2. The ACTIVE set is cumulative: `core` always; `team` when declared tier ∈ {team, critical}; `critical` when declared tier = critical. `solo` = core only.
3. A rule whose `profile` ∉ ACTIVE SKIPs as `n/a`.
4. FLAG-family rules additionally require `uses_feature_flags: true` in descriptor/config OR a non-empty `records/flags/` directory (activation mirror of baseline's claims opt-in).
5. **Severity resolution:** at tag time, if the rule carries `severity_by_profile`, the effective severity = `severity_by_profile[declared_tier] ?? severity`. Pure map lookup; no other engine change. v1 ships exactly two users: BR-03 and ENV-04 (`warn` at team → `blocker` at critical).
6. Missing descriptor: profile resolution defaults to `solo` (core only) and DESC-01's warning tells the user why team/critical rules skipped.

### 4.3 Gate funnel (per rule, mirrors baseline)
`applies_to` includes type? → profile in ACTIVE? → `requires` satisfied (FLAG opt-in)? → evaluate `check.kind` → map `ok` to verdict (`true`→PASS; `false`+sign-off→SIGN-OFF; `false`+manual→WARN detail prompting judgment; `false`+warn→WARN; `false`+blocker→FAIL; `null`→SKIP).

### 4.4 Descriptor schema (`schema/repo.schema.json`, normative)

Hand-rolled validation (zero-dep, as baseline `src/validate.mjs`). This is the schema DESC-02 validates against; `config-presets/*.repo.json` and `templates/pipeline.repo.json` are authored from it:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "pipeline.repo.json descriptor",
  "type": "object",
  "required": ["type", "profile", "branching_model", "default_branch"],
  "additionalProperties": true,
  "properties": {
    "type": { "enum": ["service", "app", "library", "docs", "infra"] },
    "profile": { "enum": ["solo", "team", "critical"] },
    "branching_model": { "enum": ["trunk", "dev-staging-main", "gitflow"] },
    "default_branch": { "type": "string", "minLength": 1 },
    "environments": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "tier"],
        "properties": {
          "name": { "type": "string", "minLength": 1 },
          "tier": { "enum": ["dev", "staging", "prod"] },
          "gated": { "type": "boolean", "default": false }
        }
      }
    },
    "iac": {
      "type": "object",
      "properties": {
        "tool": { "enum": ["terraform", "pulumi", "cdk", "serverless", "cloudformation", "bicep"] },
        "state_backend": { "type": "string" }
      }
    },
    "uses_feature_flags": { "type": "boolean", "default": false },
    "branches": {
      "type": "object",
      "properties": {
        "integration": { "type": "string" },
        "staging": { "type": "string" },
        "production": { "type": "string" }
      },
      "_comment": "Optional. Unset keys fall back to branching_model conventions: trunk → default_branch; gitflow → develop; dev-staging-main → dev/staging/default_branch. Consumed by BR-04, ENV-03, HOT-02."
    },
    "recovery_objective": { "type": "string" }
  }
}
```

## 5. Check kinds

### 5.1 Reused from baseline (implement with the same semantics)
`any-file` (globs, `mode: present|absent`) · `grep` (globs + regex, `strip_comments`) · `file-contains` (globs + lookahead regex) · `json-field` (globs + dotted path + assert — listed for completeness; no locked rule uses it in v1) · `any-of` (sub-check composition) · `descriptor` / `descriptor-valid` (pipeline.repo.json presence/schema) · `workflow-state` (forge: workflow active/disabled) · `forge-protection` (forge: rulesets/protection reads) · `signoff` (ledger: unexpired sign-off judgment by subject).

`forge-protection` is **extended, not forked** (delta §7.4): new `gov` param values `reviews` (required approving review count ≥ 1 — BR-02) and `required-checks` (required status checks include named checks + strict policy — BR-03), alongside baseline's `protection` (BR-01).

### 5.2 New kinds (each small, each crash-resilient; full check specs in RULES.md per rule)
| kind | plane(s) | rules | evaluates |
|---|---|---|---|
| `env-inventory` | tree+forge | ENV-01 | descriptor `environments[]` vs `gh api …/environments` vs workflow `environment:` keys; consulted-set agreement; forge gap labeled |
| `env-protection` | forge | ENV-04 | protection rules (required reviewers/wait timer/branch restriction) on the descriptor's prod-tier environment |
| `branch-model` | history/forge | BR-04 | descriptor `branching_model` vs `git ls-remote --heads` (local refs offline) |
| `stale-branches` | history | BR-05 | unmerged tips older than config `stale_branch_days` (default 30); declared tier branches exempt |
| `hotfix-backmerge` | history | HOT-02 | `hotfix/*` tips are ancestors of the dev-line branch; `null` when no hotfix refs exist |
| `profile-consistency` | tree+forge | DESC-03 | descriptor tier vs observed tier-bearing artifacts (forge envs, gating signals, IaC presence) |
| `flag-registry` | tree | FLAG-02/03 | parse `records/flags/*.json`; `assert: owner` (non-empty owner) · `assert: freshness` (review_by present unless permanent type; none past-due) |
| `workflow-job-order` | tree | CI-06 | line-scan: deploy-signal job block contains `needs:` referencing build/test-signal job blocks; `heuristic` by construction |
| `jdg-health` | ledger | GOV-01 | the `jdg check` evaluator run in-check: zero expired/tripped/invalid → PASS |
| `breakglass-ledger` | ledger(+forge) | HOT-04 | every break-glass record valid, gated, owned, unexpired; best-effort forge bypass cross-ref, labeled when unreachable |

### 5.3 Degradation honesty
Every evaluator returns `ok ∈ {true, false, null}`; `null` → SKIP with a reason string. Forge evaluators record exactly which queries ran and report `forge: not consulted` when degraded (baseline OPS-07's "one recorded query" pattern). CI-02/CI-03/IAC-06's deterministic locks are presence claims over closed glob sets — their escape hatches (`risk-acceptance` / `deviation` judgments) are documented in the rules themselves (RULES.md, locked resolution R1/R3).

**Descriptor presence/content split (DESC-01 vs DESC-02).** `descriptor-valid` (DESC-02, a blocker) returns `null` → SKIP when `pipeline.repo.json` is **absent** — a missing descriptor is DESC-01's warning, never DESC-02's blocker FAIL. The blocker fires only on a *present-but-invalid* descriptor (`ok = false`). This keeps the `blocker⇒deterministic` law honest: a no-descriptor repo scores as `solo` (core only, §4.2.6) with a single DESC-01 warning, not a red build.

## 6. Records & the sign-off ledger

### 6.1 Judgment records — `records/judgments/JDG-NNNN.json`
Field-identical to baseline's `schema/record.judgment.schema.json` (one judgment, one owned file):

```json
{
  "record": "judgment/1",
  "id": "JDG-0001",
  "kind": "sign-off | deviation | risk-acceptance | break-glass",
  "date": "2026-07-20",
  "by": "human-handle",
  "subject": "RB-02",
  "reason": "why this judgment holds",
  "review_by": "2026-10-01",
  "expected_state": { "descriptor.profile": "critical" },
  "tripwire": { "fact": "descriptor.profile", "op": "ne", "value": "critical" },
  "gate": "environment:production   (break-glass only)"
}
```

- **Kinds:** `sign-off` satisfies a manual rule (subject = rule id, unexpired) · `deviation` accepts a rule violation (CI-03, ENV-02, IAC-03, IAC-06, DESC-03 escapes) · `risk-acceptance` accepts a risk with expiry + tripwire (BR-05, FLAG-03, CI-02 escapes) · `break-glass` records a gate bypass (HOT-04).
- **Delta (§7.5):** `gate` is a free-form string naming the bypassed mechanism (`ruleset:main`, `environment:production`) — baseline's enum (`admit|reconcile`) doesn't apply; pipeline-skill v1 has no admit/reconcile gates.
- **Evaluation (`pipeline jdg check`):** `expected_state` mismatch → DRIFTED · tripwire true → TRIPPED (voids) · `review_by` passed → EXPIRED · schema-invalid → INVALID. Facts namespace: `descriptor.*` · `planes.*` · `git.*` · `today`. Exit 1 on tripped/expired/invalid. GOV-01 runs this evaluator in-check.
- **Authoring (`pipeline jdg new`):** date-valued tripwire comparands are computed at authoring time and stored as literals (e.g. RB-02's `<last-drill + rollback_drill_days>` resolves to a concrete ISO date in the record) — the evaluator only ever compares a fact against a literal, per baseline's op contract.
- **Never fake a sign-off** (inherited law): a real dated judgment by the user, or nothing. `fix` mode walks the user through the judgment and records it — never rubber-stamps.
- A repo running both skills shares one `records/judgments/` tree; each checker evaluates the subjects it knows (SPEC.md §5).

### 6.2 Sign-off rules and their prompts
| rule | the dated judgment records |
|---|---|
| ENV-05 | staging data realism reviewed (volume/shape vs prod; gaps named) — prompt quotes SRE Workbook ch.13 with its data-pipeline context |
| RB-02 | rollback drill evidence: date, what was rolled back, what broke; `review_by ≤ rollback_drill_days` (default 90) |
| RB-04 | declared `recovery_objective` reviewed against actual incidents/drills (FDRT vocabulary) |

### 6.3 Flag registry — `records/flags/FLAG-NNNN.json`
One flag, one record (patterned on baseline's per-claim records):

```json
{
  "record": "flag/1",
  "id": "FLAG-0001",
  "name": "new-checkout-flow",
  "owner": "human-handle",
  "type": "release | experiment | operational | kill-switch | permission | sunset",
  "created": "2026-07-01",
  "review_by": "2026-08-10",
  "notes": "what it gates; removal plan"
}
```

Default review horizons (informed by Unleash's shipped per-type lifetimes — RULES.md FLAG-03 SOURCE): release 40d · experiment 40d · operational 7d · sunset 90d · kill-switch/permission permanent-class (review within `permanent_flag_review_days`, default 365). `templates/flag.json` ships the scaffold.

## 7. Deliberate engine deltas vs baseline (each flagged in the skill's CHANGELOG at implementation)

1. **`severity_by_profile`** — optional per-rule map resolved at tag time (§4.2.5). The one functional engine change. v1 users: BR-03, ENV-04. Self-check law extended: escalation to `blocker` requires `certainty: deterministic`.
2. **Profiles repurposed** — expertise levels → declared failure-cost tiers (`core/team/critical`, declared in the descriptor rather than via `--profile` flag). Same gating machinery, different semantics; the `--profile` CLI flag is replaced by descriptor-driven activation.
3. **`project_types` axis** — delivery-shaped closed set `{service, app, library, docs, infra}` (D3). Auto-detect: IaC markers ⇒ `infra` (unless code manifest present ⇒ `service`/`app`); `package.json`/framework markers ⇒ `app`; publishable-manifest-only ⇒ `library`; else `docs`. Descriptor `type` supersedes.
4. **Ten new check kinds + `forge-protection` param extension** (§5) — additive; reused kinds keep baseline semantics.
5. **`gate` field free-form** on break-glass judgments (§6.1) — no admit/reconcile gates exist in v1.
6. **No CONTRACT.md, no reconcile mode** (D2/D5 deferred) — ledger hand-forms documented in REFERENCE.md instead; CLI is `check` + `jdg` + `--self-check` only.
7. **Ledger planes union** — `sources` adds `ledger` to baseline's `tree|history|forge|exec` plane vocabulary (GOV-01, HOT-04, sign-off rules).

Everything else — data flow (index → config → gate/evaluate/tag → report), scorecard shape, `--self-check`, config resolution order, `on_unreachable` semantics, crash resilience — imitates baseline exactly.

## 8. Config (`config.example.json` → `<repo>/pipeline.config.json`)

Auto-detect with explicit pin; `_comment` documentation convention (baseline's):

```json
{
  "_comment": "Copy to pipeline.config.json at your repo root. Auto-detect is sensible; override only what you need. The descriptor (pipeline.repo.json) declares posture; this file tunes checks.",
  "type": "service",
  "_type": "service | app | library | docs | infra. Superseded by pipeline.repo.json's type when present.",
  "uses_feature_flags": false,
  "_uses_feature_flags": "true (or a records/flags/ dir) activates the FLAG family (opt-in).",
  "stale_branch_days": 30,
  "_stale_branch_days": "BR-05 flags unmerged branch tips older than this.",
  "release_mark_grace_days": 90,
  "_release_mark_grace_days": "BR-06 SKIPs repos younger than this (first-commit date) — no release-theater.",
  "rollback_drill_days": 90,
  "_rollback_drill_days": "RB-02's sign-off prompt expects drill evidence fresher than this.",
  "permanent_flag_review_days": 365,
  "_permanent_flag_review_days": "FLAG-03: kill-switch/permission flags need review_by within this window.",
  "prod_environment_name": "production",
  "_prod_environment_name": "Which descriptor environments[] entry ENV-04 treats as the gated prod tier (matched on tier:prod first, name second).",
  "deploy_globs": [],
  "_deploy_globs": "OPT-IN extra globs whose files CI-03/CI-04/CI-06 scan as deploy definitions (non-standard CD layouts). Empty = default CI paths only.",
  "iac_globs": [],
  "_iac_globs": "OPT-IN extra globs scanned by IAC-03/04/06 (custom IaC layouts). Empty = standard IaC markers.",
  "required_check_names": [],
  "_required_check_names": "BR-03: the status checks the default-branch ruleset must require. Empty = derive from the name: lines of CI-01-matched workflows (labeled heuristic).",
  "source_globs": [],
  "_source_globs": "OPT-IN source/dependency globs FLAG-01 scans for flag-SDK imports. Empty = defaults (src/**/*.{js,jsx,ts,tsx,py,go,rb} + package.json, requirements.txt, pyproject.toml, go.mod, Gemfile)."
}
```

## 9. CI wiring

The standard only bites if CI runs it on every PR (baseline BUILD-06's self-gating pattern — the meta-rule: *the pipeline check itself runs as a required CI job*):

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

Make `pipeline` a required status check (which is itself BR-03's verify surface at team+). In the **skill's own repo**, CI additionally runs `node check.mjs --self-check` so a malformed rule set can't merge. Offline/forge-less CI runners still work: forge rules SKIP labeled, tree/history/ledger rules score fully — the degradation is visible on the scorecard, never silent.

## 10. Invocation contract (for agents)

- Always invoke by **absolute path**; never copy `check.mjs` away from `rules.json` + `rules/` + `src/` (it loads them from its own directory).
- Requires Node ≥ 18 and `git` on PATH — if `node` is missing, say so rather than guessing.
- `gh` absence is not an error: forge rules degrade to labeled SKIPs.
- Exit codes: `1` = a blocker FAILED · `0` = otherwise (warnings and SKIPs ride the output). `jdg check`: `1` on tripped/expired/invalid records. `--self-check`: `1` on a malformed rule set.
