# Staging GO Approval

- Decision ID: `staging-go`
- Current status: `PENDING`
- Depends on: `core-go-live`
- Gate tier: `STAGING_GO` (precondition for PRODUCTION_LAUNCH_GO)

## Purpose

STAGING_GO certifies that the exact release candidate SHA is running on the
isolated staging environment with correct DB/provider configuration, all
required migrations applied, and member/admin smoke passing. It does not
authorize production deployment.

## Required fields before STAGING_GO

- [ ] Release candidate SHA: `[EXACT SHA TO BE FILLED — must match deployed imageTag]`
- [ ] Deployed imageTag confirmed: `[TO BE FILLED]`
- [ ] Staging DB schema: `jpvbootcamp_staging` (isolated; no production data)
- [ ] Stripe env on staging: `test` (must not be `live`)
- [ ] Resend domain on staging: `jpvbootcamp.com` verified
- [ ] Staging domain: `preview.jpvbootcamp.com` (must not be `jpvbootcamp.com`)
- [ ] Staging DB backup path/timestamp: `[TO BE FILLED before any migration apply]`
- [ ] Rollback owner (staging): `[TO BE FILLED]`
- [ ] Rollback command: `[TO BE FILLED — e.g. redeploy imageTag X]`
- [ ] Abort threshold: `[TO BE FILLED — e.g. if smoke fails within 30min of deploy, rollback]`
- [ ] Operator responsible for staging abort decision: `[TO BE FILLED]`

## Current evidence (2026-07-21)

| Gate | Evidence |
| --- | --- |
| Local code HEAD | `80fa3a6` (current — pushed; both staging commits deployed) |
| Staging deployed imageTag | `80fa3a6` (redeployed 2026-07-21; /api/health ok, video→401, landing→200) |
| HTTP smoke (at d235c5a) | 15/15 PASS (prior deployment) |
| Browser smoke (at d235c5a) | 42/42 PASS (prior deployment; re-run pending at new SHA) |
| Stripe TEST credentials | VERIFIED (product, prices, portal, staging webhook) |
| Resend domain | VERIFIED (eu-west-1) |
| Bunny CDN | VERIFIED (library API 200) |
| Required schema migrations | PENDING — 3 unapplied |
| Rollback owner | UNFILLED |
| DB backup | UNFILLED |

## Required migrations before STAGING_GO

These must be applied with explicit authorization, backup, and rollback evidence
before STAGING_GO can be recorded:

| Migration | Classification | Blocker reason |
| --- | --- | --- |
| `20260718_103726_membership_support_schema` (Payload) | REQUIRED_NOW | Support domain tables missing; blocks support intake |
| `20260707_130000_remove_table_plan_from_payload_enums` (Payload) | REQUIRED_FOR_LEGACY_STRIPE | Maps legacy table_plan values; needed for Stripe cutover only |
| `20260707_120000_rename_account_identity_columns` (Prisma) | REQUIRED_FOR_LEGACY_STRIPE | Column rename; needed for Stripe cutover only |

## Redeploy status

Staging redeployed to `80fa3a6` on 2026-07-21. Health endpoint returns ok/live.
Browser smoke re-run (42/42) is the next required operator action before STAGING_GO.

## STAGING_GO decision

- GO: `[REQUIRES: exact SHA deployed, backup taken, rollback owner named, required migrations applied, smoke re-run at new SHA]`
- NO-GO: `Current default`
