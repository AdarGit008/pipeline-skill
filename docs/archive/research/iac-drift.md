# Research brief — angle (b): Infrastructure as Code & configuration drift

**Purpose:** justify the `IAC` rule family (IAC-01..06, plus ENV-01/02 cross-references) in the pipeline-skill spec, per plan-skeleton §5(b). Every claim below carries verbatim quotes + URL from a primary source (HashiCorp/Terraform docs, HashiCorp Well-Architected Framework, AWS Well-Architected, 12factor.net, GitHub's official gitignore repo). No blog opinions are used as primary evidence. All vendor docs cited are undated living documents ("latest"); all were retrieved and quote-verified during this research pass. Nothing below is UNVERIFIED.

**Verdict summary (Appendix B format):** all five §5(b) claims survive; two carry narrowing notes (Q1 "prohibited", Q4 12-factor shape). No rule needs downgrading or cutting. Severity proposals in the taxonomy hold as written.

---

## 1. §5(b)-Q1 — "All infrastructure must be defined as code and version-controlled with the application; manual console changes are prohibited."

**Gates: IAC-01 (blocker @ team), IAC-03 (warn @ team).**

**Verdict: survives, with one narrowing note.** Primary sources uniformly establish IaC-in-version-control as the baseline practice and manual console changes as the named failure mode. None use the word "prohibited" — the strongest vendor statement is "best practice is to use Terraform for all infrastructure changes," and AWS frames manual processes as the error source. This matches the taxonomy as designed: IAC-01 (mechanism exists) = blocker @ team; IAC-03 (pipeline applies it) = warn @ team with a `deviation` sign-off for accepted manual application. The rule prose should say "manual console changes are the flagged failure source," not quote sources as saying "prohibited."

**QUOTE:** "HashiCorp Terraform is an infrastructure as code tool that lets you define both cloud and on-prem resources in human-readable configuration files that you can version, reuse, and share."
**URL:** https://developer.hashicorp.com/terraform/intro
**Source:** HashiCorp Developer — "What is Terraform" (undated living doc; retrieved this research pass)

**QUOTE:** "Infrastructure as Code (IaC) tools allow you to manage infrastructure with configuration files rather than through a graphical user interface. IaC allows you to build, change, and manage your infrastructure in a safe, consistent, and repeatable way by defining resource configurations that you can version, reuse, and share."
**URL:** https://developer.hashicorp.com/terraform/tutorials/aws-get-started/infrastructure-as-code
**Source:** HashiCorp Developer — "What is Infrastructure as Code with Terraform?" (undated; retrieved this pass)

**QUOTE:** "You can commit your configurations to version control to safely collaborate on infrastructure."
**URL:** https://developer.hashicorp.com/terraform/tutorials/aws-get-started/infrastructure-as-code
**Source:** HashiCorp Developer — same tutorial as above. Directly supports "version-controlled with the application."

**QUOTE:** "Infrastructure as code (IaC) provides a declarative approach to defining your infrastructure that creates version-controlled specifications you can review, test, and automate."
**URL:** https://developer.hashicorp.com/well-architected-framework/define-and-automate-processes/define/as-code/infrastructure
**Source:** HashiCorp Well-Architected Framework — "Use infrastructure as code" (undated; retrieved this pass)

**QUOTE (manual console changes as the failure source):** "**Eliminate manual configuration errors:** Manual infrastructure provisioning through cloud consoles leads to inconsistent configurations, missed steps, and deployment failures. … **Provide auditability and compliance:** Manual changes through cloud consoles leave incomplete audit trails that fail compliance requirements."
**URL:** https://developer.hashicorp.com/well-architected-framework/define-and-automate-processes/define/as-code/infrastructure
**Source:** HashiCorp Well-Architected Framework — "Use infrastructure as code" (undated; retrieved this pass)

**QUOTE (the narrowing note — best practice, not absolute prohibition):** "Although best practice is to use Terraform for all infrastructure changes to ensure consistent workflows and change visibility, your organization may occasionally need to make manual changes."
**URL:** https://developer.hashicorp.com/terraform/tutorials/cloud/drift-detection
**Source:** HashiCorp Developer — "Use health assessments to detect infrastructure drift" (undated; retrieved this pass)

**supports rule:** IAC-01 — IaC tool presence is the foundational, versionable mechanism (blocker @ team holds). IAC-03 — pipeline-applied IaC is the "consistent workflow"; manual application is the flagged deviation, not an unforgivable violation (warn @ team + `deviation` sign-off holds).

---

## 2. §5(b)-Q2 — "Configuration drift between declared IaC and real infrastructure is an expected failure mode and must be detected (e.g., scheduled plan/drift detection), not assumed absent."

**Gates: IAC-04 (warn @ critical; scheduled-drift mechanism presence or drift-watch sign-off).**

**Verdict: survives as written — the strongest-sourced claim in this angle.** HashiCorp documents drift as an expected, unpreventable condition requiring detection; its Well-Architected Framework explicitly prescribes CI/CD-pipeline and scheduled drift detection; AWS Well-Architected independently defines drift and mandates detection/remediation. This is exactly the mechanism IAC-04 checks for at rest (scheduled `plan`/drift workflow) — the checker verifies the mechanism's presence, never the cloud (§0.2), and these citations are why the mechanism matters.

**QUOTE (drift is expected and unpreventable):** "Over time, your resources may change outside of the Terraform workflow. This can be due to service failures or degradation, certificate expirations, or manual modification by other users. Terraform cannot prevent these changes, but health assessments help you detect them quickly so you can resolve them."
**URL:** https://developer.hashicorp.com/terraform/tutorials/cloud/drift-detection
**Source:** HashiCorp Developer — "Use health assessments to detect infrastructure drift" (undated; retrieved this pass)

**QUOTE (drift definition, official docs):** "Drift detection determines whether your real-world infrastructure matches your Terraform configuration." … "Configuration drift occurs when changes are made outside Terraform's regular process, leading to inconsistencies between the remote objects and your configured infrastructure."
**URL:** https://developer.hashicorp.com/terraform/cloud-docs/workspaces/health
**Source:** HashiCorp Developer — "Health assessments in HCP Terraform" (undated; retrieved this pass)

**QUOTE (manual console change as canonical drift cause):** "For example, a teammate could create configuration drift by directly updating a storage bucket's settings with conflicting configuration settings using the cloud provider's console."
**URL:** https://developer.hashicorp.com/terraform/cloud-docs/workspaces/health
**Source:** HashiCorp Developer — "Health assessments in HCP Terraform" (undated; retrieved this pass)

**QUOTE (consequences + pipeline/scheduled detection — the IAC-04 mechanism itself):** "Infrastructure drift occurs when your actual infrastructure state differs from your Terraform configuration, often due to manual changes, cloud provider updates, or unauthorized modifications. This drift can cause deployment failures, security vulnerabilities, and operational inconsistencies that impact your application's reliability and performance." … "Implement drift detection as part of your CI/CD pipeline to catch configuration issues before they reach production. Configure your pipeline to run drift detection checks after deployments and during regular maintenance windows to ensure ongoing compliance."
**URL:** https://developer.hashicorp.com/well-architected-framework/optimize-systems/monitor-system-health/detect-configuration-drift
**Source:** HashiCorp Well-Architected Framework — "Automatically detect resource drift and health" (undated; retrieved this pass). The second sentence directly justifies IAC-04's mechanical check for a scheduled drift workflow.

**QUOTE (independent AWS anchor):** "_Drift_ is defined as any change that causes an infrastructure resource to have a different state or configuration to what is expected. Any type of unmanaged configuration change goes against the notion of immutable infrastructure, and should be detected and remediated in order to have a successful implementation of immutable infrastructure."
**URL:** https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_tracking_change_management_immutable_infrastructure.html
**Source:** AWS Well-Architected Framework — REL08-BP04 "Deploy using immutable infrastructure" (undated "latest"; retrieved this pass)

**supports rule:** IAC-04 — drift is documented as expected ("cannot prevent these changes"), harmful ("deployment failures, security vulnerabilities"), and the prescribed countermeasure is a scheduled/pipeline detection mechanism — precisely what the rule's cron-`plan` presence check and drift-watch sign-off encode. Warn @ critical holds.

---

## 3. §5(b)-Q3 — "IaC state must be stored remotely/shared (with locking) for any team, and local state files must never be committed."

**Gates: IAC-02 (warn @ team; backend config present + local state git-ignored).**

**Verdict: survives as written.** HashiCorp's own docs state all three sub-claims verbatim: local state breaks team usage, remote state is the team mechanism, locking prevents corruption, and state must not be stored in version control. GitHub's official Terraform .gitignore operationalizes the "never committed" half that IAC-02's tree check scans for.

**QUOTE (local state fails teams):** "By default, Terraform stores state locally in a file named `terraform.tfstate`. When working with Terraform in a team, use of a local file makes Terraform usage complicated because each user must make sure they always have the latest state data before running Terraform and make sure that nobody else runs Terraform at the same time."
**URL:** https://developer.hashicorp.com/terraform/language/state/remote
**Source:** HashiCorp Developer — "State: Remote Storage" (undated; retrieved this pass)

**QUOTE (remote state is the team mechanism):** "With _remote_ state, Terraform writes the state data to a remote data store, which can then be shared between all members of a team."
**URL:** https://developer.hashicorp.com/terraform/language/state/remote
**Source:** HashiCorp Developer — "State: Remote Storage" (undated; retrieved this pass)

**QUOTE (locking):** "If supported by your backend, Terraform will lock your state for all operations that could write state. This prevents others from acquiring the lock and potentially corrupting your state."
**URL:** https://developer.hashicorp.com/terraform/language/state/locking
**Source:** HashiCorp Developer — "State: Locking" (undated; retrieved this pass)

**QUOTE (never commit state — explicit vendor warning):** "Avoid storing your state in a version control system or other storage solution that does not support Terraform state locking and secure access control, because doing so can result in data loss or exposure of secrets stored in the state file."
**URL:** https://developer.hashicorp.com/terraform/language/state
**Source:** HashiCorp Developer — "State" (undated; retrieved this pass). Also on the same page: "We recommend storing state in HCP Terraform or a remote backend to securely store state and collaborate with team members."

**QUOTE (the gitignore convention IAC-02 scans for):** "# .tfstate files
*.tfstate
*.tfstate.*"
**URL:** https://github.com/github/gitignore/blob/main/Terraform.gitignore
**Source:** GitHub — official `github/gitignore` repository, `Terraform.gitignore` (living repo; retrieved this pass)

**supports rule:** IAC-02 — remote backend presence + state files git-ignored is the exact mechanical twin of HashiCorp's stated recommendation and warning. Warn @ team holds (solo/core exclusion is consistent: the cited complication is explicitly "when working with Terraform in a team").

---

## 4. §5(b)-Q4 — "Environment parity (dev≈staging≈prod) is achieved by replicating one IaC definition across tiers with per-environment configuration separated from shared definition."

**Gates: IAC-05 (warn @ critical), supports ENV-01/02.**

**Verdict: survives, with a narrowing note.** 12-factor supplies the parity principle and the config/code separation principle verbatim, but it is application-config-shaped, not infra-shaped. The Terraform docs close the gap: HashiCorp's official multi-environment patterns are precisely "one definition + per-environment variables/branches," and CLI workspaces are "multiple distinct instances of that configuration." IAC-05's check (workspaces / per-env tfvars / per-env stack dirs) maps one-to-one onto these documented patterns.

**QUOTE (parity principle):** "**The twelve-factor app is designed for [continuous deployment](http://avc.com/2011/02/continuous-deployment/) by keeping the gap between development and production small.**" … "But all deploys of the app (developer environments, staging, production) should be using the same type and version of each of the backing services."
**URL:** https://12factor.net/dev-prod-parity
**Source:** The Twelve-Factor App — "X. Dev/prod parity" (Heroku co-founder Adam Wiggins et al.; living doc; retrieved this pass)

**QUOTE (separation of per-env config from shared definition):** "Apps sometimes store config as constants in the code. This is a violation of twelve-factor, which requires **strict separation of config from code**. Config varies substantially across deploys, code does not."
**URL:** https://12factor.net/config
**Source:** The Twelve-Factor App — "III. Config" (living doc; retrieved this pass)

**QUOTE (HashiCorp's official per-environment pattern — one definition, env differences in variables):** "There are also a variety of ways to handle multiple environments. The most common approaches are: … All environments use the same main branch, and environment differences are handled with Terraform variables. To protect production environments, wait to apply runs until their changes are verified in staging."
**URL:** https://developer.hashicorp.com/terraform/enterprise/workspaces/configurations
**Source:** HashiCorp Developer — "Manage Terraform configurations" (undated; retrieved this pass)

**QUOTE (one definition, multiple instances — the workspace mechanism IAC-05 detects):** "Some backends support multiple named workspaces, allowing multiple states to be associated with a single configuration. The configuration still has only one backend, but you can deploy multiple distinct instances of that configuration without configuring a new backend or changing authentication credentials."
**URL:** https://developer.hashicorp.com/terraform/language/state/workspaces
**Source:** HashiCorp Developer — "State: Workspaces" (undated; retrieved this pass)

**QUOTE (AWS corroboration — parity is the benefit of one replicated definition):** "**Increased consistency across environments:** Since there are no differences in infrastructure resources across environments, consistency is increased and testing is simplified."
**URL:** https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_tracking_change_management_immutable_infrastructure.html
**Source:** AWS Well-Architected Framework — REL08-BP04 (undated "latest"; retrieved this pass)

**supports rule:** IAC-05 — per-env separation (workspaces/tfvars/stack dirs) is a documented vendor pattern, not an invented preference; warn @ critical holds. ENV-01/02 — the parity principle justifies declaring tiers and requiring each to have the same automated path.

---

## 5. §5(b)-Q5 — "Secrets must not be committed in IaC source or variable files (tfvars etc.); secret material belongs in a manager or protected CI variables."

**Gates: IAC-06 (blocker @ team; secret-shape scan over IaC globs + tfvars git-ignore).**

**Verdict: survives as written.** HashiCorp states verbatim that secrets in configuration flow into state and plan files, that `.tfvars` with sensitive values must not be checked into version control, and that source-control exposure is a named risk. GitHub's official Terraform .gitignore excludes `*.tfvars` for exactly this reason. A blocker at team tier is proportionate: the failure mode (secrets in git history) is unrecoverable without rotation.

**QUOTE (secrets in config land in state/plan):** "Terraform may require access to sensitive data, such as cloud provider credentials, API tokens, and other secrets to provision your infrastructure. If you add secret values directly to your configuration, Terraform stores those secrets in its state and plan files."
**URL:** https://developer.hashicorp.com/terraform/language/manage-sensitive-data
**Source:** HashiCorp Developer — "Manage sensitive data in your configuration" (undated; retrieved this pass)

**QUOTE (plaintext state; exclude from Git):** "If you are developing with Terraform locally, Terraform stores your state in a plaintext file, which includes any secret values you defined in your configuration. Treat your state file as sensitive data by excluding it from Git workflows and following our recommendations to [secure your state file]."
**URL:** https://developer.hashicorp.com/terraform/language/manage-sensitive-data
**Source:** HashiCorp Developer — same page (undated; retrieved this pass). Also on this page: "Terraform stores values with the `sensitive` argument in both state and plan files, and anyone who can access those files can access your sensitive values." — i.e., even the `sensitive` flag does not make committed values safe.

**QUOTE (source control as a named exposure channel):** "Often you need to configure your infrastructure using sensitive or secret information such as usernames, passwords, API tokens, or Personally Identifiable Information (PII). When you do so, you need to ensure that you do not accidentally expose this data in CLI output, log output, or source control."
**URL:** https://developer.hashicorp.com/terraform/tutorials/configuration-language/sensitive-variables
**Source:** HashiCorp Developer — "Protect sensitive input variables" (undated; retrieved this pass)

**QUOTE (tfvars must not be committed — the exact IAC-06 check):** "You must also be careful not to check `.tfvars` files with sensitive values into version control. For this reason, GitHub's recommended [.gitignore file for Terraform configuration](https://github.com/github/gitignore/blob/master/Terraform.gitignore) is configured to ignore files matching the pattern `*.tfvars`."
**URL:** https://developer.hashicorp.com/terraform/tutorials/configuration-language/sensitive-variables
**Source:** HashiCorp Developer — "Protect sensitive input variables" (undated; retrieved this pass). Note this page itself points to GitHub's official gitignore, closing the loop between vendor guidance and the mechanical check.

**QUOTE (the gitignore text IAC-06 verifies):** "# Exclude all .tfvars files, which are likely to contain sensitive data, such as
# password, private keys, and other secrets. These should not be part of version
# control as they are data points which are potentially sensitive and subject
# to change depending on the environment.
*.tfvars
*.tfvars.json"
**URL:** https://github.com/github/gitignore/blob/main/Terraform.gitignore
**Source:** GitHub — official `github/gitignore` repository (living repo; retrieved this pass)

**QUOTE (general principle, app-side corroboration):** "A litmus test for whether an app has all config correctly factored out of the code is whether the codebase could be made open source at any moment, without compromising any credentials."
**URL:** https://12factor.net/config
**Source:** The Twelve-Factor App — "III. Config" (living doc; retrieved this pass)

**supports rule:** IAC-06 — blocker @ team holds. Vendor docs name source control as an exposure channel and tfvars-in-VCS as the specific mistake; the rule's narrow IaC-glob scan + tfvars git-ignore check is the mechanical twin (cross-references baseline SEC per §4.2 overlap control, does not restate it).

---

## 6. Core claim — immutable / disposable infrastructure

**Gates: IAC family rationale; reinforces IAC-03 (apply via pipeline, not in-place console edits).**

**Verdict: survives.** AWS Well-Architected has a dedicated best practice defining immutable infrastructure and tying it to drift reduction and IaC; Terraform's own intro claims the immutable approach. Note for the spec author: immutability is a *stance* the checker cannot verify at rest — it anchors the family's `lesson`/`rationale` prose, not a mechanical check. No rule depends on it; treat as rationale-grade.

**QUOTE (definition + no in-place changes):** "Immutable infrastructure is a model that mandates that no updates, security patches, or configuration changes happen in-place on production workloads. When a change is needed, the architecture is built onto new infrastructure and deployed into production." … "**Desired outcome:** With immutable infrastructure, no [in-place modifications] are allowed to run infrastructure resources within a workload."
**URL:** https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_tracking_change_management_immutable_infrastructure.html
**Source:** AWS Well-Architected Framework — REL08-BP04 "Deploy using immutable infrastructure" (undated "latest"; retrieved this pass)

**QUOTE (immutability as drift prevention):** "**Reduction in configuration drifts:** By replacing infrastructure resources with a known and version-controlled configuration, the infrastructure is set to a known, tested, and trusted state, avoiding configuration drifts."
**URL:** https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_tracking_change_management_immutable_infrastructure.html
**Source:** AWS Well-Architected Framework — REL08-BP04 (undated "latest"; retrieved this pass)

**QUOTE (IaC is the enabling mechanism):** "With [infrastructure as code (IaC)], infrastructure provisioning, orchestration, and deployment steps are defined in a programmatic, descriptive, and declarative way and stored in a source control system. Leveraging infrastructure as code makes it simpler to automate infrastructure deployment and helps achieve infrastructure immutability."
**URL:** https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_tracking_change_management_immutable_infrastructure.html
**Source:** AWS Well-Architected Framework — REL08-BP04 (undated "latest"; retrieved this pass)

**QUOTE (Terraform's own stance):** "Terraform takes an [immutable approach to infrastructure](https://www.hashicorp.com/resources/what-is-mutable-vs-immutable-infrastructure), reducing the complexity of upgrading or modifying your services and infrastructure."
**URL:** https://developer.hashicorp.com/terraform/intro
**Source:** HashiCorp Developer — "What is Terraform" (undated; retrieved this pass)

**supports rule:** IAC-03 rationale (pipeline-applied replace/reconcile instead of in-place console mutation) and the IAC family `lesson` prose. Also cross-feeds RB rationale (immutable deployments make "previous version still exists" rollback cheap — REL08-BP04: "the previous working version is not changed. You can roll back to it if errors are detected.").

---

## 7. Core claim — AWS Well-Architected operational-excellence guidance on infrastructure as code

**Gates: cross-cutting anchor for IAC-01/03; the official AWS counterpart to the HashiCorp citations.**

**Verdict: survives.** The operational-excellence design principles explicitly direct defining the entire workload — including infrastructure — as code, and name limiting human error as the goal. OPS05-BP03 names manual processes as the error source and lists an untracked manual security-group change as a textbook anti-pattern. This is the neutral, non-vendor-product anchor the spec's `sources[]` arrays should cite alongside HashiCorp docs.

**QUOTE (define the whole workload as code; limit human error):** "**Safely automate where possible:** In the cloud, you can apply the same engineering discipline that you use for application code to your entire environment. You can define your entire workload and its operations (applications, infrastructure, configuration, and procedures) as code, and update it. … Through effective automation, you can achieve consistent responses to events, limit human error, and reduce operator toil."
**URL:** https://docs.aws.amazon.com/wellarchitected/latest/framework/oe-design-principles.html
**Source:** AWS Well-Architected Framework — Operational excellence "Design principles" (undated "latest"; retrieved this pass). (The archived 2023-04-10 revision states the same principle under its former heading: "**Perform operations as code:** … By performing operations as code, you limit human error and achieve consistent responses to events." — https://docs.aws.amazon.com/wellarchitected/2023-04-10/framework/oe-design-principles.html — cited from search-result extract, same official AWS source; use the "latest" URL as primary.)

**QUOTE (manual processes = error source; untracked manual change = anti-pattern):** "Use configuration management systems to make and track configuration changes. These systems reduce errors caused by manual processes and reduce the level of effort to deploy changes." … "**Common anti-patterns:** … Someone has updated your security groups and your web servers are no longer accessible. Without knowledge of what was changed you spend significant time investigating the issue extending your time to recovery."
**URL:** https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_dev_integ_conf_mgmt_sys.html
**Source:** AWS Well-Architected Framework — OPS05-BP03 "Use configuration management systems" (undated "latest"; retrieved this pass). Also on this page: "Changes to configurations should be updated through agreed change control procedures and applied consistently, honoring version control."

**supports rule:** IAC-01/IAC-03 — the OE pillar is the vendor-neutral mandate that infrastructure be defined and operated as code; the anti-pattern list is the primary-source evidence that manual console changes are a recognized failure source with direct MTTR impact. Also feeds IAC-04's rationale ("use automated inspection to continually monitor resource configurations across environments").

---

## Taxonomy impact (per Appendix B)

| §5(b) claim | Verdict | Rule outcome |
|---|---|---|
| Q1 IaC + no manual console changes | survives, narrowed ("prohibited" → "flagged failure source / deviation") | IAC-01 blocker @ team holds; IAC-03 warn @ team + `deviation` holds |
| Q2 drift expected + detected | survives as written (strongest sourcing) | IAC-04 warn @ critical holds |
| Q3 remote shared state + locking | survives as written | IAC-02 warn @ team holds |
| Q4 parity via one definition + per-env config | survives, narrowed (12-factor is app-shaped; Terraform patterns close gap) | IAC-05 warn @ critical holds; ENV-01/02 supported |
| Q5 no secrets in IaC/tfvars | survives as written | IAC-06 blocker @ team holds |
| Immutable/disposable infra (core) | survives as rationale-grade | family prose; no mechanical check |
| AWS WA OE IaC guidance (core) | survives | cross-cutting anchor for IAC-01/03/04 |

No UNVERIFIED items. No blog-tier sources were needed as primary evidence; the AWS DevOps blog, Spacelift/env0/Harness/ops0 drift articles surfaced in search were all dropped in favor of official docs covering the same claims.
