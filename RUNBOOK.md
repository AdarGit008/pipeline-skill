# Runbook — pipeline-skill

Operational notes for the pipeline-skill tool itself. It is a zero-dependency
checker distributed as an agent skill: "shipping" it means publishing a new
rule-set + engine version (`rules.json` carries the version), and "rolling back"
means restoring the previous one. There is no running service, no datastore, and
no in-flight state — the checker only ever reads at-rest planes.

## Rollback

To roll back a bad release of the tool:

1. **Revert the content.** `git revert <commit>` (or `git checkout <previous-tag> -- .`)
   to restore the previous rule set + engine.
2. **Re-validate.** Run `node check.mjs --self-check` to confirm the restored rule
   set is internally consistent before anyone consumes it again.
3. **Re-sync the skill** from the reverted tree so consumers pick up the previous
   version, then spot-check with `node check.mjs --repo <a-known-repo>` that the
   scorecard matches the pre-release baseline.

Because the checker is stateless, a rollback is a pure content revert — no data
migration and no state to unwind.

## Break-glass

If a malformed rule set somehow reaches `main`, the CI `--self-check` gate should
have caught it (see `.github/workflows/ci.yml`). Record any manual bypass of that
gate as a `break-glass` judgment: `node pipeline.mjs jdg new --kind break-glass
--subject "<what>" --gate "<mechanism bypassed>" --reason "..." --review-by <date>`.
