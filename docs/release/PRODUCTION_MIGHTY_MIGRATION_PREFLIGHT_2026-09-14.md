# Production Mighty Migration Preflight — 2026-09-14

## Scope

This record covers only the read-only preflight and its control-plane
compatibility fix. It does not authorize or perform a Prisma migration,
Payload migration, provider operation, worker execution, or scheduler run.

The production lineage inspected is:

`1b5e216ced853f61d2742c8fe9a4bd8814dd8c8b`

## Read-only database evidence

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

## Backup boundary

The older Rooms backup evidence is historical and is not reused for this
migration window. Current production backup/snapshot evidence, integrity
information where supported, and rollback ownership must be recorded before a
separate migration-apply goal can be authorized.

## Current decision

Mighty migrations: **NOT APPLIED**

Production preflight: **BLOCKED PENDING CURRENT BACKUP/RECOVERY EVIDENCE**

Next gate: **separate guarded apply of exactly the two Mighty Prisma
migrations, after backup evidence is recorded**
