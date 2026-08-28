# JPV Bootcamp environment topology v1

**Status:** E1 Gate A — read-only topology reconciliation; `E1 BLOCKED`

**Evidence date:** 2026-08-28

This document is the current environment identity contract. It records the
observed Dokploy applications, public origins, database metadata, and source
boundaries without storing credentials. It does not authorize database repair,
migration execution, Dokploy mutation, DNS/TLS changes, provider changes, or
deployment.

## Canonical application identities

| Environment | Application / Dokploy slug | Dokploy application ID | Public origin | Source boundary |
| --- | --- | --- | --- | --- |
| Production | `JPV Bootcamp` / `clients-jpv-bootcamp-app-tp9xrk` | `I_2Vukga3cc3ZhaG-mUzU` | `https://jpvbootcamp.com` | `main` |
| Staging target | `JPV Bootcamp \| Staging` / `clients-jpv-bootcamp-preview-wjfqfd` | `bZllV93NqsPZAFCsqDskb` | `https://staging.jpvbootcamp.com` | `feature/*`, `fix/*`, `release/*` |
| Legacy | `JPV Bootcamp \| Legacy` / `web-public-jpv-bootcamp-l66egq` | `aPR9SvYn_JvGdMTk3CzeI` | `https://legacy.jpvbootcamp.com` | frozen legacy runtime |

The staging Dokploy slug and application ID are retained external identifiers;
the word `preview` in those identifiers does not make the preview hostname or
preview database the current staging authority.

## Read-only live observation

| Runtime | Observed origin and health | Observed database metadata | Classification |
| --- | --- | --- | --- |
| Production | `https://jpvbootcamp.com/api/health` returned 200; `deploymentEnv=production`; commit/image `08605e52af4abb0b1bdcdfbe6890d010c545b636` | host `10.0.2.4:5433`; database `jpvbootcamp`; schema `jpvbootcamp`; role `jpvbootcamp_staging_user` | Current production; untouched by E1 |
| Current non-production runtime | `https://preview.jpvbootcamp.com/api/health` returned 200; `deploymentEnv=preview`; commit/image `8388070c9ab79d0799b50adbd77329d982b3f2ef` | host `10.0.2.4:5433`; database `jpvbootcamp_preview`; schema `jpvbootcamp_staging`; role `jpvbootcamp_staging_user` | Transitional staging runtime; not the intended public staging identity |
| Intended staging origin | `https://staging.jpvbootcamp.com/api/health` returned 404 non-JSON | Target database is not proven provisioned by this gate | Required Gate B repair and verification |
| Legacy | `https://legacy.jpvbootcamp.com/api/health` returned 404 route-not-found | host `10.0.2.4:5433`; database `jpvbootcamp_legacy`; schema `jpvbootcamp`; role `jpvbootcamp_user` | Retain and freeze; never use for current migrations |

The observed state therefore has three database names on the same host: the
production database, a transitional preview database, and a separate legacy
database. This does not prove that the intended future staging database has
been created. The desired E1 architecture is a separately named
`jpvbootcamp_staging` database with schema `jpvbootcamp`; if infrastructure
inspection shows that a same-database schema is safer, that exception must be
explicitly recorded and guarded before Gate B.

The production role is labelled `jpvbootcamp_staging_user` in the observed
metadata. That is configuration drift, not permission to repair or rename the
role during E1.

## Migration-state evidence

The current transitional staging connection was queried read-only with a
transaction, a five-second timeout, and rollback. Schema
`jpvbootcamp_staging` exists there with role USAGE. It contains 46 Payload
migration rows and 26 Prisma migration rows.

The repository registers 52 Payload migrations and the current database is
missing these six registered Payload migrations:

- `20260826_090000_payment_action_required_status`
- `20260826_100000_administrator_member_identity`
- `20260826_120000_billing_pause_actions`
- `20260826_130000_portal_engagement_distribution`
- `20260826_150000_member_delete_relationship_safety`
- `20260827_090000_membership_support_relationship_tables`

The repository also registers Prisma migrations that are not present in the
observed applied-state evidence, including:

- `20260826_100000_add_support_request_phone`
- `20260827090000_align_sponsored_seat_lifecycle`

No migration was applied. The mismatch is an E1 blocker because the current
runtime/database pair cannot be promoted to the intended staging authority
without a reviewed repair and a fresh exact-SHA plan.

## Gate status

E1 Gate A is blocked by the live preview hostname still serving the transitional
runtime, the intended staging hostname returning 404, and the migration-state
mismatch above. Gate B must separately authorize and verify database/schema/role
provisioning, Dokploy environment values, staging domain/TLS routing, migration
reconciliation, and staging acceptance before any release action.

Production and legacy were not mutated. No provider, Stripe, DNS, TLS,
database, migration, merge, push, or deployment action is part of this gate.
