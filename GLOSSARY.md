# Glossary

Terms used by pipeline-skill's rules, scorecard, and docs. For the full reference see `REFERENCE.md`;
for the normative design see `docs/spec/`.

## At-rest planes
The four ground-truth sources the checker reads: **tree** (file presence/content), **history**
(local git), **forge** (`gh` API), **ledger** (records). Deliberately *no cloud plane* — the checker
never observes real infra, staging data, live flag states, or MTTR. It verifies mechanisms and
declarations exist at rest; everything a script can't see resolves via the ledger.

## Blocker
A rule severity whose FAIL sets **exit 1** (fails CI). The bar is *0 blockers*, not 100%. A blocker
must be `deterministic` (enforced by `--self-check`). Contrast **warn** (advisory, never fails CI)
and **manual** (resolved by a sign-off judgment).

## Break-glass
A consciously-recorded gate bypass — an emergency change that skipped a normal control. Recorded as a
`kind: break-glass` judgment naming the `gate` it relieved (e.g. `ruleset:main`,
`environment:production`) and landing via its own PR. **HOT-04** accounts for these: every one must
be valid, gated, owned, and unexpired.

## Certainty
The honesty label on every rule. **deterministic** — presence/absence or set comparison (provable).
**heuristic** — line-scan inference (a signal, never dressed up as proof; e.g. YAML workflows are
regex-scanned, not parsed). **judgment** — resolvable only by a human via the ledger. Split across
the catalog: 23 / 13 / 3.

## Descriptor
`pipeline.repo.json` at the repo root — the one file pipeline requires (schema
`schema/repo.schema.json`). Declares `type`, `profile` (the failure-cost tier), `branching_model`,
`default_branch`, and optional `environments`, `iac`, `uses_feature_flags`, `branches`,
`recovery_objective`. Its `type` supersedes auto-detection; its `profile` selects the active rule set.
**DESC-01** checks presence, **DESC-02** validity, **DESC-03** consistency with reality.

## Deviation
A `kind: deviation` judgment: a dated, reasoned, expiring acceptance of a specific rule *violation*
(CI-03, ENV-02, IAC-03, IAC-06, DESC-03 escapes). "We're doing X against the rule, on purpose,
until this date." Named in the ledger, never silent.

## Drift
When observed reality diverges from a declared/assumed state. Two senses: (1) **descriptor drift** —
the declared tier no longer matches the repo (the inverse-nag, DESC-03); (2) **judgment drift** — a
judgment's `expected_state` no longer holds (`jdg check` marks it **DRIFTED**, ≈). Critical tier
mandates active drift detection.

## Expected_state
A judgment's snapshot of the world it assumed — a map of dotted fact path → expected value (e.g.
`{"descriptor.profile": "critical"}`). `jdg check` marks the judgment DRIFTED when a fact no longer
matches. Advisory: drift surfaces as a note, it doesn't fail the ledger by itself.

## FDRT
**Failure-Detection-to-Recovery-Time** — the vocabulary for `recovery_objective`: how long from a
failed deploy being detected to service being restored. **RB-04** is the sign-off that the declared
objective was reviewed against actual incidents and drills.

## Forge
The git host's API layer, read via `gh` (GitHub in v1): branch protection, rulesets, environments,
workflow state. **Optional** — every forge-reading rule carries `on_unreachable: skip` and degrades
to a labeled SKIP when `gh` is offline or token-denied. A forge SKIP on a gating rule (BR-03, ENV-04)
means **unverified**, not **fine**.

## Gate (break-glass)
The free-form string on a break-glass judgment naming the bypassed mechanism (`ruleset:main`,
`environment:production`). A delta vs baseline's `admit|reconcile` enum — pipeline-skill v1 has no
admit/reconcile gates.

## Inverse-nag
**DESC-03**. Most checks nag you to *add* process; the inverse-nag flags a *mismatch in either
direction* — declaring more than you carry (critical tier, no gated prod) **or** carrying more than
you declare (solo tier with staging + review). Resolve it in the descriptor, in the repo, or as a
dated `deviation` — never silently.

## Judgment
A dated, owned, scoped, reasoned, **expiring** record in the sign-off ledger
(`records/judgments/JDG-NNNN.json`). Four kinds: **sign-off**, **deviation**, **risk-acceptance**,
**break-glass**. The only path for anything a script can't decide. Authored/evaluated with
`pipeline jdg new|check`. Never faked: a real dated judgment by a person, or nothing.

## Manual (severity)
A rule a script can't decide (staging data realism, rollback drills, reviewed recovery objective —
ENV-05, RB-02, RB-04). Satisfied only by a matching `kind: sign-off` judgment; otherwise it surfaces
as a WARN prompting the judgment. A `manual` rule must be `judgment` certainty (enforced by
`--self-check`).

## Profile tier
The declared failure cost — **solo | team | critical** — set in the descriptor's `profile`. The
active rule set is cumulative (core ⊂ team ⊂ critical): solo = core only; team = core+team;
critical = everything. The philosophy mechanized: *complexity scales with failure cost*. Off-tier
rules SKIP as `n/a` and never count against you.

## Recovery objective
The declared target recovery posture (`recovery_objective` in the descriptor) — one line stating how
fast, and by what mechanism, service is restored after a failed deploy. Reviewed against reality by
**RB-04** (sign-off), in FDRT terms.

## Risk-acceptance
A `kind: risk-acceptance` judgment: a dated acceptance of a *risk* (as opposed to a rule violation),
carrying an expiry and a **tripwire** that voids it if the accepted world changes (BR-05, FLAG-03,
CI-02 escapes).

## Self-check
`check.mjs --self-check` — validates the *rule set* (never a target) against its structural laws
(blocker ⇒ deterministic, manual ⇒ judgment and its inverse, uniform FLAG opt-in, no unknown/duplicate
/orphan metadata) and prints a per-type **coverage matrix**. Wire it into the skill's own CI so a
malformed rule set can't merge.

## Severity_by_profile
An optional per-rule map that raises a rule's severity at a higher tier, resolved at tag time. v1 has
exactly two users — **BR-03** and **ENV-04**: `warn` at team → `blocker` at critical. Escalation to
`blocker` requires `deterministic` certainty (self-check law).

## Sign-off
(1) A rule severity (**manual**) resolved through the ledger. (2) The judgment `kind` that resolves
it: a dated human judgment whose `subject` is the rule id, satisfying that rule while unexpired. A
lapsed sign-off is honestly *unsigned* — **GOV-01** makes ledger health a scored blocker so an
expired sign-off can't silently void the rule it was satisfying.

## Sign-off ledger
`records/judgments/` — the append-only home of every judgment. The one place the exceptions and
human decisions a script can't make are recorded: dated, owned, reasoned, expiring. Shared format
with baseline-skill (a repo running both shares one ledger; each checker evaluates the subjects it
knows).

## SKIP
A verdict meaning *the rule didn't apply*: `applies_to` excludes the repo's type, an off profile
tier, the FLAG opt-in is inactive, or nothing to check (incl. forge unreachable). A SKIP **never**
counts against readiness — but a forge SKIP on a gating rule means unverified, not fine.

## Staging data realism
That a staging environment's data resembles production in volume and shape closely enough to catch
what prod would (ENV-05, a critical-tier sign-off) — a thing a script cannot see, so it resolves
through a dated judgment naming the gaps.

## Tripwire
The machine-evaluable condition on a judgment that **voids** it when it becomes true — how the engine
detects the accepted world changed (`jdg check` → **TRIPPED**, ✗). A `fact` + `op` (+ `value`);
date-valued comparands are resolved to literal ISO dates at authoring time.
