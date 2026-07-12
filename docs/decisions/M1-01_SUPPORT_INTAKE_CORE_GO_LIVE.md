# M1-01 — Durable Support Intake Core Go-Live Decision

- **Status:** Approved
- **Approved by:** Authorized JPV Bootcamp business owner
- **Approval date:** 12 July 2026
- **Implementation packet:** M1-01
- **Related controls:** H0-04 and H1-03

## Decision summary

Durable support intake is explicitly included in the **first core go-live scope** for JPV Bootcamp.

M1-01 is authorized to replace the current guarded, preview-only support submission behavior with a durable, reviewable, failure-safe workflow, provided the implementation can use existing repository persistence, review, access, and queued-email foundations without adding or applying a database migration or changing a schema.

## Approved implementation boundaries

M1-01 may:

- keep `/api/support` protected by the shared public-request guard;
- persist only validated and normalized support fields;
- return success only after durable persistence succeeds;
- add deterministic deduplication and idempotency using existing persistence capabilities;
- place new support requests into an explicit review state;
- queue notification only after persistence succeeds;
- preserve a persisted request if queueing fails;
- update the support page from preview-only behavior only after the durable workflow is implemented and validated.

M1-01 must not:

- add or apply a migration;
- change Prisma or Payload schemas;
- merge support intake into an unrelated sponsored-application domain model merely to avoid a schema decision;
- grant sponsored or member access from a support submission;
- bypass existing administrator authorization boundaries;
- send email directly when an existing durable queue contract applies;
- fabricate or return a reference before persistence succeeds;
- change provider, deployment, Stripe, email-provider, database, or Payload configuration;
- begin M1-02, referral persistence, M2-01, or unrelated feature work.

## Stop condition

If no existing durable model and service can represent support intake without corrupting domain meaning, M1-01 must stop and report the exact schema gap. This approval does not authorize a schema or migration change.

## Current behavior until implementation completes

Until M1-01 is implemented, validated, and committed, `/api/support` and the support form remain guarded, preview-only, and non-operational. No support request should be represented as persisted, queued, assigned a reference, or operational before that point.
