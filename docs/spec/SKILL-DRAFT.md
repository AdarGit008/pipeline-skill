# SKILL-DRAFT.md — draft of pipeline-skill/SKILL.md (v0.1.0)

> Draft for review. Frontmatter + modes adapted from baseline-skill's SKILL.md; structure and tone imitated faithfully. When approved, this file's content below the rule becomes `SKILL.md` in the new repo verbatim.

---

```markdown
---
name: pipeline
description: "Use when asked to score a repo's delivery posture, audit CI/CD, check branching/environments/IaC/flags/rollback readiness, or adopt/scaffold the pipeline standard. Runs a zero-dependency Node checker (39 rules across descriptor & declared posture, branching & PR workflow, CI/CD stages, environment tiers, infrastructure as code, feature flags, rollback & recovery, hotfix & incident flow, and the sign-off ledger), reads the scorecard, and helps fix or scaffold what's missing — calibrated to declared failure cost (solo/team/critical)."
version: 0.1.0
author: Adar (AdarGit008)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [pipeline, delivery, ci-cd, devops, iac, feature-flags, rollback, environments, readiness]
    related_skills: [baseline, requesting-code-review, plan, systematic-debugging]
---

# pipeline-skill

## Overview

A **testable delivery-operations standard**: 39 rules, each backed by a check a zero-dependency Node runner executes on a repo *at rest*. Blockers fail CI (`exit 1`); the judgment calls a script can't make resolve via a dated **sign-off ledger**. The throughline: *complexity scales with failure cost* — you declare your tier (`solo` / `team` / `critical`) once, and the standard holds you to exactly that much process, no more, no less. A delivery-practices doc drifts; this is the delivery checklist as an exit code.

Runs natively under **Hermes** and **Claude Code** (and any agent that loads `SKILL.md`). The runner is portable — plain Node, no agent-specific dependency. Sibling of **baseline-skill** (repo readiness), not a fork: baseline answers *"ready to build and maintain?"*, pipeline answers *"can it ship, recover, and prove it?"* — installable alongside, sharing one `records/judgments/` ledger format.

## When to Use

- "score this repo's delivery posture", "run pipeline", "audit the CI/CD setup"
- "are our environments / deploys / rollback actually in order?"
- "set up / adopt / scaffold the pipeline standard here"
- "fix the pipeline failures", "get delivery to green"
- "what does ENV-04 check", "why did IAC-04 fail"

**Don't use for:** build/test/secrets/reproducibility readiness (use **baseline**), general logic/bug review (use a code-review skill), or runtime/cloud truth — pipeline checks *delivery mechanisms and declarations at rest*; it can never see your actual infra, staging data, or flag states. What a script can't see resolves via the sign-off ledger.

## Setup — resolve the toolkit path first

`$SKILL_DIR` = the absolute path of the directory containing this file. Resolve it to a concrete path before running anything (never pass the literal `$SKILL_DIR` to the shell). Typical locations:
- Hermes: `~/.hermes/skills/software-development/pipeline`
- Claude Code: `~/.claude/skills/pipeline`

The unified CLI is **`pipeline.mjs`** — `node "<abs>/pipeline.mjs" <command>` (`check`, `jdg`, `help`); `pipeline check …` delegates to `check.mjs`, still the checker. Both load the rule set (`rules.json` manifest + `rules/` modules) and `src/` from their own directory, so always invoke **by absolute path**; don't copy them away from the rule set + `src/`. Requires **Node ≥ 18 and `git`** on PATH — if `node` is missing, say so rather than guessing. **`gh` is optional**: forge-reading rules degrade to honest, labeled SKIPs offline or token-denied.

Co-located files: `pipeline.mjs` (CLI entry: check / jdg), `check.mjs` (the checker), `rules.json` + `rules/` (the rule-set manifest + the 39 rules, one module per family), `schema/` (descriptor + judgment + flag-registry schemas), `config.example.json`, `templates/` (scaffolds), `config-presets/` (per-tier descriptor presets), `REFERENCE.md` (full reference), `GLOSSARY.md` (term definitions).

## The descriptor — declare your failure cost first

Everything hangs off `pipeline.repo.json` at the repo root: `type`, `profile` (`solo|team|critical`), `branching_model`, `default_branch`, `environments[]`, `iac`, `uses_feature_flags`, `branches` (optional tier-branch names; unset keys fall back to the `branching_model` conventions), `recovery_objective`. The `profile` field *is* the philosophy mechanized:

- **solo** — the pipeline must exist, be automated, be alive; rollback documented. No required review, no staging, no IaC mandate.
- **team** (adds) — protected default branch, PR review ≥1, declared environments each with an automated deploy path, IaC not console-clicking, documented hotfix path.
- **critical** (adds) — gated prod promotion (blocker), staging data realism (sign-off), rollback *drills* (sign-off), drift detection, break-glass accounting.

Tiers are cumulative; off-tier rules SKIP as `n/a` and never count against you. Declare more than you carry (or carry more than you declare) and **DESC-03** (the inverse-nag) says so — resolve it in the descriptor, in the repo, or as a dated `deviation` judgment, never silently.

## Judgments — the sign-off ledger

The rules a script can't decide (staging data realism, rollback drills, reviewed recovery objective) and the exceptions you consciously accept (a manual deploy, an external CI system, a kept expired flag) are **ledger records, not chat**:

```bash
node "$SKILL_DIR/pipeline.mjs" jdg new --kind <sign-off|deviation|risk-acceptance|break-glass> \
  --subject <RULE-ID-or-scope> --reason "..." --review-by <date> [--tripwire "fact op value"]
node "$SKILL_DIR/pipeline.mjs" jdg check     # ✓ ok · ≈ drifted · ? unresolvable · ⏰ expired · ✗ tripped
```

One judgment, one file: `records/judgments/JDG-NNNN.json`. Every judgment is dated, owned, scoped, reasoned — and **expires** (`review_by`); a tripwire voids it when the accepted world changes. A `kind: sign-off` judgment whose subject is a manual rule's id satisfies that rule while unexpired; **GOV-01** makes ledger health itself a scored blocker, so an expired judgment can't silently void the rule it was satisfying. A `break-glass` record names the gate it relieved (HOT-04) and lands via its own PR. **Never fake a sign-off**: a real dated judgment by the user, or nothing.

## Modes

Figure out intent from the user's words; default to **score**.

### score (default)
1. Pick the target repo: an explicit path, else the current working directory. Confirm it looks like a repo (a manifest or `.git`).
2. Run the runner:
   ```bash
   node "$SKILL_DIR/check.mjs" --repo <target>
   ```
   - `--json` — machine output instead of the scorecard.
   - `--no-exec` — reserved; v1 has no exec-class checks (kept for CLI parity).
   - **Completion criterion:** you have the readiness %, the blocker count, and each FAIL/notable WARN with its one-line detail.
3. Present it: lead with **blockers** (they fail CI), then warnings worth fixing, grouped by family. Don't dump all 39 rows — summarize and offer to fix or scaffold. Say which rules SKIPs affected (off-tier, opt-in, forge-offline) — a `critical` repo scored offline never had its prod gate verified; say that out loud.

### init — "set up / adopt / scaffold pipeline"
**Descriptor-first, always.** The repo's `pipeline.repo.json` is written before anything else — it's the one file pipeline requires (schema: `schema/repo.schema.json`), and every profile/cross-check derivation reads it. Its `type` supersedes filesystem auto-detection.
1. **Write the descriptor.** Copy the closest tier preset (or the blank template), then set the fields to reality:
   ```bash
   cp "$SKILL_DIR/config-presets/team.repo.json" <repo>/pipeline.repo.json   # or solo / critical; templates/pipeline.repo.json is blank
   ```
   Choose the tier by honest failure cost (what breaks, for whom, if this ships broken?) — not by aspiration. DESC-03 will hold the declaration to the observed reality.
2. **Tune the checks (optional).** Copy `config.example.json` to `<repo>/pipeline.config.json` and set thresholds (`stale_branch_days`, `rollback_drill_days`, `prod_environment_name`, `uses_feature_flags`, `required_check_names`). Opt-in `*_globs` keys stay empty until adopted.
3. Scaffold only what's missing (never overwrite without asking):
   ```bash
   mkdir -p <repo>/records/flags && cp "$SKILL_DIR/templates/flag.json" <repo>/records/flags/FLAG-0001.json   # only if flags are used — opt-in family
   cp "$SKILL_DIR/templates/runbook-rollback.md" <repo>/RUNBOOK.md   # RB-01, if no rollback section exists
   ```
4. Wire the `pipeline` job into CI as a **required** check (snippet in `REFERENCE.md`) — the standard can't rot once it's enforced on every PR.
5. Run a first score — `DESC-01` confirms the descriptor is present, `DESC-02` that it schema-validates.
- **Completion criterion:** `pipeline.repo.json` exists and validates (DESC-01 + DESC-02 PASS), `node check.mjs --repo <repo>` runs, and every scaffolded artifact is accounted for.

### fix — "get this to green"
1. Score first. For each blocker/warn to address, apply the rule's own `fix` field (read it from `rules.json`) as concrete edits — add the missing rollback section, protect the default branch, git-ignore the tfvars, add the drift cron, declare the environments.
2. For `manual` (sign-off) rules, **don't fake the check** — do the judgment with the user (staging data realism, the rollback drill, the recovery-objective review) and record it dated and expiring: `pipeline jdg new --kind sign-off --subject <RULE-ID> --reason "..." --review-by <date>`.
3. For conscious exceptions (manual deploy by design, external CI, a justified long-lived branch), record `deviation` / `risk-acceptance` judgments the same way — named, reasoned, expiring.
4. Re-score to confirm.
- **Completion criterion:** re-score shows the targeted rules resolved and no new blockers introduced.

### explain — "what does ENV-04 check", "why did IAC-04 fail"
Read the rule from `rules.json` (`title`, `rationale`, `fix`, `source`, `check`) and explain it plainly plus what the runner actually looked for — including which plane answered (tree / history / forge / ledger) and whether a forge SKIP means "fine" or "unknown". For unfamiliar jargon (sign-off ledger, break-glass, drift, FDRT, inverse-nag, …) point to `GLOSSARY.md`.

## Rule-set integrity — `--self-check`

The rule set validates itself:
```bash
node "$SKILL_DIR/check.mjs" --self-check
```
Exits 1 on any rule with a missing/typo'd `applies_to`, an unknown check-kind / profile / severity / category / `requires` key, a duplicate id, an orphan type/profile, a non-deterministic blocker (including any `severity_by_profile` escalation), or a non-judgment sign-off — and prints a per-type **coverage matrix**. Use it if you edit the rule modules under `rules/` (or the `rules.json` manifest), and wire it into CI so a malformed rule set can't merge.

## How the runner decides (so you can read detail lines)

- **PASS / FAIL / WARN / SIGN-OFF / SKIP** per rule; only a `blocker` FAIL sets exit 1.
- **SKIP** = the rule didn't apply: `applies_to` excludes the repo's `type`, an off profile tier (`profile 'critical' off`), the FLAG opt-in is inactive, or nothing to check (incl. forge unreachable). A skip never counts against readiness — but forge SKIPs on gating rules (BR-03, ENV-04) mean *unverified*, not *fine*; report them as such.
- **Profiles** come from the descriptor's declared tier: `solo` = core only; `team` = core+team; `critical` = everything. Two rules escalate severity by tier (BR-03, ENV-04: warn at team, blocker at critical).
- **Certainty** is labeled: `deterministic` (presence/absence, set comparison), `heuristic` (line-scan inference — never dressed up as proof), `judgment` (ledger only).
- The runner is zero-dependency and crash-resilient: an unevaluable check degrades to SKIP, never crashing the run.

## Common Pitfalls

1. **Copying `check.mjs` away from the rule set (`rules.json` + `rules/`) + `src/`.** It loads them from its own directory — invoke by absolute path instead.
2. **Presenting a warn as a blocker (or vice-versa).** Severity is in the rule modules and the runner output — never upgrade/downgrade it. Two rules legitimately change severity by declared tier (BR-03, ENV-04) — that's the descriptor talking, not you.
3. **Faking a sign-off.** Manual rules exist because a script can't judge them; record a real dated judgment (`pipeline jdg new --kind sign-off`), don't rubber-stamp.
4. **Declaring `critical` for the badge.** The tier is a commitment: critical activates the sign-off surface (drills, staging realism, reviewed objectives) and escalates two blockers. Declare the tier whose process you'll actually carry — DESC-03 compares the declaration to reality.
5. **Reading an offline score as a green score.** Forge rules SKIP labeled when `gh` is unreachable; a critical-tier repo whose prod gate was never verified is not "passing" — say so.
6. **Gaming a warn to hit 100%.** An honest advisory warn beats presence-theater. 0 blockers is the bar; the ledger exists for everything else.

## Verification Checklist

- [ ] Ran the runner by its **absolute** path with `--repo <target>`
- [ ] Reported **blockers first**, then warnings, grouped by family (not a 39-row dump)
- [ ] Named which rules SKIPs affected (off-tier / opt-in / forge-offline) — and said "unverified", not "fine", for gating rules that skipped
- [ ] For `fix`: re-scored and confirmed no new blockers
- [ ] For `init`: picked a tier preset by honest failure cost, scaffolded only what was missing, ran a first score
- [ ] Any sign-off is a real dated judgment, not a rubber stamp
- [ ] `--self-check` still passes if the rule set (`rules.json` / `rules/*.json`) was edited
```
