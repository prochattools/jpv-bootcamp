# JPV Bootcamp environment topology v1

**Status:** CURRENT ENVIRONMENT IDENTITY CONTRACT — runtime identity refreshed 2026-09-09; E1 closeout retained as historical evidence

**Evidence date:** 2026-09-09 runtime identity refresh; E1 migration evidence 2026-08-29

This document is the current environment identity contract. It records the
observed Dokploy applications, public origins, database metadata, and source
boundaries without storing credentials. The 2026-08-29 E1 closeout below is
retained as dated read-only evidence and does not authorize production release,
provider mutation, or database changes.

## Current deployed production identity — 2026-09-09

Production is live from `main` at commit/image
`d55ac6a30bcd78c63bd2a0a46db709617efc48f2`. Publish workflow `34392897174`
passed image publication, Dokploy update, deployment trigger, and root
production convergence. The live deployment-health endpoint reports
`status=live`, `deploymentEnv=production`, and the expected image tag.

No separate production migration workflow was run for this deployment, and no
migration or schema files changed relative to the previous production image.
The pre-deployment runtime refresh below remains a dated historical record.

## Pre-deployment live runtime identity refresh — 2026-09-09

Read-only probes returned HTTP 200 with `status=live` for the canonical staging
and production origins. Staging currently reports `deploymentEnv=staging` and
image tag `8b1f459fed358776fda791553ef225cc9f03b2ae`; production reports
`deploymentEnv=production` and image tag
`f93ffac7dd299c39d8daf242d6a436272cc79188`. Both responses report the `commit`
field equal to the corresponding image tag.

The preview hostname did not resolve in the same probe (`curl` HTTP `000`), so
its current DNS/routing state is unresolved. The legacy health route resolved
and returned HTTP `404`. This does not prove that preview retirement was
intentional.

This refresh supersedes the older image identifiers for runtime identity only.
It does not refresh migration-state evidence, prove that the hygiene branch is
deployed, or authorize any deployment, migration, provider, or database action.
Evidence: `docs/release/LIVE_RUNTIME_IDENTITY_REFRESH_2026-09-09.md`.

## Historical E1 final closeout — live truth at 2026-08-29

The canonical production application remains `JPV Bootcamp` /
`clients-jpv-bootcamp-app-tp9xrk` at `https://jpvbootcamp.com`. The canonical
staging authority is the existing Dokploy application
`clients-jpv-bootcamp-preview-wjfqfd` / `bZllV93NqsPZAFCsqDskb`, now verified at
`https://staging.jpvbootcamp.com` with `deploymentEnv=staging`. Its exact
deployed image and commit are
`0515b792f0aa6ab89db94f30e6176421e06546ae`.

The staging runtime is isolated on database `jpvbootcamp_staging`, schema
`jpvbootcamp`, role `jpvbootcamp_staging_app` at host `10.0.2.4:5433`. The
read-only migration plan for this exact commit and target passed with 52
Payload migrations applied and zero expected pending, unexpected, duplicate,
malformed, or ordering-anomaly records; Prisma health was true. The guarded
administrator-member backfill resolved and linked one administrator identity
without unresolved matches or a fabricated subscription.

Production remains protected and healthy at image/commit
`08605e52af4abb0b1bdcdfbe6890d010c545b636`, with `deploymentEnv=production`.
Legacy remains isolated and frozen. The preview hostname is still active with
HTTP 200 and no redirect, but currently serves that production image with
`deploymentEnv=production`; it is a stale compatibility endpoint, not staging
authority, and was not mutated by E1.

Evidence: staging deployment workflow `33234347436`; read-only migration-plan
workflow `33235046165` (artifact `9709659401`); guarded backfill workflow
`33234852975` (artifact `9709600822`). No production or legacy workflow was
dispatched by E1, and no DNS, provider, production database, or legacy database
mutation was performed.

## Canonical application identities

| Environment | Application / Dokploy slug | Dokploy application ID | Public origin | Source boundary |
| --- | --- | --- | --- | --- |
| Production | `JPV Bootcamp` / `clients-jpv-bootcamp-app-tp9xrk` | `I_2Vukga3cc3ZhaG-mUzU` | `https://jpvbootcamp.com` | `main` |
| Staging target | `JPV Bootcamp \| Staging` / `clients-jpv-bootcamp-preview-wjfqfd` | `bZllV93NqsPZAFCsqDskb` | `https://staging.jpvbootcamp.com` | `feature/*`, `fix/*`, `release/*` |
| Legacy | `JPV Bootcamp \| Legacy` / `web-public-jpv-bootcamp-l66egq` | `aPR9SvYn_JvGdMTk3CzeI` | `https://legacy.jpvbootcamp.com` | frozen legacy runtime |

The staging Dokploy slug and application ID are retained external identifiers;
the word `preview` in those identifiers does not make the preview hostname or
preview database the current staging authority.

## Historical E1 read-only live observation — 2026-08-29

The table below records the E1 checkpoint and is superseded for runtime
identity by the 2026-09-09 refresh above.

| Runtime | Observed origin and health | Observed database metadata | Classification |
| --- | --- | --- | --- |
| Production | `https://jpvbootcamp.com/api/health` returned 200; `deploymentEnv=production`; commit/image `08605e52af4abb0b1bdcdfbe6890d010c545b636` | host `10.0.2.4:5433`; database `jpvbootcamp`; schema `jpvbootcamp`; role `jpvbootcamp_staging_user` | Current production; untouched by E1 |
| Staging authority | `https://staging.jpvbootcamp.com/api/health` returned 200; `deploymentEnv=staging`; commit/image `0515b792f0aa6ab89db94f30e6176421e06546ae` | host `10.0.2.4:5433`; database `jpvbootcamp_staging`; schema `jpvbootcamp`; role `jpvbootcamp_staging_app` | Current staging authority; isolated and verified |
| Preview hostname | `https://preview.jpvbootcamp.com/api/health` returned 200 with no redirect; `deploymentEnv=production`; commit/image `08605e52af4abb0b1bdcdfbe6890d010c545b636` | Not a staging database authority; serves the production runtime | Stale compatibility endpoint; do not use for staging |
| Legacy | `https://legacy.jpvbootcamp.com/api/health` returned 404 route-not-found | host `10.0.2.4:5433`; database `jpvbootcamp_legacy`; schema `jpvbootcamp`; role `jpvbootcamp_user` | Retain and freeze; never use for current migrations |

The current state therefore has three database names on the same host:
`jpvbootcamp` is used by production, `jpvbootcamp_staging` is used by the
verified staging authority, and `jpvbootcamp_legacy` is separate and frozen.
The preview hostname remains active but is not a staging database authority; it
serves the production runtime and must not be used for staging operations.

The production role is labelled `jpvbootcamp_staging_user` in the observed
metadata. That is configuration drift, not permission to repair or rename the
role during E1.

## Historical E1 migration-state evidence — 2026-08-29

The verified staging connection was checked through the guarded staging plan
for the exact deployed SHA. It reported database `jpvbootcamp_staging`, schema
`jpvbootcamp`, 52 applied Payload migrations, no expected pending migrations,
and healthy Prisma access. The staging plan was read-only. The production and
legacy boundaries were checked separately and were not targeted by this plan.

## Historical E1 gate status — 2026-08-29

E1 is closed for the stated reconciliation scope: the staging hostname, exact
runtime identity, isolated database/schema/role, migration plan, and guarded
administrator-link backfill are verified. A6 Gate 1 may resume. Preview
retirement or repointing remains a separate, explicitly authorized routing
operation because the hostname is still active and currently serves production.

Production and legacy were not mutated. No provider, Stripe, DNS, TLS,
or production/legacy database mutation is part of this closeout. The staging
deployment and staging database changes were limited to the already-authorized
E1 staging lane and are recorded above.

## Historical evidence policy

Earlier Gate-A documents and workflow artifacts may still contain the
transitional preview hostname, the absent staging schema, or a 404 staging
origin. Those records are dated historical evidence only; the current tables
and E1 closeout above are authoritative for present topology.
