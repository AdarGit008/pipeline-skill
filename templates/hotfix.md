<!--
  Scaffold for HOT-01 (A hotfix path is documented — warning, team+, applies to service/app/infra).
  Copy the Hotfix section below into CONTRIBUTING.md, README.md, docs/*.md, or runbooks/**/*.md
  and rewrite it for THIS repo. HOT-01's check requires all three elements in one place:
    (1) the word "hotfix", (2) branching FROM production (branch / branched off / from main /
    from master / from prod), and (3) an approver (approv / review / sign-off).
  This checks the hotfix DOCUMENTATION only — it never mandates the full GitFlow branch set.
  "If you intend to lock a long-lived branch, it is critical to define your hotfix process and
   enforce it. If undefined and unenforced, every change becomes a hotfix." (GitLab Docs).
-->

# Hotfix

An expedited path for a critical production defect that cannot wait for the normal release train.

## Procedure

1. **Branch from production.** Create `hotfix/<short-desc>` off the current production tag or the
   production branch — not off the in-progress integration line. (BR-06 guarantees a release tag
   exists to branch from; HOT-02 checks the hotfix is back-merged into the dev line afterward.)
2. **Make the minimal fix.** Smallest change that resolves the incident; no opportunistic refactors.
3. **Which checks still run.** `<name the required checks that gate even a hotfix — CI, security
   scan, the pipeline check itself; state explicitly what may be skipped and by whose authority>`.
4. **Who may approve.** `<the named approver(s) for an expedited merge>` must review and sign off
   before it merges to production. No self-merge of a hotfix.
5. **Back-merge.** Merge the hotfix back into the default/integration branch so the fix isn't lost
   in the next release (HOT-02).
6. **Follow up.** File the incident notes (docs/incident-response.md) and any deviation judgment if
   a normal gate was consciously bypassed (`pipeline jdg new --kind break-glass`).
