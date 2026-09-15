# JPV Mighty zero-touch migration operator runbook

## Exact-email identity binding hardening — 2026-09-15

Production is currently `ca8f1b6516994a72187e13eb1f780e1cb6566c5d` and remains
`DEPLOYED + HARDENED + INERT`. The one authorized diagnostic for
`westhoek@hotmail.com` used only the exact `by_email` endpoint and returned the
known member ID `41580317` with an empty `email` field. Classify this as
provider identity ambiguity (`B`), not as an email match.

The runtime identity contract is fail-closed. A returned member is accepted
only when `normalizeEmail(returned.email)` equals the exact expected email.
Missing, null, empty, or different email values produce
`mighty_member_email_conflict`. This assertion applies to exact lookup,
creation responses, 422 recovery, restore/recovery, cutover manifest input,
reconciliation classification, grant, revoke, and finalization paths. A stored
member ID or exact lookup request cannot mask an email conflict. No broad
member search is an allowed fallback.

The provider's empty email response is not treated as proof of identity. Stop
and review before any Plan read, bootstrap, worker, canary retry, or provider
data correction. This diagnostic did not read Plans, Spaces, or purchases and
performed no provider or Stripe mutation.

## Phase A bootstrap runtime release candidate — 2026-09-14

The current production lineage is
`b1e105d3ac855f20a983fb70bcefffb2490c864f`; the provenance migration is already
applied and the read-only verifier is `VERIFIED_CLEAN`. The non-production
branch `codex/mighty-phase-a-bootstrap-runtime-rc-v2` contains a bounded,
synthetically validated bootstrap route for the single authorized operator
identity `westhoek@hotmail.com`. It performs exact local Stripe identity and
subscription checks, queues `operator_bootstrap` state with observation time,
and never calls Mighty or email. Provider I/O remains worker-only.

This RC is not deployed. Do not invoke the bootstrap route, worker, scheduler,
or any live rehearsal script. No live Stripe/Mighty access, population
inspection, real manifest creation, migration, or user/data change is permitted
by this release-candidate review.

## Status

`ZERO-TOUCH MIGRATION OPERATIONS READINESS: PASS`

Production is running hardened inert code at
`1555bab05df64a173737080f0b6988a6789434a4`. This runbook describes a future
owner-authorized operation only. It is not authorization to inspect, enumerate,
reconcile, or migrate real members.

## Preconditions

Before any future run, the operator must confirm all of the following in a
sanitized system-level record:

- production is the expected revision and remains `DEPLOYED + HARDENED + INERT`;
- the scheduler is disabled and no worker, cutover, migration, or reconciliation
  execution is active;
- the target Plan is exactly `2000039` (`JPV Member Access`);
- the approved manifest is non-empty, bounded, canonical, and immutable;
- the requested batch size is the exact approved batch size and is between 1
  and the approved maximum of 50;
- the run uses the authenticated worker path and an explicit run request;
- no population-discovery or broad-list operation is part of the run.

If any precondition is unknown, stop and review. Do not infer a value from
provider state or continue best-effort.

## Owner authorization and manifest approval

The owner authorization must identify an authorization ID, the exact manifest
SHA-256, target Plan `2000039`, exact batch size, and whether the request is a
dry run or apply. The worker authentication result must be true. Apply mode
also requires the explicit production-execution flag; deployment, scheduler
state, a webhook, or the mere presence of a manifest never substitutes for
owner authorization.

The manifest contract is `mighty-jpv-v1`. Each row contains only:

- canonical identity and normalized email;
- Stripe entitlement and an immutable input reference;
- expected Mighty member ID when known;
- current and desired target-Plan access state;
- target Plan ID;
- privilege and overlap classifications;
- immutable source metadata.

The manifest hash is computed over the canonical version, Plan, batch size, and
rows. Any row, order, Plan, batch, source, or entitlement change produces a
different hash and invalidates approval. Never silently regenerate approval.

Rows with ambiguous identity, privilege, overlap, entitlement, member ID, or
provider state are review-only and cannot enter apply mode.

## Production freeze and start invocation

The future operator must record the freeze check, authorization ID, manifest
hash, target Plan, batch size, worker-authenticated result, and dry-run/apply
mode before invoking the worker. The invocation must carry the exact approved
values. A missing or mismatched value returns `STOP / NO MUTATION`.

No startup hook, Stripe webhook, scheduler tick, or automatic worker start may
invoke this procedure. The runner consumes explicitly supplied manifest rows;
it never discovers a population or calls a broad member-list endpoint.

## Checkpoints, expected output, and resume

Persist one checkpoint per normalized identity with status, provider member ID,
last error, and timestamp. Checkpoint identity is authoritative when a new
member was created during an interrupted run. On resume, reuse that exact ID;
never call `createMember` again for the same checkpoint.

Expected successful output is a sanitized audit record containing only the
manifest version/hash, authorization ID, target Plan, batch size, row count,
mode, and mutation outcome. Do not log emails, tokens, provider responses,
population lists, or unrelated identities.

## Entitlement and access procedure

Before every provider mutation, re-check the current authoritative Stripe
entitlement. If it differs from the manifest decision, stop with
`REVIEW_REQUIRED` and do not grant or revoke. The synthetic planner represents
the only permitted actions:

- `ALLOWED` + target Plan absent: grant the target Plan only;
- `ALLOWED` + target Plan present: no-op;
- `DENIED` + target Plan present: revoke the target Plan only;
- `DENIED` + target Plan absent: no-op.

Privilege, direct-Space, other-Plan, purchase, identity, or access overlap is
not generic rollback material. It is a review state. Unrelated access must be
preserved.

## Stop conditions and REVIEW_REQUIRED procedure

Stop immediately and record a sanitized review checkpoint for:

- missing or changed owner authorization, manifest hash, Plan, batch, or worker
  authentication;
- empty, malformed, duplicate, or changed manifest;
- missing or mismatched entitlement;
- identity ambiguity or changed provider member ID;
- Host, admin, staff, unknown privilege, or overlap classification;
- unexpected Plan/member state;
- provider 400, 401, 403, 404, 422, 429, 500, timeout, connection reset,
  malformed, partial, or uncertain results;
- verification failure or checkpoint corruption.

On uncertainty: stop, preserve the potentially valid access and provider member
identity, reconcile the exact row, then obtain a new explicit authorization if
the approved manifest or action must change. Never perform a generic Plan
removal as rollback and never continue to the next row after an unexplained
provider result.

## Dry run and completion

Dry run may produce intended actions, blockers, and review reasons, but performs
zero provider mutations. It must use synthetic or separately approved manifest
fixtures; a real-population dry run is not authorized by this document.

Completion requires every selected row to be `COMPLETE` or an explicit review
record, a sanitized audit record, and an owner decision for any review state.
No row after a stop point may be implicitly continued. A future migration is
not complete merely because the process exits successfully.

## Recovery boundary

Application rollback is a code-revision operation only. Provider recovery is a
separate, exact-row reconciliation procedure. Do not combine code rollback,
Plan revocation, member deletion, Stripe mutation, or population cleanup into a
single response. Pre-existing data may not be deleted by the operator.

## Current gate

`LIVE MEMBER POPULATION: NOT INSPECTED`

`REAL MIGRATION MANIFEST: NOT CREATED`

`MIGHTY AUTOMATION: DISABLED`

`REAL MEMBER MIGRATION: NOT AUTHORIZED`

**Next gate:** wait for a new owner decision authorizing a strictly bounded
real migration-preparation phase with exact identities, operation, environment,
batch, and time window.
