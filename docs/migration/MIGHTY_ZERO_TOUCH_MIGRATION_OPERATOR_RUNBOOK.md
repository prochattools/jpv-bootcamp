# JPV Mighty zero-touch migration operator runbook

## Controlled real-population preparation — read-only manifest complete — 2026-09-15

Production revision `03b78c550d09d5b155ddaf68b826869dc64973bb` remained healthy,
`VERIFIED_CLEAN`, and scheduler-disabled. The owner-authorized preparation used
the active canonical `customer_provisioning` projection only: 9 candidates from
13 records, unique normalized identities, and exact stored Stripe customer and
subscription IDs. It performed exact Stripe reads only and exact Mighty
`by_email`/minimum-state reads only. Provider population enumeration was not
used.

The immutable manifest is `mighty-jpv-v1`, target Plan `2000039`, SHA-256
`2103d5eb95a045c053d57502492969056ae8eee63eed4989719c1d4596755974`. Two
generations from the frozen evidence produced the same canonical serialization
and hash. Local owner-review artifacts are outside Git at
`/private/tmp/jpv-mighty-population-prep-20260915/`.

Counts: 6 Stripe `ALLOWED`, 0 Stripe `DENIED`, 3 Stripe review; actions are
`MIGRATE_EXISTING=0`, `ALREADY_PLAN_CONTROLLED=0`,
`CREATE_NEW_AT_CUTOVER=2`, `PRIVILEGED_EXCLUDED=1`,
`OVERLAP_REVIEW_REQUIRED=0`, `IDENTITY_REVIEW_REQUIRED=6`, `NO_ACTION=0`,
`BLOCKED=0`. The proposed first batch is empty because no row satisfies every
clean ordinary existing-member condition. New-member creation and all review
rows require separate owner decisions.

This preparation performed zero Stripe mutations and zero Mighty mutations.
Do not run the worker, grant/revoke Plans, create members, enable the scheduler,
or execute cutover until the owner approves the manifest, exceptions, and a
non-empty bounded first batch.

## Phase A Westhoek canary — complete with accepted idempotent replay — 2026-09-15

The owner-authorized canary used only `westhoek@hotmail.com`, Mighty member
`41580317`, and target Plan `2000039` on production revision
`03b78c550d09d5b155ddaf68b826869dc64973bb`. Production remained healthy,
`VERIFIED_CLEAN`, and scheduler-disabled.

Two bootstrap HTTP attempts occurred. The first response stdout was lost after
shell command substitution, but the durable row proves creation. The second
attempt returned HTTP 200 with `duplicate_operator_bootstrap` and
`queued=false`. The owner accepted this as an idempotent replay; no third
bootstrap was attempted. Exactly one durable row existed, with
`stateSource=operator_bootstrap`, desired access `ALLOWED`,
`welcomeRequired=false`, the stored exact Stripe IDs, an observation time,
`syncStatus=pending` before the worker, and no event or lease fields.

Fresh live Stripe reads matched the stored customer/subscription IDs, exact
email, live mode, and active subscription. Exact Mighty `by_email` evidence
bound member `41580317`; Plan `2000039` was already present and effective.
Exactly one worker invocation used `limit=1` and the exact Westhoek email. It
returned `processed=1`, `succeeded=1`, `failed=0`, `superseded=0`. The final
row was `succeeded` on member `41580317`; Plan access remained effective and
all Mighty mutations, welcome email, and unrelated-identity changes were
zero.

`PHASE A — WESTHOEK LIVE END-TO-END CANARY: PASS WITH ACCEPTED IDEMPOTENT
BOOTSTRAP REPLAY`

This is not authorization for population inspection, reconciliation, or real
member migration. The next gate is controlled real-population preparation and
requires a new explicit owner authorization.

## Exact-lookup identity binding V2 — deployed inertly — 2026-09-15

Production was `4d1dd2fc867258ecde6b194b1ecb57a29592977f` and is now
`03b78c550d09d5b155ddaf68b826869dc64973bb`, remaining
`DEPLOYED + HARDENED + IDENTITY-BINDING FAIL-CLOSED + INERT`. The authorized
diagnostic for
`westhoek@hotmail.com` used only the exact `by_email` endpoint and returned the
known member ID `41580317` with an empty `email` field. Classify this as
provider email masking (`B`), then bind it only through explicit
`exact_by_email_lookup` evidence.

The runtime identity contract has two explicit sources: `provider_email_match`
for a non-empty matching provider email, and `exact_by_email_lookup` for a
member returned by the exact normalized `by_email` request. A masked email is
accepted only with the latter evidence bound to the same normalized request.
Arbitrary empty/missing email objects still produce
`mighty_member_email_conflict`; different non-empty emails do too. Create and
422 recovery paths perform exact post-create/recovery lookup and require the
same member ID. Cutover apply rechecks exact lookup identity against the
locked manifest ID before any Plan mutation. No broad member search is an
allowed fallback.

No provider email is fabricated or rewritten. The provider payload remains
masked/absent while the separate identity evidence records the exact lookup
source. Stop and review before any Plan read, bootstrap, worker, canary retry,
or provider data correction. This goal has not read Plans, Spaces, or
purchases and has performed no provider or Stripe mutation.

The V2 release candidate was `codex/mighty-exact-lookup-identity-binding-v2` at
`734900e46df052a302dca3527ab4369ff0f411de`, merged as
`03b78c550d09d5b155ddaf68b826869dc64973bb`, and deployed through the protected
root-domain workflow. Health and read-only migration verification passed; the
Mighty scheduler remains disabled and the worker/bootstrap remain dormant.
The one authorized post-deploy exact lookup returned ID `41580317` with an
empty/masked provider email and valid exact-lookup evidence. No Plan, Space,
purchase, Stripe, bootstrap, worker, or provider mutation operation was
performed. Stop before the fresh Westhoek canary.

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
