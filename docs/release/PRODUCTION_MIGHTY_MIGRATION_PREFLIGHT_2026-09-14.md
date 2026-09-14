# Production Mighty Migration Preflight — 2026-09-14

## Scope

This record covers only the read-only preflight and its control-plane
compatibility fix. The later Phase A gate authorized only exact read-only
inspection of the three named accounts and a single Westhoek worker canary if
an eligible genuine queue row existed. It did not authorize a Prisma or Payload
migration, scheduler run, population inspection, or any provider mutation.

## Phase A result — 2026-09-14

Production revision remained `dbe0d9180e4233c5d7b58ba23554dafa5cd2333f`,
healthy, with the Mighty scheduler disabled and worker dormant.

The queue was queried in a read-only transaction using explicit columns and
exact normalized-email predicates for only:

- `westhoek@hotmail.com`
- `steve@yeshua.academy`
- `info@prochat.tools`

The result was **zero rows**. No queue row, webhook, manifest, or eligibility
state was fabricated, and the worker endpoint was not invoked. Exact Stripe and
Mighty reads were limited to those same three authorized identities; no fourth
identity or population inventory was accessed. Provider mutations, Stripe
mutations, user changes, access changes, and content changes were all zero.

Phase A terminal result: **NO SAFE GENUINE QUEUE ROW**.

The live queue-to-worker canary remains unproven and is deferred until a future
owner-authorized run has a genuine eligible Westhoek queue row. The worker must
remain dormant until then.

The production lineage inspected is:

`1b5e216ced853f61d2742c8fe9a4bd8814dd8c8b`

The control-plane fix was merged as PR #46 at:

`dbe0d9180e4233c5d7b58ba23554dafa5cd2333f`

Publish workflow `34840641941` completed successfully. Production health and
public routes passed, and `/api/health/deployment` now reports `ok: true`,
`status: live`, `deploymentEnv: production`, and the exact image tag.

## Pre-apply read-only database evidence

- Target database: `jpvbootcamp`
- Target schema: `jpvbootcamp`
- Target role: `jpvbootcamp_production_app`
- Pending Prisma migrations: exactly
  - `20260909090000_add_mighty_access_sync`
  - `20260909093000_add_mighty_event_ordering`
- Pending Payload migrations: none
- `jpvbootcamp.mighty_access_sync`: absent
- Prisma rows are applied, with no failed, in-progress, rolled-back, or
  unexpected rows.

## Protected Payload history

The historical Payload ordering anomaly remains unchanged and is governed as
an explicit production exception:

`20260826_100000_administrator_member_identity`

The SHA-256 fingerprint of the protected first 52 Payload migration rows is:

`0fdb089ae8abdeaabb7cacd8ab7452a62d266bb5038d8f470a795e4241ea3f8c`

It matches the protected baseline. The migration ledger was not rewritten.

## Control-plane fix

The deployment-health response now includes the verifier-required `status` and
`deploymentEnv` fields. The production read-only verifier explicitly reports
and accepts only these Prisma states:

- clean: no pending Prisma migrations; or
- pre-apply: exactly the two reviewed Mighty migrations pending.

Any other pending set, Payload anomaly, malformed row, duplicate, unexpected
migration, or fingerprint mismatch fails closed.

## Backup / recovery evidence

The current supported production recovery evidence is:

- Vault: `rsv-saas-infra`
- Protected item: `VM;iaasvmcontainerv2;rg-data-supabase;vm-supabase`
- Policy: `EnhancedPolicy-Supabase`
- Protection: `Protected`
- Backup-item health: `Passed`
- Recovery point ID: `8016719968922080516`
- Recovery point timestamp: `2026-09-14T03:03:21.643747Z`
- Recovery point type: `FileSystemConsistent`
- Target VM: `vm-supabase` in `rg-data-supabase`, the current production
  database host
- Integrity: Azure exposes the recovery-point type and backup-item health but
  no content checksum
- Recovery validation: protected-vault recovery-point evidence verified;
  restore rehearsal is not required by this preflight policy
- Rollback owner: `production-release-owner`

The older Rooms backup evidence is historical and was not reused.

## Post-apply result

Guarded workflow: **34844003112 — PASS**

Mighty migrations: **APPLIED — EXACTLY THE TWO REVIEWED PRISMA MIGRATIONS**

Effective Payload migrations: **ZERO**

The post-apply read-only verifier returned `VERIFIED` with state
`VERIFIED_CLEAN`. Pending Prisma and Payload migrations are zero; failed,
in-progress, rolled-back, duplicate, malformed, and unexpected migration
states are absent. The protected Payload anomaly remains exactly
`20260826_100000_administrator_member_identity` and the historical fingerprint
still matches.

The new `jpvbootcamp.mighty_access_sync` table is present with all reviewed
columns, including `last_stripe_event_created_at` and
`last_stripe_event_type`. Its primary key, unique indexes for normalized email,
Stripe customer, and Stripe subscription, due/status index, and subscription
index are present. A read-only `COUNT(*)` returned `0`; no rows were
enumerated.

No existing user/member/content table was changed by the reviewed SQL. No
Mighty or Stripe operation occurred. `MIGHTY_ACCESS_SYNC_ENABLED=false`, the
Mighty scheduler is disabled, the worker is dormant, and public health/legal
routes remained healthy.

Production preflight: **PASS — VERIFIED_CLEAN**

Next gate: **three-account queue inspection and bounded Westhoek worker canary,
under a separate owner authorization**
