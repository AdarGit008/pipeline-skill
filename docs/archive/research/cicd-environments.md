# Research Brief — Angle (a): CI/CD & environment tiers

**Purpose:** primary-source evidence for the claims in plan-skeleton.md §5(a) + the core-claims list (trunk-based vs long-lived branches, daily/continuous integration, dev/staging/prod tiering, post-deploy smoke tests, staging realism, DORA four keys). Gates the `CI` and `ENV` rule families (plus `BR-03/04/05` and the `critical`-tier promotion gate).

**Citation contract compliance:** every claim below carries at least one verbatim quote + URL from a primary source (DORA/Google Cloud, GitHub Docs, GitLab Docs, Google SRE Book/Workbook, AWS Well-Architected/DevOps Guidance, 12factor.net, NIST SP 800-53r5). No blog opinions used as primary evidence. Sources were fetched and read in full; quotes were copied from the fetched text. Nothing below required an UNVERIFIED flag, but two claims are marked **NARROWED** where evidence supports less than the claim as written.

**Verdict summary (per Appendix B of the skeleton):**

| §5(a) question | Verdict | Rule impact |
|---|---|---|
| 1. Build/test every change; failing pipeline blocks merge | **Survives as written** | CI-02, BR-03 keep `blocker` |
| 2. Prod deploys by pipeline, not by hand | **Survives as written** | CI-03 keeps `blocker` at core |
| 3. Dev environment w/ frequent (daily) automated deploys | **Narrowed** | ENV-03 stays `warn` at team (as skeleton anticipated) |
| 4. Gated prod promotion for high-criticality | **Survives as written** | ENV-04 keeps `blocker` at critical |
| 5. Post-deploy smoke test | **Survives as written** | CI-04 keeps `warn` at critical |
| 6. Staging mirrors prod incl. realistic data | **Survives, judgment-only for data realism** | ENV-05 stays sign-off; ENV-06 keeps presence check |

Load-bearing citations (per Appendix B.3): §5(a)-1 is anchored by DORA's CI capability + GitHub/GitLab merge-gating docs; §5(a)-2 is anchored by DORA's deployment-automation capability + SRE Book ch.8. Both are reported first below.

---

## Claim 1 (§5a-1): "Every change must be built and tested by an automated pipeline on every PR/push, and a failing pipeline must block merge." — **SURVIVES**

**supports rule:** CI-02 (blocker, core) and BR-03 (blocker at critical / warn at team). Also substantiates the BR-03 "strict/up-to-date" qualifier.

**QUOTE:** "The key elements in successfully implementing continuous integration are: * Each commit should trigger a build of the software. * Each commit should trigger a series of automated tests that provide feedback in a few minutes."
— and: "A CI system that runs the build and automated tests on every check-in."
- **URL:** https://dora.dev/capabilities/continuous-integration/
- **Source:** DORA (Google Cloud), *Capabilities: Continuous integration* (living document, accessed this research run)

**QUOTE:** "The 2015 State of DevOps Report (PDF) shows that teams perform better when developers merge their work into trunk at least daily. A set of automated tests is run both before and after the merge in order to validate that the changes don't introduce regression bugs. If these automated tests fail, the team stops what they are doing to fix the problem immediately."
- **URL:** https://dora.dev/capabilities/continuous-integration/
- **Source:** DORA, *Capabilities: Continuous integration* (citing 2015 State of DevOps Report)

**QUOTE:** "We revalidated that CI improves CD. For CI to be impactful, each code commit should result in a successful build of the software and a set of test suites being run. Automated builds and tests for a project should be run successfully every day."
- **URL:** https://dora.dev/research/2019/dora-report/2019-dora-accelerate-state-of-devops-report.pdf
- **Source:** DORA, *2019 Accelerate State of DevOps Report* (2019)

**QUOTE:** "After enabling required status checks, all required status checks must pass before collaborators can merge changes into the protected branch."
— and, on strict mode: "**Strict** ... The branch **must** be up to date with the base branch before merging. This is the default behavior for required status checks."
- **URL:** https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- **Source:** GitHub Docs, *About protected branches* (current)

**QUOTE:** "You can configure your project to require a complete and successful pipeline before merge."
— and, on merge checks: "A CI/CD pipeline must complete successfully, regardless of the project setting."
- **URL:** https://docs.gitlab.com/user/project/merge_requests/auto_merge/
- **Source:** GitLab Docs, *Auto-merge* (current)

**QUOTE:** "Implement comprehensive automated testing. Make sure that you have a comprehensive and meaningful suite of automated unit tests and that these are run before every commit. For example, if you're using GitHub, you can protect branches to only allow pull request merges when all tests have passed."
- **URL:** https://dora.dev/capabilities/trunk-based-development/
- **Source:** DORA, *Capabilities: Trunk-based development* — DORA itself endorses required-checks-as-merge-gate as the implementation pattern.

**Note for spec:** both the *practice evidence* (DORA: predictive of higher delivery performance) and the *enforcement mechanism* (GitHub required status checks incl. strict mode; GitLab "Pipelines must succeed") are primary-sourced. The blocker severity holds at core for CI-02; BR-03's forge check verifies exactly the mechanism GitHub/GitLab document.

---

## Claim 2 (§5a-2): "Deployment to production must be performed by the pipeline (automation), not by hand." — **SURVIVES**

**supports rule:** CI-03 (blocker, core). This citation must hold at the *solo* tier — DORA frames deployment automation as risk reduction with no team-size precondition, and SRE frames automation as the default, with humans only on exception. Both hold for a solo repo.

**QUOTE:** "Deployment automation is what enables you to deploy your software to testing and production environments with the push of a button. Automation is essential to reduce the risk of production deployments."
- **URL:** https://dora.dev/capabilities/deployment-automation/
- **Source:** DORA, *Capabilities: Deployment automation* (living document)

**QUOTE:** "Allow anyone with the necessary credentials to deploy any version of the artifact to any environment on demand in a fully automated fashion. If you have to create a ticket and wait for someone to prepare an environment, you don't have a fully automated deployment process."
— and: "Use the same deployment process for every environment, including production."
— and: "Any deployment process that requires logging into a console and interacting manually by clicking around should be a target for improvement."
- **URL:** https://dora.dev/capabilities/deployment-automation/
- **Source:** DORA, *Capabilities: Deployment automation*

**QUOTE:** "Release processes can be automated to the point that they require minimal involvement by the engineers, and many projects are automatically built and released using a combination of our automated build system and our deployment tools. Releases are truly automatic, and only require engineer involvement if and when problems arise."
— and: "Other teams have adopted a 'Push on Green' release model and deploy every build that passes all tests."
- **URL:** https://sre.google/sre-book/release-engineering/
- **Source:** Google, *Site Reliability Engineering*, ch.8 "Release Engineering" (2016)

**Note for spec:** "manual deploy by design" (CI-03's `deviation` sign-off path) is directly addressed by DORA's pitfall framing — console-clicking is "a target for improvement," not a legitimate end state — so the rule's rationale can state that a manual-deploy deviation is flagged precisely because primary sources treat it as a defect.

---

## Claim 3 (§5a-3): "A dedicated dev environment receiving frequent (daily) automated deploys catches integration failures before staging/prod." — **NARROWED**

**supports rule:** ENV-03 (warn, team) — keep at team-tier warn, exactly as the skeleton's risk note anticipated. Do not upgrade.

What the primary sources support: (a) **daily cadence for automated builds/tests** (DORA, explicitly), and (b) **progressive automated validation across pre-production environments with each environment acting as a gate** (AWS, explicitly). What no primary source states verbatim: "the dev environment specifically must receive a deploy every day." The claim survives narrowed to: *pre-production tiers receive frequent automated deploys from the integration branch, and each passed tier gates the next.*

**QUOTE:** "You should run your build process successfully at least once a day." — and: "Your tests should run successfully at least once a day."
- **URL:** https://dora.dev/capabilities/continuous-integration/
- **Source:** DORA, *Capabilities: Continuous integration* (measurement table also lists: "Automated builds and tests are executed successfully every day")

**QUOTE:** "Progressively validate software changes across multiple environments, including development (alpha) and testing (beta) before deploying into production. ... Each non-production deployment serves as a gate, only allowing changes to progress to the next stage after they pass all validations. Early issue detection and isolation prevent propagation to later stages or production."
- **URL:** https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.1-test-deployments-in-pre-production-environments.html
- **Source:** AWS, *DevOps Guidance [DL.ADS.1] Test deployments in pre-production environments* (current)

**QUOTE:** "Use testing environments to detect and correct issues earlier on in the development lifecycle. Deploy integrated changes into these environments before they are deployed to production."
- **URL:** https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.1-establish-dedicated-testing-environments.html
- **Source:** AWS, *DevOps Guidance [QA.TEM.1] Establish dedicated testing environments* (current)

**Note for spec:** the mechanical check (dev-tier workflow triggers on push to integration branch) is justified by the AWS gate model; the "daily" number has primary support only for CI builds/tests, so the rule prose should say "frequent / on-merge" rather than mandate a literal daily deploy.

---

## Claim 4 (§5a-4): "Promotion into production for high-criticality systems must be gated by explicit approval." — **SURVIVES**

**supports rule:** ENV-04 (blocker at critical, warn at team). Both forges ship exactly the mechanism the rule checks (`env-protection` via `gh api …/environments`); NIST supplies the compliance-grade "why."

**QUOTE:** "Deployment protection rules require specific conditions to pass before a job referencing the environment can proceed. You can use deployment protection rules to require a manual approval, delay a job, or restrict the environment to certain branches."
— and: "Use required reviewers to require a specific person or team to approve workflow jobs that reference the environment. ... Only one of the required reviewers needs to approve the job for it to proceed."
- **URL:** https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- **Source:** GitHub Docs, *Deployments and environments* (current)

**QUOTE:** "Protected environments can also be used to require manual approvals before deployments."
- **URL:** https://docs.gitlab.com/ci/environments/protected_environments/
- **Source:** GitLab Docs, *Protected environments* (current). GitLab's *Deployment approvals* page adds: "You can require additional approvals for deployments to protected environments. Deployments are blocked until all required approvals are given." (https://docs.gitlab.com/ci/environments/deployment_approvals/)

**QUOTE:** "Review proposed configuration-controlled changes to the system and approve or disapprove such changes with explicit consideration for security and privacy impact analyses; ... Implement approved configuration-controlled changes to the system; Retain records of configuration-controlled changes to the system"
- **URL:** https://nvlpubs.nist.gov/nistpubs/specialpublications/NIST.SP.800-53r5.pdf
- **Source:** NIST, *SP 800-53 Rev. 5*, control CM-3 "Configuration Change Control" (Sept 2020, incl. updates). Official control text (b, d, e).

**QUOTE (critical-tier practice precedent, Google SRE Workbook):** "We decided to take a more conservative approach to deployments and deploy each change in stages. We require a manual approval before a deployment can move from one stage to another."
- **URL:** https://sre.google/workbook/data-processing/
- **Source:** Google, *SRE Workbook*, ch.13 "Data Processing Pipelines" — Spotify case study of a business-critical system (2018)

**Note for spec:** the Spotify quote is the model ENV-04 encodes: higher criticality → approval gate between stages. It comes from the SRE Workbook (Google-published primary), though it describes one company's practice — fine as supporting, not sole, evidence. The GitHub/GitLab mechanism docs + NIST CM-3 carry the blocker severity.

---

## Claim 5 (§5a-5): "An automated smoke test must run immediately after each deployment to confirm core functionality survived the release." — **SURVIVES**

**supports rule:** CI-04 (warn, critical). DORA's deployment-automation capability defines the deploy pipeline as *including* a post-deploy test, which is the strongest anchor.

**QUOTE:** "An automated deployment process has the following inputs: ... Scripts to configure the environment, deploy the packages, and perform a deployment test (sometimes known as a *smoke test*)."
— and, step 5 of the deploy script: "Perform a deployment test to make sure that any necessary external services are reachable, and that the system is functioning."
- **URL:** https://dora.dev/capabilities/deployment-automation/
- **Source:** DORA, *Capabilities: Deployment automation*

**QUOTE:** "*Smoke tests*, in which engineers test very simple but critical behavior, are among the simplest type of system tests. Smoke tests are also known as *sanity testing*, and serve to short-circuit additional and more expensive testing."
— and: "It takes little effort to create a series of smoke tests to run for every release."
- **URL:** https://sre.google/sre-book/testing-reliability/
- **Source:** Google, *Site Reliability Engineering*, ch.17 "Testing for Reliability" (2016)

**QUOTE:** "Automate testing when deploying to production to simulate human and system interactions that verify the changes being deployed."
- **URL:** https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_mit_deploy_risks_auto_testing_and_rollback.html
- **Source:** AWS, *Well-Architected Framework, OPS06-BP04 Automate testing and rollback* (current)

**Note for spec:** CI-04 is presence-of-mechanism (`grep smoke/health-check step after deploy`); DORA's quote justifies the mechanism as a *constituent part of deployment automation itself*, so the rule can be phrased as "the deploy path is incomplete without its deployment test" rather than as an optional extra.

---

## Claim 6 (§5a-6): "Staging must mirror production closely, including realistic data volume, to make pre-prod validation meaningful." — **SURVIVES; ENV-05 stays judgment-only**

**supports rule:** ENV-05 (sign-off, critical) and ENV-06 (warn presence check, critical). As the skeleton predicted, data realism is sourced but inherently uncheckable at rest → sign-off is the right residue.

**QUOTE:** "Keep development, staging, and production as similar as possible ... The twelve-factor app is designed for continuous deployment by keeping the gap between development and production small."
— and: "Differences between backing services mean that tiny incompatibilities crop up, causing code that worked and passed tests in development or staging to fail in production."
- **URL:** https://12factor.net/dev-prod-parity
- **Source:** The Twelve-Factor App, factor X "Dev/prod parity" (methodology document; primary for the 12-factor methodology)

**QUOTE:** "Before deploying to production, it's useful to run your system in a preproduction (or staging) environment. The data in your staging environment should be as close to actual production data as possible. We recommend keeping a full copy of production data or at least a representative subset. Unit tests won't catch all pipeline issues, so it's important to let the data flow through the system end-to-end to catch integration issues."
- **URL:** https://sre.google/workbook/data-processing/
- **Source:** Google, *SRE Workbook*, ch.13 "Data Processing Pipelines" (2018). **Caveat:** written for data pipelines; the principle generalizes but the spec prose should not overclaim beyond it.

**QUOTE:** "These environments are as production-like as possible, providing the ability to simulate real-world conditions which can validate that changes are ready for production deployment."
- **URL:** https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.1-establish-dedicated-testing-environments.html
- **Source:** AWS, *DevOps Guidance [QA.TEM.1] Establish dedicated testing environments* (current)

**QUOTE:** "Test release procedures in pre-production by using the same deployment configuration, security controls, steps, and procedures as in production."
- **URL:** https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_mit_deploy_risks_test_val_chg.html
- **Source:** AWS, *Well-Architected Framework, OPS06-BP02 Test deployments* (current)

**Note for spec:** parity of *process/tooling* is mechanically checkable (same deploy path per tier — ties into CI-03's "same deployment process for every environment"); parity of *data volume* is not → ENV-05 correctly remains a dated sign-off, and the sign-off prompt can quote the SRE Workbook line verbatim.

---

## Core claim A: Trunk-based development vs long-lived branch models — **SOURCED (favors trunk-based)**

**supports rule:** BR-04 (declared model matches observed branches), BR-05 (stale long-lived branches), and the solo-tier "ship from main" posture.

**QUOTE:** "Analysis of DORA data from 2016 (PDF) and 2017 (PDF) shows that teams achieve higher levels of software delivery and operational performance (delivery speed, stability, and availability) if they follow these practices: * Have three or fewer active branches in the application's code repository. * Merge branches to trunk at least once a day. * Don't have code freezes and don't have integration phases."
- **URL:** https://dora.dev/capabilities/trunk-based-development/
- **Source:** DORA, *Capabilities: Trunk-based development* (citing 2016/2017 State of DevOps reports)

**QUOTE:** "branches in trunk-based development typically last no more than a few hours, with many developers merging their individual changes into trunk frequently." — vs. long-lived branches: "These changes require bigger and more complex merge events when compared to trunk-based development. This approach also requires additional stabilizing efforts and 'code lock' or 'code freeze' periods to make sure the software stays in a working state, because large merges frequently introduce bugs or regressions."
- **URL:** https://dora.dev/capabilities/trunk-based-development/
- **Source:** DORA, *Capabilities: Trunk-based development*

**Note for spec:** DORA's evidence is associational at the team level; the taxonomy already handles this honestly by making BR-04/BR-05 `warn` (team tier), not blockers. GitFlow-style long-lived models are not condemned by any primary source found — the rule flags *stale* branches, not the model itself. Correct as spec'd.

## Core claim B: Daily/continuous integration evidence — **SOURCED**

Covered by Claim 1 quotes (DORA CI capability + 2015/2019 reports). Additional measurement-table anchor:

**QUOTE:** "Automated builds and tests are executed successfully every day — The percentage of automated builds and the percentage of automated tests that are executed successfully every day."
- **URL:** https://dora.dev/capabilities/continuous-integration/
- **Source:** DORA, *Capabilities: Continuous integration* ("Ways to measure CI")

## Core claim C: Dev/staging/prod environment tiering — **SOURCED**

**supports rule:** ENV-01/ENV-02 (declared tiers, automated deploy path per tier).

**QUOTE:** "Use multiple environments to experiment, develop, and test your workload. Use increasing levels of controls as environments approach production to gain confidence your workload operates as intended when deployed."
- **URL:** https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_dev_integ_multi_env.html
- **Source:** AWS, *Well-Architected Framework, OPS05-BP08 Use multiple environments* (current)

**QUOTE:** "Environments are used to describe a general deployment target like `production`, `staging`, or `development`."
- **URL:** https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments
- **Source:** GitHub Docs, *Deployment environments* (current) — confirms dev/staging/prod as the industry-canonical tier names the descriptor should enumerate.

**Note for spec:** GitLab's group-level protected-environments doc independently uses the same tier model with escalating controls (Development/Testing = "Lower environment," Staging/Production = "Higher environment," developers disallowed on higher tiers): https://docs.gitlab.com/ci/environments/protected_environments/. Useful cross-forge confirmation for ENV-01's tier vocabulary.

## Core claim D: Post-deploy smoke tests — **SOURCED**

Covered by Claim 5 (CI-04).

## Core claim E: Staging realism — **SOURCED**

Covered by Claim 6 (ENV-05/06).

## Core claim F: DORA four key metrics and what predicts delivery performance — **SOURCED**

**supports rule:** RB-04 (declared recovery objective), HOT/GOV framing, and the profile system's outcome orientation. Note: DORA's current model is **five** metrics (rework rate added; MTTR renamed "failed deployment recovery time") — spec prose should not hard-code "four."

**QUOTE:** "DORA has identified five software delivery performance metrics that provide an effective way of measuring the outcomes of the software delivery process. DORA's research shows that these performance metrics predict better organizational performance and well-being for team members."
- **URL:** https://dora.dev/guides/dora-metrics/
- **Source:** DORA, *DORA's software delivery performance metrics* (updated Jan 2026)

**QUOTE (metric definitions):** "Change lead time: The amount of time it takes for a change to go from committed to version control to deployed in production. ... Deployment frequency: The number of deployments over a given period or the time between deployments. ... Failed deployment recovery time: The time it takes to recover from a deployment that fails and requires immediate intervention. ... Change fail rate: The ratio of deployments that require immediate intervention following a deployment."
- **URL:** https://dora.dev/guides/dora-metrics/
- **Source:** DORA, *DORA's software delivery performance metrics*

**QUOTE (speed/stability not a trade-off — load-bearing for the solo tier):** "DORA's research has repeatedly demonstrated that speed and stability are not tradeoffs. In fact, we see that the metrics are correlated for most teams. Top performers do well across all five metrics, and low performers do poorly."
- **URL:** https://dora.dev/guides/dora-metrics/
- **Source:** DORA, *DORA's software delivery performance metrics*

**QUOTE (original four-keys statement, Google Cloud):** "Deployment Frequency—How often an organization successfully releases to production ... Lead Time for Changes—The amount of time it takes a commit to get into production ... Change Failure Rate—The percentage of deployments causing a failure in production ... Time to Restore Service—How long it takes an organization to recover from a failure in production"
- **URL:** https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance
- **Source:** Google Cloud Blog, *Using the Four Keys to measure your DevOps performance* (DORA team-authored)

**What predicts performance (capability-level, primary):** trunk-based development (2016/2017 analysis, quoted above), continuous integration (2015/2019, quoted above), deployment automation (DORA capability page, quoted above), and — for BR-02's review requirement — the 2023 report: "Teams with faster code reviews have 50% higher software delivery performance." (https://dora.dev/research/2023/dora-report/2023-dora-accelerate-state-of-devops-report.pdf, 2023; snippet verified via search, full PDF not re-fetched — adequate for a supporting citation).

---

## Sources

**Kept (all fetched & read in full unless noted):**
- DORA Capabilities: Continuous integration — https://dora.dev/capabilities/continuous-integration/ — anchors CI-02, ENV-03, daily-CI evidence.
- DORA Capabilities: Trunk-based development — https://dora.dev/capabilities/trunk-based-development/ — anchors BR-04/BR-05, required-checks endorsement.
- DORA Capabilities: Deployment automation — https://dora.dev/capabilities/deployment-automation/ — anchors CI-03, CI-04 (smoke test as pipeline constituent).
- DORA software delivery performance metrics — https://dora.dev/guides/dora-metrics/ — anchors four/five keys + predictive framing.
- DORA 2019 Accelerate State of DevOps Report (PDF) — https://dora.dev/research/2019/dora-report/2019-dora-accelerate-state-of-devops-report.pdf — "CI improves CD" revalidation (search-verified snippet).
- DORA 2023 Accelerate State of DevOps Report (PDF) — https://dora.dev/research/2023/dora-report/2023-dora-accelerate-state-of-devops-report.pdf — code-review speed finding (search-verified snippet, supporting only).
- GitHub Docs: About protected branches — https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches — required status checks, strict mode (BR-03).
- GitHub Docs: Deployments and environments — https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments — required reviewers, protection rules (ENV-04).
- GitHub Docs: Deployment environments — https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments — canonical tier names (ENV-01).
- GitLab Docs: Protected environments — https://docs.gitlab.com/ci/environments/protected_environments/ — approval gates + tier model (ENV-04, ENV-01).
- GitLab Docs: Auto-merge / require successful pipeline — https://docs.gitlab.com/user/project/merge_requests/auto_merge/ — pipelines-must-succeed (BR-03).
- GitLab Docs: Deployment approvals — https://docs.gitlab.com/ci/environments/deployment_approvals/ — "Deployments are blocked until all required approvals are given" (search-verified snippet).
- Google SRE Book ch.8 Release Engineering — https://sre.google/sre-book/release-engineering/ — release automation as default (CI-03).
- Google SRE Book ch.17 Testing for Reliability — https://sre.google/sre-book/testing-reliability/ — smoke-test definition & per-release smoke tests (CI-04).
- Google SRE Workbook ch.13 Data Processing Pipelines — https://sre.google/workbook/data-processing/ — staging data realism (ENV-05) + manual stage-gate precedent (ENV-04).
- AWS Well-Architected OPS05-BP08 Use multiple environments — https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_dev_integ_multi_env.html — tiering + escalating controls (ENV-01/04).
- AWS Well-Architected OPS06-BP02 Test deployments — https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_mit_deploy_risks_test_val_chg.html — pre-prod same-as-prod validation (ENV-06).
- AWS Well-Architected OPS06-BP04 Automate testing and rollback — https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_mit_deploy_risks_auto_testing_and_rollback.html — post-deploy automated verification (CI-04).
- AWS DevOps Guidance DL.ADS.1 — https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.ads.1-test-deployments-in-pre-production-environments.html — progressive env gates (ENV-03/06).
- AWS DevOps Guidance QA.TEM.1 — https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/qa.tem.1-establish-dedicated-testing-environments.html — production-like test environments (ENV-05).
- The Twelve-Factor App, X. Dev/prod parity — https://12factor.net/dev-prod-parity — tier parity doctrine (ENV-05).
- NIST SP 800-53 Rev.5 (PDF), CM-3 — https://nvlpubs.nist.gov/nistpubs/specialpublications/NIST.SP.800-53r5.pdf — formal change-approval control (ENV-04 compliance anchor).
- Google Cloud Blog, Four Keys — https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance — original four-metrics statement (DORA-authored).

**Dropped:**
- Atlassian "DORA Metrics" page, Octopus Deploy "4 DORA Metrics", Thoughtworks Radar — vendor/secondary commentary; dora.dev primary available.
- trunkbaseddevelopment.com, martinfowler.com CI/bliki articles — cited *by* DORA as provenance but are practitioner blogs; skeleton's citation contract excludes blog opinions as primary evidence. DORA's capability pages already restate the findings with research backing.
- csf.tools / STIG Viewer / Daydream mirrors of NIST CM-3 — used to confirm control wording; replaced by the official nvlpubs.nist.gov PDF as the cited URL.
- Red-gate/DATPROF/ubs-hainer "DORA compliance" pages — wrong DORA (EU Digital Operational Resilience Act); irrelevant.
- excellalabs/dora-capability-reference-guide (GitHub) — third-party summary; superseded by dora.dev.
- Dojo Consortium "24 Capabilities" — restatement of Accelerate; dora.dev preferred.

## Gaps

1. **ENV-03 "daily deploy to dev" is only partially sourced** (see Claim 3). No primary source found that prescribes a literal daily deploy cadence to a dev environment; DORA's daily cadence applies to builds/tests, AWS's to progressive gating. Recommendation: rule prose uses "on merge / frequent," severity stays team-warn. If a stronger citation is required, the next candidate is AWS's *Going faster with continuous delivery* (Builders' Library) — secondary-tier, not fetched to stay in budget.
2. **Staging data realism** is sourced only in a data-pipeline context (SRE Workbook ch.13). It generalizes plausibly and ENV-05 is judgment-only anyway, but the spec prose should quote it with the context noted rather than as a universal mandate.
3. **2023/2024 DORA PDFs were quote-verified via search snippets, not full-PDF fetch** (budget). The 2023 code-review quote is used only as supporting evidence for BR-02; if it becomes load-bearing, fetch the PDF and re-verify page numbers.
4. **NIST CM-3 wording** verified against two independent mirrors + search snippet of the official PDF; character-exact letter casing should be re-checked against the PDF if quoted in final spec prose (control text is stable across Rev 5 prints).
5. No claim in this angle required an UNVERIFIED flag; no excluded-scope topics (multi-region, org-process) were needed to cover the questions.
