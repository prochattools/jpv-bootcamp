# JPV Mighty zero-touch migration operator runbook

## Status

`ZERO-TOUCH MIGRATION OPERATIONS READINESS: PASS`

`STRIPE→MIGHTY LIFECYCLE READINESS: DEPLOYED INERTLY`
`RC SOURCE: 5dcba90c2fe43beaa0ed41dc9a4f1efe7a46d930`
`PRODUCTION MERGE: b00f212e6dd456dff60a7465d6458d1705b68932`
`SCHEDULER: DISABLED`
`WORKER: DORMANT`
`REAL MEMBER MIGRATION: NOT AUTHORIZED`

The lifecycle control path remains inert in production at
`b00f212e6dd456dff60a7465d6458d1705b68932`. The ordinary production scope is
opt-in only: it requires the existing mutation guard plus
`MIGHTY_ACCESS_SYNC_PRODUCTION_SCOPE=ordinary-lifecycle-v1`, stored Stripe
customer/subscription IDs, and the latest Stripe event identity. New Mighty
member creation additionally requires `MIGHTY_ALLOW_NEW_MEMBER_CREATION=true`.
These controls are not enabled or changed by this readiness work.

Privileged provider roles (`host`, `owner`, `admin`, `administrator`, and
`staff`) are protected from ordinary billing grants and revokes. Unknown roles,
missing identity proof, and provider uncertainty fail closed. Discounted,
100%-coupon, `no_payment_required`, and trialing subscriptions use the same
Stripe subscription truth as full-price subscriptions; payment failure is
`DENIED` immediately and a confirmed payment restores the same Mighty member.
The new-member email points only to Mighty sign-in and does not expose the old
JPV password-reset onboarding path. Payment-failure notices state that access
is paused and use the hosted Stripe invoice recovery URL when available.

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
