<!--
  Scaffold for HOT-03 (An incident response doc exists before the incident — warning, team+,
  applies to service/app). Save this as docs/incident-response.md (or a section in RUNBOOK.md,
  runbooks/**/*.md, docs/incident*.md, docs/oncall*.md, docs/runbooks/**/*.md) and fill it in.
  HOT-03's check requires both: (1) an incident/outage/deploy-fail/rollback context, and
  (2) escalation/first-moves content (escalat / on-call / on call / pager / paging / contact /
  who to call). Prepare it IN ADVANCE:
  "Develop and document your incident management procedures in advance, in consultation with
   incident participants." (Google SRE, ch.14). The documented failure mode is the doc existing
   but being unfindable — hence the conventional path.
-->

# Incident response — failed deploy / production outage

Prepared in advance. When a deploy fails or production degrades, follow this — don't improvise.

## Who to page

- **Primary on-call:** `<name / rotation / how to page — PagerDuty, Opsgenie, phone>`.
- **Escalation (if no ack in N minutes):** `<secondary → incident commander → eng lead>`.
- **Who to notify:** `<affected-service owners, support, status page>`.

## First diagnostic moves

1. Confirm the blast radius: `<dashboards / health checks / error-rate query>`.
2. Was it the last deploy? `<how to check recent deploys / correlate with the change>`.
3. **Decide: roll back or forward-fix.** Default to rollback if unsure — see the rollback runbook.
4. Execute: `<link to RUNBOOK.md#rollback>`.

## Escalation order

`<on-call → incident commander → service owner → leadership>`, with the trigger for each hop
(time-to-ack, severity, customer impact).

## After

- Restore service, confirm recovery against the recovery objective (RB-04).
- Write up the incident (blameless): timeline, cause, what to fix so it can't recur.
