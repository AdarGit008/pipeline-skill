# Research brief — angle (c): Feature flags & rollback/recovery

**Scope:** §5(c) questions 1–5 of `spec/plan-skeleton.md`, plus core claims (deploy/release decoupling, kill switch, progressive delivery/canary, rollback+MTTR, flag debt).
**Citation contract:** every claim carries a verbatim quote + URL from a primary source (martinfowler.com as canonical reference; OpenFeature docs; LaunchDarkly docs; Unleash docs; DORA/dora.dev; Google SRE/Google Cloud; AWS Well-Architected/whitepapers). No blog opinions used as primary evidence.

## Verdicts at a glance (report c-5 first per Appendix B)

| Question | Gates | Verdict | Effect on taxonomy |
|---|---|---|---|
| **c-5** Solo-tier anchor: fast recovery + observability over heavy gating | §3.2 solo tier shape | **Survives, narrowed** | Profile system keeps its anchor. DORA's finding is criticality-*agnostic* (heavyweight external gating never lowered change-fail rates); the *tiering by declared failure cost* remains the skill's own design judgment — honest framing for §3.1 prose. |
| **c-1** Flags decouple deploy from release; kill switch; MTTR | FLAG-01 + family rationale | **Survives as written** | FLAG-01 keeps `warn`/core-opt-in. The kill-switch→MTTR causal link is inferential (two primary ends, joined by us) — noted in §1.3. |
| **c-2** Flag debt: owner + expiry or the system becomes a hazard | FLAG-02/03 | **Survives as written, strongly** | Both rules keep `warn`/team. Fowler explicitly names owner-contact + expiration-date metadata; Unleash implements per-type expected lifetimes and stale-flag automation. |
| **c-3** Documented fast rollback path, known before deploy | RB-01/03 | **Survives as written** | RB-01 holds at `blocker`/core. Google: plan rollback *before* rollout; rollbacks must be "easy to perform" and "trusted to be low-risk". |
| **c-4** Recovery capability demonstrated by drills, not asserted | RB-02 | **Survives as written** | RB-02 stays sign-off/critical. Google rolls back "just because" on a cadence; AWS names un-exercised runbooks an anti-pattern. |

No question failed to source. Nothing is UNVERIFIED. Two honest caveats are flagged inline (§1.3, §5).

---

## 1. Claim c-1: feature flags decouple deployment from release; a broken feature is instantly disableable without redeploying (kill switch), reducing MTTR

### 1.1 Decoupling deployment from release — canonical

> "Release Toggles allow incomplete and un-tested codepaths to be shipped to production as latent code which may never be turned on. … Using Release Toggles in this way is the most common way to implement the Continuous Delivery principle of "separating [feature] release from [code] deployment.""

- URL: https://martinfowler.com/articles/feature-toggles.html
- Source/date: Pete Hodgson, *Feature Toggles (aka Feature Flags)*, martinfowler.com (first published 2017; the canonical reference per the plan's candidate list).
- **supports rule:** FLAG-01 (a flag mechanism exists) and the whole FLAG family rationale — decoupling is the defining purpose of release toggles.

### 1.2 Same decoupling, from the vendor-neutral spec body

> "In the most basic case, you can think of a feature flag as an if/else statement that can be controlled at runtime. Feature flags allow application behavior to be altered without the deployment of new code."

> "You can perform canary releases - rolling out a new feature to an initially small subset of users. … You can safely degrade parts of a production system that are experiencing an outage."

- URL: https://openfeature.dev/docs/reference/intro/
- Source/date: OpenFeature documentation (CNCF incubating project), *Introduction* (continuously updated; accessed 2026).
- **supports rule:** FLAG-01. Second quote also supports the kill-switch use case ("safely degrade … during an outage") and canary basics (§6).

### 1.3 Kill switch — instant disable without redeploy

> "The flag toggle button is a circuit breaker for any feature. The flag button lets you turn off a feature that's misbehaving without needing to touch any code or re-deploy your application."

- URL: https://docs.launchdarkly.com/home/flags/toggle/
- Source/date: LaunchDarkly Docs, *Turning flags on and off* (continuously updated; accessed 2026).
- **supports rule:** FLAG-01 rationale — this is the kill-switch claim verbatim from official vendor docs.

> "However it's not uncommon for systems to have a small number of long-lived "Kill Switches" which allow operators of production environments to gracefully degrade non-vital system functionality when the system is enduring unusually high load. … Since the purpose of these flags is to allow operators to quickly react to production issues they need to be re-configured extremely quickly - needing to roll out a new release in order to flip an Ops Toggle is unlikely to make an Operations person happy."

- URL: https://martinfowler.com/articles/feature-toggles.html
- Source/date: Hodgson, martinfowler.com (2017).
- **supports rule:** FLAG-01 rationale; also informs the flag-registry taxonomy (kill switches are a *permanent* toggle category — matches Unleash's type table in §2.3, so FLAG-03's expiry rule must exempt permanent ops/kill-switch flags or expect them to carry long review horizons).

**Honest caveat (inferential link):** no primary source found that *quantifies* "kill switch → lower MTTR". The claim joins two primary-sourced ends: (a) flags disable a misbehaving feature without redeploy (LaunchDarkly, above); (b) recovery time after a failed deployment is a first-class DORA metric (§7). The conjunction is our engineering inference, not a quoted finding. Recommend the FLAG family rationale phrase it as "shortens the recovery path", not as a measured MTTR effect.

---

## 2. Claim c-2: flags are debt — every flag needs an owner and an expiry/cleanup date, or the flag system itself becomes an operational hazard

### 2.1 Carrying cost, expiry dates, time bombs — canonical

> "Savvy teams view the Feature Toggles in their codebase as inventory which comes with a carrying cost and seek to keep that inventory as low as possible. In order to keep the number of feature flags manageable a team must be proactive in removing feature flags that are no longer needed. Some teams have a rule of always adding a toggle removal task onto the team's backlog whenever a Release Toggle is first introduced. Other teams put "expiration dates" on their toggles. Some go as far as creating "time bombs" which will fail a test (or even refuse to start an application!) if a feature flag is still around after its expiration date."

- URL: https://martinfowler.com/articles/feature-toggles.html
- Source/date: Hodgson, martinfowler.com (2017).
- **supports rule:** FLAG-03 (flags carry `review_by`; none past-due) — expiry dates and automated past-due enforcement ("time bombs" failing a test) are literally the cited practice; our check is the mechanical version of it.

### 2.2 Owner metadata — canonical

> "Some teams also opt to include additional metadata in their toggle configuration files such as a creation date, a primary developer contact, or even an expiration date for toggles which are intended to be short lived."

- URL: https://martinfowler.com/articles/feature-toggles.html
- Source/date: Hodgson, martinfowler.com (2017).
- **supports rule:** FLAG-02 (registry: one flag, one record, owner field non-empty) — "primary developer contact" + "creation date" + "expiration date" is exactly the registry record's field set.

### 2.3 Debt as operational hazard + expected lifetimes — vendor-official

> "Feature flag technical debt accumulates when you don't manage or retire feature flags after their intended use. Over time, the codebase becomes cluttered with outdated flags, making the code more complex and harder to maintain. … Additionally, the presence of stale or conflicting feature flags can lead to unexpected application behavior, increasing the risk of downtime and affecting overall stability."

> "Unleash marks all flags as potentially stale automatically once they pass their expected lifetime. This gives you an indication of when to review and clean up a feature flag in code."

- URLs: https://docs.getunleash.io/concepts/technical-debt and https://docs.getunleash.io/concepts/feature-flags
- Source/date: Unleash Documentation, *Technical debt* and *Feature flags* (v7.x docs; accessed 2026).
- **supports rule:** FLAG-03. "Increasing the risk of downtime and affecting overall stability" is the operational-hazard half of the claim, verbatim. Unleash's per-type expected lifetimes — **Release 40 days, Experiment 40 days, Operational 7 days, Kill switch Permanent, Permission Permanent, Sunset 90 days** — are a shipped, vendor-official precedent for per-flag expiry horizons; strong design input for FLAG-03's default `review_by` windows.

### 2.4 The hazard made concrete (and when flags are NOT worth it)

> "Knight Capital Group's $460 million dollar mistake serves as a cautionary tale on what can go wrong when you don't manage your feature flags correctly (amongst other things)."

> "With multiple toggles in play we have a combinatoric explosion of possible toggle states."

- URL: https://martinfowler.com/articles/feature-toggles.html
- Source/date: Hodgson, martinfowler.com (2017). (Knight incident widely documented; the linked postmortem is secondary, but Fowler's framing of it as a flag-management failure is the cited claim.)
- **supports rule:** FLAG-02/03 rationale; also justifies the family's **opt-in activation** (`uses_feature_flags`) and the solo tier being allowed to skip flags entirely — flags carry validation complexity and debt, so the spec should not push them where the failure cost doesn't justify the mechanism.

---

## 3. Claim c-3: every deployment has a documented, fast rollback path, known before the deploy happens

### 3.1 Known before the deploy — Google SRE practice

> "Before you plan to roll out a new binary or image to your service, you should ask yourself, "What will I do if I discover a catastrophic / debilitating / annoying bug in this release?" Not because it might happen, but because sooner or later it is going to happen and it is better to have a well-thought out plan in place instead of trying to make one up when your service is on fire."

- URL: https://cloud.google.com/blog/products/gcp/reliable-releases-and-rollbacks-cre-life-lessons
- Source/date: Google Cloud Blog, *SRE at Google: Reliable releases and rollbacks — CRE life lessons* (c. 2018).
- **supports rule:** RB-01 (blocker, core) — the rollback plan must exist *before* rollout; this is the strongest sentence in the corpus for a documented rollback path.

### 3.2 Fast and low-risk — the mechanical requirement

> "At Google, our philosophy is that "rollbacks are normal." When an error is found or reasonably suspected in a new release, the releasing team rolls back first and investigates the problem second. … Thus, for rollbacks to work, the implicit assumption is that they are: 1. easy to perform; and 2. trusted to be low-risk."

- URL: https://cloud.google.com/blog/products/gcp/reliable-releases-and-rollbacks-cre-life-lessons
- Source/date: Google Cloud Blog, CRE life lessons (c. 2018).
- **supports rule:** RB-03 (a mechanical fast-rollback path exists — version/ref input or revert-and-redeploy) — "easy to perform" is the mechanical property the check looks for at rest; "trusted to be low-risk" is the drill residue (§4).

### 3.3 The revert trigger identified in advance — Google SRE lessons

> "A "Big Red Button" is a unique but highly practical safety feature: it should kick off a simple, easy-to-trigger action that reverts whatever triggered the undesirable state to (ideally) shut down whatever's happening. … and it's important to identify what those big red buttons might be before you submit a potentially risky action."

- URL: https://sre.google/resources/practices-and-processes/twenty-years-of-sre-lessons-learned/
- Source/date: Google SRE, *Lessons learned from twenty years of Site Reliability Engineering* (2023).
- **supports rule:** RB-01 + RB-03 — revert action simple, identified *before* the risky change. Adjacent to the hotfix family (HOT-01) but the quote itself is about pre-planned reversion.

---

## 4. Claim c-4: recovery capability must be demonstrated by practice (drills), not asserted

### 4.1 Rollback drills, specifically — Google SRE practice

> "If you haven't rolled back in a few weeks, you should do a rollback "just because"; aim to find any traps with incompatible versions, broken automation/testing etc. If the rollback works, just roll forward again once you've checked out all your logs and monitoring."

- URL: https://cloud.google.com/blog/products/gcp/reliable-releases-and-rollbacks-cre-life-lessons
- Source/date: Google Cloud Blog, CRE life lessons (c. 2018).
- **supports rule:** RB-02 (rollback verified by drill within N days — sign-off with `review_by` + tripwire) — this is a rollback-drill cadence stated verbatim by Google's SRE org; the direct precedent for "last drilled < N days" as a ledger tripwire.

### 4.2 Game days; un-exercised procedures named as the anti-pattern — AWS

> "Conduct game days to regularly exercise your procedures for responding to workload-impacting events and impairments. … When you practice your response procedures in realistic conditions, you can identify and address any gaps or weaknesses before a real event occurs."

> "Common anti-patterns: … You document your procedures, but your never exercise them." [sic — typo is AWS's own]

- URL: https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_game_days_resiliency.html
- Source/date: AWS Well-Architected Framework, Reliability Pillar, REL12-BP05 (current framework version).
- **supports rule:** RB-02 — the second quote is precisely the failure mode the rule exists to catch: a documented-but-never-drilled rollback path. RB-01's runbook is *necessary but insufficient*; RB-02's drill ledger entry is the differentiator.

### 4.3 Recovery mechanisms tested before the emergency — Google SRE lessons

> "Recovery mechanisms should be fully tested before an emergency. … an outage is a terrible opportunity to try a risky load-shedding process for the first time. To keep your cool during a high-risk and high-stress situation, it's important to practice recovery mechanisms and mitigations beforehand and verify that: they'll do what you need them to do - you know how to do them."

- URL: https://sre.google/resources/practices-and-processes/twenty-years-of-sre-lessons-learned/
- Source/date: Google SRE, *Lessons learned from twenty years of SRE* (2023).
- **supports rule:** RB-02 — "untested rollback is assumed broken" restated as official Google SRE doctrine. Three independent primary sources (§4.1–4.3) converge: drills are doctrine, not preference. The sign-off-only design of RB-02 is correct — the checker can't observe a drill at rest, so a dated judgment entry is the honest mechanism.

---

## 5. Claim c-5 (LOAD-BEARING): for low-criticality systems, observability plus fast rollback can substitute for heavy multi-tier release gating

### 5.1 Heavyweight external gating does not improve stability — DORA

> "Traditionally, these goals have been met through a heavyweight process involving approval by people external to the team proposing the change: a change advisory board (CAB) or a senior manager. However, DORA's research shows that these approaches have a negative impact on software delivery performance. Further, no evidence was found to support the hypothesis that a more formal, external review process was associated with lower change fail rates."

> "Employ continuous testing, continuous integration, and comprehensive monitoring and observability to rapidly detect, prevent, and correct bad changes."

> "Your goal should be to make your regular change management process fast and reliable enough that you can use it to make emergency changes too."

- URL: https://dora.dev/capabilities/streamlining-change-approval/
- Source/date: DORA, *Capabilities: Streamlining change approval* (last updated October 30, 2025; finding from the 2019 State of DevOps Report).
- **supports rule:** §3.2 solo tier — the theoretical anchor holds. DORA's evidence: external heavyweight gating *slows delivery and does not lower change-fail rates*; the substitute that works is peer review + automation + monitoring/observability + fast correction. That is exactly the solo posture (ship from main, automated pipeline, documented fast rollback, get good at recovering).

### 5.2 Speed and stability are not trade-offs — DORA metrics

> "DORA's research has repeatedly demonstrated that speed and stability are not tradeoffs. In fact, we see that the metrics are correlated for most teams. Top performers do well across all five metrics, and low performers do poorly."

- URL: https://dora.dev/guides/dora-metrics/
- Source/date: DORA, *DORA's software delivery performance metrics* (last updated January 5, 2026).

> "By 2015, the model solidified into the duality of throughput and stability. The research debunked the myth that speed comes at the expense of stability, finding that high performers excelled at both."

- URL: https://dora.dev/insights/dora-metrics-history/
- Source/date: DORA, *A history of DORA's software delivery metrics* (last updated January 2, 2026).
- **supports rule:** §3.2 — a lightweight pipeline posture is not a stability compromise; high performance without heavyweight process is the measured norm, not an exception.

**Honest narrowing (report to orchestrator):** the claim as drafted has one clause no source carries — "*for low-criticality systems*". DORA's finding is criticality-agnostic (external gating didn't lower change-fail rates *anywhere* in the data), which is stronger than needed for the solo tier but does not by itself justify the *inverse* — that critical systems warrant more gating. The critical/team/solo tiering by declared failure cost therefore stands as the skill's own design judgment (the descriptor declaration + sign-off surface), resting on — not derived from — DORA. The profile system does **not** lose its anchor; but §3.1 prose should present the tiering as a judgment the ledger polices (DESC-03 inverse-nag), not as a DORA finding. The error-budget framing (SRE Book) would be the natural second leg if the spec wants a criticality-sensitive citation — recommend the spec author treat that as optional follow-up, not a blocker.

---

## 6. Core claim: progressive delivery / canary basics

> "Canary deployments are a type of blue/green deployment strategy that is more risk-averse. This strategy involves a phased approach in which traffic is shifted to a new version of the application in two increments. The first increment is a small percentage of the traffic, which is referred to as the canary group. This group is used to test the new version, and if it is successful, the traffic is shifted to the new version in the second increment."

- URL: https://docs.aws.amazon.com/whitepapers/latest/overview-deployment-options/canary-deployments.html
- Source/date: AWS whitepaper, *Overview of Deployment Options on AWS* (current version).

> "Had we canaried those global changes with a progressive rollout strategy, this outage could have been curbed before it had global impact."

- URL: https://sre.google/resources/practices-and-processes/twenty-years-of-sre-lessons-learned/
- Source/date: Google SRE, *Lessons learned from twenty years of SRE* (2023) — from a real YouTube global-outage postmortem.

> "The team decide to use their Feature Flag infrastructure to perform a Canary Release, only turning the new feature on for a small percentage of their total userbase - a "canary" cohort."

- URL: https://martinfowler.com/articles/feature-toggles.html
- Source/date: Hodgson, martinfowler.com (2017).
- **supports rule:** context for the FLAG family rationale and RB-03's revert path (canary limits blast radius *before* rollback is needed). No rule in the current taxonomy mandates canarying — correctly: it is a technique citation, not a rule candidate. If a future `critical`-tier canary rule is proposed, these three quotes are its gate citations.

---

## 7. Core claim: fast rollback + MTTR as the key recovery metric

> "Failed deployment recovery time: The time it takes to recover from a deployment that fails and requires immediate intervention."

> "Change fail rate: The ratio of deployments that require immediate intervention following a deployment. Likely resulting in a rollback of the changes or a "hotfix" to quickly remediate any issues."

- URL: https://dora.dev/guides/dora-metrics/
- Source/date: DORA, *DORA's software delivery performance metrics* (last updated January 5, 2026).

> "They began with four variables: deployment frequency, lead time for changes, mean time to recover (MTTR), and change fail rate. … The metric historically known as "mean time to recover (MTTR)" or "time to restore service" was renamed and redefined as failed deployment recovery time."

- URL: https://dora.dev/insights/dora-metrics-history/
- Source/date: DORA, *A history of DORA's software delivery metrics* (last updated January 2, 2026).
- **supports rule:** RB-04 (declared recovery objective) and the solo tier's "get good at deploying a fix within 30 minutes" posture — time-to-recover has been a core DORA stability metric since 2014 and is now scoped precisely to failed deployments; rollback is DORA's canonical remediation path (first quote pair). Note for the spec author: DORA renamed MTTR → *failed deployment recovery time* in 2023; RB-04's descriptor field should use that vocabulary (or accept both) to stay current.

---

## Sources

**Kept (all primary):**
- Pete Hodgson, *Feature Toggles (aka Feature Flags)* — https://martinfowler.com/articles/feature-toggles.html — canonical reference (explicitly permitted by the plan); single richest source: decoupling, kill switches, carrying cost, owner/expiry metadata, time bombs, canary-via-flags.
- OpenFeature Docs, *Introduction* — https://openfeature.dev/docs/reference/intro/ — vendor-neutral CNCF spec body's one-line definition of the decoupling claim.
- LaunchDarkly Docs, *Turning flags on and off* — https://docs.launchdarkly.com/home/flags/toggle/ — official kill-switch wording ("circuit breaker", "without … re-deploy").
- Unleash Docs, *Technical debt* — https://docs.getunleash.io/concepts/technical-debt — flag debt → downtime/stability risk, verbatim; stale-flag automation.
- Unleash Docs, *Feature flags* — https://docs.getunleash.io/concepts/feature-flags — per-type expected lifetimes (Release 40d / Operational 7d / Kill switch Permanent): design input for FLAG-03 windows and kill-switch expiry exemption.
- Google Cloud Blog, *Reliable releases and rollbacks — CRE life lessons* — https://cloud.google.com/blog/products/gcp/reliable-releases-and-rollbacks-cre-life-lessons — rollback plan before rollout; "rollbacks are normal"; rollback drills "just because". Official Google SRE practice writing.
- Google SRE, *Lessons learned from twenty years of SRE* — https://sre.google/resources/practices-and-processes/twenty-years-of-sre-lessons-learned/ — recovery mechanisms tested before emergencies; Big Red Button; canary lesson; MTTR via automated mitigation.
- AWS Well-Architected Reliability Pillar, REL12-BP05 — https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_testing_resiliency_game_days_resiliency.html — game days; documented-but-unexercised procedures named as anti-pattern.
- AWS whitepaper, *Overview of Deployment Options on AWS — Canary deployments* — https://docs.aws.amazon.com/whitepapers/latest/overview-deployment-options/canary-deployments.html — canary definition from official AWS guidance.
- DORA, *Capabilities: Streamlining change approval* — https://dora.dev/capabilities/streamlining-change-approval/ — the c-5 anchor: no evidence external review lowers change-fail rates.
- DORA, *Software delivery performance metrics* — https://dora.dev/guides/dora-metrics/ — failed deployment recovery time; speed/stability not trade-offs.
- DORA, *A history of DORA's software delivery metrics* — https://dora.dev/insights/dora-metrics-history/ — MTTR since 2014; 2023 rename (vocabulary guidance for RB-04).

**Dropped:**
- LaunchDarkly blog posts (decouple-deployments, kill-switch tutorial) — vendor *blog*, not docs; docs carried the same claims better.
- Thoughtworks blog ("Managing feature toggles in teams"), InfoQ news, arc42 quality model, productive.io — commentary/secondary; Fowler article supersedes.
- trunkbaseddevelopment.com, citk.com, teamtopologies.com, excellalabs/dojoconsortium mirrors of DORA findings — secondary echoes; dora.dev originals cited instead.
- getunleash.io *blog* (garbled scrape) — replaced by docs.getunleash.io concept pages.
- AWS ECS canary page — not fetched after the AWS whitepaper gave a clean verbatim definition (retrieval budget).

## Gaps

1. **Kill-switch → MTTR quantification:** no primary source measures the effect; the claim is an inference joining LaunchDarkly's instant-disable wording to DORA's recovery-time metric. Spec prose should say "shortens the recovery path", not cite a number.
2. **c-5's criticality qualifier:** sourced only in the direction "heavy gating doesn't help"; the failure-cost *tiering* is the skill's design judgment (§5 honest narrowing). Optional follow-up: SRE Book error-budget chapter as a criticality-sensitive second citation — not blocking.
3. **Flag registry as repo files:** sources support owner/expiry *metadata existing* (Fowler: toggle-config metadata; Unleash: platform lifetimes); the file-based registry is our mechanism design — no external citation needed or found, and none claimed.
4. **Knight Capital $460M** is cited via Fowler's article; the underlying postmortem link is secondary. Used only as color for the hazard claim, which stands on §2.3's Unleash wording alone.
