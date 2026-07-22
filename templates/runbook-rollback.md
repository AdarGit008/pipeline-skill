<!--
  Scaffold for RB-01 (A rollback path is documented — core blocker, applies to service/app/infra).
  Copy the Rollback section below into your README.md or a runbook (RUNBOOK.md, runbooks/**/*.md,
  docs/runbooks/**/*.md, docs/*.md) and rewrite it for THIS repo's real deploy mechanism.
  RB-01's check looks for a rollback/revert section that also names deploy/release/version/previous —
  so keep both the "how to revert" verbs and a reference to the previous version.
  The strongest sentence in the corpus: "it is better to have a well-thought out plan in place
  instead of trying to make one up when your service is on fire" (Google SRE, CRE life lessons).
-->

# Rollback

**When to roll back:** a deploy introduced a catastrophic, debilitating, or merely annoying
regression and forward-fixing is slower than reverting. Decide fast; the plan below is the
big red button — identified in advance, not improvised during the incident.

## Revert / redeploy the previous version

> Replace with this repo's actual mechanism. Examples:
> - **Redeploy previous image/artifact:** `<deploy-tool> deploy --version <previous-tag>`
>   (the previous release tag exists — BR-06 guarantees one).
> - **Revert the merge:** `git revert <sha> && <deploy-tool> deploy` on the default branch.
> - **Feature flag off:** flip the guarding flag (records/flags/FLAG-NNNN.json) to disable
>   the change without a redeploy.

1. Identify the last known-good version: `<how to find the previous release tag/artifact>`.
2. Roll back: `<the exact command(s)>`.
3. Verify recovery: `<health check / smoke test that proves service is restored>`.
4. Communicate: `<who to tell — see docs/incident-response.md>`.

## Data & migrations

- Is there a schema/data migration to reverse? `<forward-only? reversible? how>`.
- If irreversible, name the containment step (feature flag, read-only mode, restore from backup).

## Recovery objective

`<state the target — e.g. "restore service within 30 minutes of a failed deploy">`.
This should match `recovery_objective` in pipeline.repo.json (reviewed by RB-04).
