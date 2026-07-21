# Citation Review — RULES.md (LOCKED v0.1)

**Reviewer:** research subagent · **Date:** 2026-07-21 · **Scope:** every rule SOURCE field in `spec/RULES.md` (39 rules, 48 unique source URLs) + appendix pre-labeled items.

**Method:** each SOURCE URL was fetched in full (46 pages) and each quoted passage was matched against the live page text. The two PDF sources (DORA 2023 report, NIST SP 800-53r5) carry honesty labels restricting verification to search snippets / draft-markup + mirror channels; those channels were re-exercised rather than re-flagged. Machinery rules were checked for label presence and accuracy only.

**Verdict classes:** VERBATIM (quote found as written, allowing whitespace/casing/markup differences) · PARAPHRASE · NOT FOUND · UNREACHABLE · N/A (labeled machinery / URL-only citation).

---

## Verdict table

| Rule | Quote status | Source quality | Notes |
|---|---|---|---|
| DESC-01 | VERBATIM | Primary — GitHub Docs | "Environments are used to describe a general deployment target like `production`, `staging`, or `development`." confirmed verbatim. |
| DESC-02 | N/A — machinery | Label present, accurate | "machinery rule — no external claim" label in place; baseline precedent stated explicitly. Correctly carries no external citation. |
| DESC-03 | VERBATIM | Primary — DORA capability page | Full CAB / "no evidence was found" passage confirmed verbatim on dora.dev (curly apostrophes in original). |
| BR-01 | VERBATIM | Primary — GitHub Docs | Required-status-checks sentence confirmed verbatim on *About protected branches*. |
| BR-02 | VERBATIM (via labeled channel) | Primary — DORA 2023 report PDF | **Honesty label present and accurate** — quote re-confirmed this review via search snippet served from the dora.dev PDF itself; full PDF not text-extracted, matching the label. **Rationale gap (minor):** "in contrast to external heavyweight approval" is not covered by BR-02's own SOURCE; it rests on the DORA change-approval capability cited only in DESC-03. See fix list. |
| BR-03 | VERBATIM | Primary — GitHub Docs + GitLab Docs | All three quotes confirmed. Strict-mode quote is assembled from adjacent table cells ("The branch **must** be up to date…" + "This is the default behavior…") joined with "..." — verbatim fragments, honestly elided. |
| BR-04 | VERBATIM | Primary — DORA capability page | 2016/2017 analysis passage incl. all three bullet practices confirmed verbatim. |
| BR-05 | VERBATIM | Primary — DORA capability page | Both quotes confirmed ("few hours" / "bigger and more complex merge events… code lock… code freeze"). |
| BR-06 | VERBATIM | **Personal blog** — nvie.com (canonical GitFlow origin) | Hotfix-tag sentence confirmed verbatim. **Weakest citation class in the catalog:** sole source, personal blog, no official corroboration. See fix list. |
| CI-01 | VERBATIM | Primary — DORA capability page | "A CI system that runs the build and automated tests on every check-in." confirmed (bold list item in original). |
| CI-02 | VERBATIM | Primary — DORA capability page | Both quotes confirmed (key-elements bullets + 2015-report paragraph). "Survives as written" annotation accurate. |
| CI-03 | VERBATIM | Primary — DORA + Google SRE Book ch.8 | All four quotes confirmed (push-of-a-button, same-process-every-environment, console-clicking target for improvement, "Releases are truly automatic…"). |
| CI-04 | VERBATIM | Primary — DORA + Google SRE Book ch.17 | Smoke-test inputs quote, step-5 quote, and SRE ch.17 smoke/sanity-testing quote all confirmed verbatim. |
| CI-05 | N/A — no quote in SOURCE (URL-only citation) | Primary — GitHub Docs | "Mechanism lift" label present and accurate (baseline OPS-07 precedent named). Cited page documents the 60-day auto-disable — **scoped to scheduled workflows in public repositories**; CHECK wording ("in practice the disabled_* family") is consistent. Optional scope note, see fix list. |
| CI-06 | VERBATIM | Primary — AWS DevOps Guidance [DL.ADS.1] | Progressive-validation + gate sentences confirmed (ellipsis elides one sentence about gamma environments). |
| ENV-01 | VERBATIM | Primary — AWS Well-Architected OPS05-BP08 + GitHub Docs | Both quotes confirmed verbatim. |
| ENV-02 | VERBATIM | Primary — DORA capability page | "Allow anyone with the necessary credentials…" + ticket sentence confirmed. |
| ENV-03 | VERBATIM | Primary — AWS DL.ADS.1 + DORA CI | Both quotes confirmed. "NARROWED" annotation accurate: DORA quote covers *build* cadence only, not deploy cadence. |
| ENV-04 | VERBATIM (NIST via labeled channel) | Primary — GitHub Docs + GitLab Docs + NIST SP 800-53r5 + SRE Workbook | GitHub deployment-protection-rules quote, GitLab protected-environments quote, and Spotify staged-deploy quote all confirmed verbatim on page. **NIST CM-3 label accurate:** control text verbatim-confirmed against the csrc.nist.gov draft-markup PDF and csf.tools mirror (items b/d/e assembled with "..."), exactly as the label states. |
| ENV-05 | VERBATIM | Primary — SRE Workbook ch.13 + Twelve-Factor + AWS QA.TEM.1 | All three quotes confirmed. **Context label accurate:** the staging-data quote is indeed from the data-pipelines chapter; the rule flags this itself. |
| ENV-06 | VERBATIM | Primary — AWS WA OPS06-BP02 + OPS06-BP04 | Both quotes confirmed verbatim. |
| IAC-01 | VERBATIM | Primary — HashiCorp official docs (×2) | All three quotes confirmed (declarative-approach sentence, eliminate-manual-errors bullet, commit-to-version-control sentence). |
| IAC-02 | VERBATIM | Primary — HashiCorp official docs (×2) | Local-state-team quote, remote-state quote, and avoid-VCS-state quote all confirmed verbatim. Rationale's "states all three sub-claims verbatim" is accurate. |
| IAC-03 | VERBATIM | Primary — HashiCorp tutorial + AWS WA OPS05-BP03 | "best practice… manual changes" quote, config-management sentence, and security-groups anti-pattern all confirmed. |
| IAC-04 | VERBATIM | Primary — HashiCorp (×2) + AWS WA REL08-BP04 | Drift-causes quote, CI/CD drift-detection-mechanism quote, and AWS drift-definition quote all confirmed verbatim. |
| IAC-05 | VERBATIM | Primary — HashiCorp (×2) + Twelve-Factor manifesto | Multi-environment approaches quote, named-workspaces quote, and 12-factor parity sentence confirmed (ellipses elide list formatting honestly). |
| IAC-06 | VERBATIM | Primary — HashiCorp (×2) + GitHub official `github/gitignore` repo | All three confirmed. tfvars gitignore comment + patterns verified in the repo file. Cosmetic: HashiCorp's own link points to `blob/master`, the rule cites `blob/main` — both resolve. |
| FLAG-01 | VERBATIM | martinfowler.com (canonical reference article) + vendor docs (LaunchDarkly, OpenFeature) | All three quotes confirmed. **Honesty note accurate:** kill-switch→MTTR quantification correctly labeled as inference, not claimed from sources. |
| FLAG-02 | VERBATIM | martinfowler.com — **sole source, not vendor doc** | Metadata-field-set quote confirmed verbatim. Single non-vendor source; see fix list. |
| FLAG-03 | VERBATIM | martinfowler.com + Unleash vendor docs | Inventory/carrying-cost, time-bomb, technical-debt, and potentially-stale quotes all confirmed. Unleash per-type lifetimes verified in the type table (release 40d, experiment 40d, operational 7d, sunset 90d, kill-switch/permission Permanent) — FIX defaults accurate. |
| RB-01 | VERBATIM | Official Google Cloud blog + Google SRE site | "service is on fire" passage and Big-Red-Button passage both confirmed verbatim. |
| RB-02 | VERBATIM | Google Cloud blog + AWS WA REL12-BP05 + Google SRE site | Rollback-"just because" quote, game-day anti-pattern, and recovery-mechanisms doctrine all confirmed. AWS's "your never exercise them" typo reproduced faithfully with [sic] — accurate. |
| RB-03 | VERBATIM | Official Google Cloud blog | "rollbacks are normal… easy to perform… trusted to be low-risk" confirmed verbatim (ellipsis elides intervening paragraph). |
| RB-04 | VERBATIM | DORA (×2) + SRE Book ch.4 + ch.14 | Metric definition, MTTR-rename note, error-budget passages, and incident-strategy passage all confirmed verbatim. "Renamed in 2023" is accurate per dora-metrics-history. |
| HOT-01 | VERBATIM | nvie (blog) + GitLab Docs | nvie hotfix-branches quote, 2020-reflection quote ("adopt a much simpler workflow (like GitHub flow)"), and GitLab define-and-enforce quote all confirmed. Blog source is corroborated by GitLab Docs here. |
| HOT-02 | VERBATIM | nvie (blog) + GitLab Docs | Back-merge-safeguard quote and GitLab 1.0/1.1/2.0 example quote both confirmed verbatim. |
| HOT-03 | VERBATIM | Google SRE Book ch.14 + ch.13 | "Prepare. Develop and document…" checklist sentence, opening paragraph, and emergency-response failure-mode quote all confirmed verbatim. |
| HOT-04 | VERBATIM (NIST via labeled channel) | NIST SP 800-53r5 + GitHub Docs (×2) | GitHub bypass-permission and Rule-Insights quotes confirmed verbatim. **NIST AC-3(10) label accurate:** "Employ an audited override of automated access control mechanisms under [Assignment…] by [Assignment…]" verbatim-confirmed against the csrc.nist.gov draft-markup PDF and csf.tools mirror, as the label states. |
| GOV-01 | N/A — machinery | Label present, accurate | "machinery rule — no external claim" label in place; baseline ledger precedent named. Correct. |

---

## Appendix pre-labeled items — label confirmation (confirmed, not re-flagged)

| Item | Label present | Label accurate |
|---|---|---|
| BR-02 DORA 2023 quote — "search-snippet-verified, full PDF not re-fetched" | ✔ (in rule + appendix) | ✔ Re-verified via search this review; the snippet is served from the dora.dev PDF URL itself. |
| ENV-04 NIST CM-3 — "verbatim-confirmed against csrc draft-markup PDF + csf.tools mirror; final PDF not text-extractable" | ✔ | ✔ Control text matches both claimed channels word-for-word. |
| HOT-04 NIST AC-3(10) — same label | ✔ | ✔ Control text matches both claimed channels word-for-word. |
| DESC-02 / GOV-01 — machinery, no external citation | ✔ | ✔ Both correctly carry no external quote. |
| CI-05 — mechanism lift from baseline OPS-07 (URL-only citation, honesty note) | ✔ | ✔ Cited GitHub page documents the auto-disable behavior the CHECK describes. |
| Parked appendix citations (not rule SOURCEs) | — | AWS canary whitepaper URL reachable; "Had we canaried those global changes" present on the SRE lessons page; "Smaller changes are also easier to recover from if there's a failure." verbatim on dora.dev/guides/dora-metrics. |

---

## Counts

- **Rules in catalog:** 39
- **Rules with external verbatim quotes:** 36 → **36 VERBATIM · 0 PARAPHRASE · 0 NOT FOUND · 0 UNREACHABLE**
- **Labeled non-quote SOURCE fields:** 3 (DESC-02, GOV-01 machinery · CI-05 mechanism-lift) — all labels present and accurate
- **Unique source URLs checked:** 48 → **48 reachable** (46 fetched in full; DORA 2023 PDF + NIST PDF verified via their labeled channels)
- **Source-quality flags (non-vendor canonical sources):** 6 rule citations — nvie.com (BR-06, HOT-01, HOT-02) and martinfowler.com (FLAG-01, FLAG-02, FLAG-03). Of these, only **BR-06** and **FLAG-02** rely on a non-vendor source *alone*.
- **Rationale claims not covered by the rule's own SOURCE:** 1 (BR-02's heavyweight-approval contrast — covered elsewhere in the catalog, not in BR-02's SOURCE)

## Must fix or downgrade before ship

1. **BR-06 — source quality (personal blog, sole source).** Quote is verbatim and nvie is the canonical GitFlow origin, but it is the only rule resting solely on a personal blog. Fix: add GitLab Docs *Branching strategies* as corroboration (it endorses git-flow and is already cited in HOT-01/02), or annotate nvie explicitly as the canonical-origin primary source for the practice.
2. **BR-02 — rationale/SOURCE mismatch (minor).** The rationale's "(in contrast to external heavyweight approval)" is not backed by BR-02's own SOURCE; it is backed by the DORA change-approval capability cited in DESC-03. Fix: add that capability URL to BR-02's SOURCE field, or trim the parenthetical. (The existing search-snippet honesty label is accurate — leave it.)
3. **FLAG-02 — source quality (sole source is martinfowler.com).** Acceptable as the canonical feature-toggle reference, but if the spec's "official vendor docs" bar is enforced strictly, add vendor corroboration for the metadata field set (e.g. Unleash flag fields) or annotate the Fowler article as canonical-reference class. Minor.
4. **CI-05 — scope nuance (optional).** The cited GitHub page scopes the 60-day auto-disable to *scheduled* workflows in *public* repositories; the CHECK mentions it generically. Consider noting the scope in the rationale. Very minor; no accuracy impact.

**No rule requires downgrade for fabrication, paraphrase, or link rot.** Every factual claim in every rule rationale is either backed by its SOURCE or explicitly labeled as inference/judgment within the document itself.
