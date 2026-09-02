# JPV Bootcamp environment topology v1

> **Current-state pointer (2026-09-02):** The repository clean-baseline record
> at `docs/release/REPOSITORY_CLEAN_BASELINE_2026-09-02.md` supersedes the
> dated live SHA and migration snapshots below. Those entries remain audit
> history and are not current deployment instructions.

**Status:** E1 final closeout complete — staging authority verified; ready to resume A6 Gate 1

**Evidence date:** 2026-08-29

This document is the current environment identity contract. It records the
observed Dokploy applications, public origins, database metadata, and source
boundaries without storing credentials. The E1 closeout below is read-only
evidence and does not authorize production release, provider mutation, or
database changes.

## E1 final closeout — current live truth

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

## Read-only live observation

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

## Migration-state evidence

The verified staging connection was checked through the guarded staging plan
for the exact deployed SHA. It reported database `jpvbootcamp_staging`, schema
`jpvbootcamp`, 52 applied Payload migrations, no expected pending migrations,
and healthy Prisma access. The staging plan was read-only. The production and
legacy boundaries were checked separately and were not targeted by this plan.

## Gate status

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
