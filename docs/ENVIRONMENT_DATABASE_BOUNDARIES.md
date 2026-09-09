# JPV Bootcamp environment and database boundaries

Verified through 2026-09-09. The latest full staging/production/legacy topology
inventory is the 2026-08-29 E1 closeout below; the latest production migration
status is the guarded read-only verification recorded here. A 2026-09-09
read-only health probe refreshed the live runtime identities below. This document
records runtime facts only; passwords and other secret values are never stored
here.

## CURRENT DEPLOYED PRODUCTION STATE — 2026-09-09

Production is live from `main` at commit/image
`a287800735d465a41ad9e45d2c7914ab9cc34a26`. Publish workflow `34398931497`
passed image publication, Dokploy update, deployment trigger, and root
production convergence. The live deployment-health endpoint reports
`status=live`, `deploymentEnv=production`, and the expected image tag.

No separate production migration workflow was run for this deployment, and no
migration or schema files changed relative to the previous production image.
The migration-status and runtime-refresh records below are retained as
pre-deployment evidence with their original timestamps and identities.

## PRE-DEPLOYMENT PRODUCTION MIGRATION STATUS — 2026-09-07

GitHub Actions run `34147184195` completed the guarded production migration
status control successfully. It verified the serving production revision as
`f93ffac7dd299c39d8daf242d6a436272cc79188`, with Payload and Prisma expected
migration sets fully applied, pending `[]`, unexpected `[]`, duplicate `[]`, and
zero malformed Payload rows. The control reported `mutationPerformed=false`,
`readOnlyTransaction=true`, `action=none`, and no blockers. The guarded apply
path was skipped, so this verification did not mutate production data or schema.

The production Payload ledger contains exactly one protected historical ordering
anomaly: `20260826_100000_administrator_member_identity`. The verifier accepts
that condition only when the anomaly list matches the protected constant exactly
and the observed historical baseline SHA-256 equals
`0fdb089ae8abdeaabb7cacd8ab7452a62d266bb5038d8f470a795e4241ea3f8c`. A new
anomaly, a changed anomaly set, or a changed historical prefix fails closed. The
historical row ordering must therefore not be rewritten merely to make the
ledger appear sequential.

A fresh post-run production health probe returned `commit=f93ffac7dd299c39d8daf242d6a436272cc79188`
and `imageTag=f93ffac7dd299c39d8daf242d6a436272cc79188`, so the live revision
evidence was unchanged by the status run. No production migration is currently
required.

## PRE-DEPLOYMENT LIVE RUNTIME IDENTITY REFRESH — 2026-09-09

Read-only probes returned `status=live` and HTTP 200 for both current origins.
Staging reported `deploymentEnv=staging` and
`imageTag=8b1f459fed358776fda791553ef225cc9f03b2ae`; production reported
`deploymentEnv=production` and
`imageTag=f93ffac7dd299c39d8daf242d6a436272cc79188`. Both responses reported
the `commit` field equal to the corresponding image tag.

The preview hostname did not resolve in the same probe (`curl` HTTP `000`), so
its current DNS/routing state is unresolved. The legacy health route resolved
and returned HTTP `404`. Neither observation proves that a routing retirement
was intentional.

This refresh establishes current HTTP/runtime identity only. It does not assert
current migration state, prove that the production-hygiene branch is deployed,
or authorize a deployment, migration, provider mutation, or database change.
Evidence: `docs/release/LIVE_RUNTIME_IDENTITY_REFRESH_2026-09-09.md`.

## LATEST FULL TOPOLOGY CLOSEOUT — 2026-08-29

The following read-only evidence was current at the 2026-08-29 closeout. The production application is
`clients-jpv-bootcamp-app-tp9xrk` at `https://jpvbootcamp.com`. The staging
authority is `clients-jpv-bootcamp-preview-wjfqfd` at
`https://staging.jpvbootcamp.com`, deployed with
`deploymentEnv=staging` at commit/image
`0515b792f0aa6ab89db94f30e6176421e06546ae`. The preview hostname remains
active, but is not staging authority: it serves the production runtime at
commit/image `08605e52af4abb0b1bdcdfbe6890d010c545b636` with
`deploymentEnv=production` and no redirect.

| Runtime | Database host | Database | Schema | Role | Current classification |
| --- | --- | --- | --- | --- | --- |
| Production | `10.0.2.4:5433` | `jpvbootcamp` | `jpvbootcamp` | `jpvbootcamp_staging_user` | Current production; protected |
| Staging | `10.0.2.4:5433` | `jpvbootcamp_staging` | `jpvbootcamp` | `jpvbootcamp_staging_app` | Current staging authority; isolated and verified |
| Legacy | `10.0.2.4:5433` | `jpvbootcamp_legacy` | `jpvbootcamp` | `jpvbootcamp_user` | Frozen legacy; never a current migration target |

The live host therefore exposes three database names on one database server:
`jpvbootcamp` for production, `jpvbootcamp_staging` for staging, and
`jpvbootcamp_legacy` for the frozen legacy application. The production role
name `jpvbootcamp_staging_user` remains recorded configuration drift; no role
repair was performed by E1.

The exact-SHA staging migration plan was read-only and passed with 52 Payload
migrations applied, zero expected pending migrations, no unexpected, duplicate,
malformed, or ordering-anomaly records, and healthy Prisma access. The guarded
administrator-member backfill resolved and linked one administrator identity
without unresolved matches or a fabricated subscription. See
`docs/architecture/JPV_ENVIRONMENT_TOPOLOGY_V1.md` and
`docs/architecture/JPV_PREVIEW_TO_STAGING_INVENTORY.md` for the full inventory.

No production or legacy database mutation was performed by E1. Staging-only
deployment, migration, and guarded backfill actions are recorded in the release
evidence and remain outside the production and legacy boundaries.

## Historical checkpoints (retained; not current live truth)

## Historical verified mapping

| Application | Runtime image | Database host | Database | Configured schema | Database user | Status |
| --- | --- | --- | --- | --- | --- | --- |
| JPV Bootcamp (`clients-jpv-bootcamp-app-tp9xrk`) | `ghcr.io/prochattools/jpv-bootcamp:e39bcce527617fd927303ba8e0f80861e686c75a` | `10.0.2.4:5433` | `jpvbootcamp` | `jpvbootcamp` | `jpvbootcamp_staging_user` | Named production application; authorized migration target |
| JPV Bootcamp \| Legacy (`web-public-jpv-bootcamp-l66egq`) | `ghcr.io/prochattools/jpv-bootcamp:e88cb8de015c329a64d8aa303bd36c3ff4aa3ec0-legacy` | `10.0.2.4:5433` | `jpvbootcamp_legacy` | `jpvbootcamp` | `jpvbootcamp_user` | Separate legacy database; do not use for current portal migrations |
| JPV Bootcamp \| Staging (`clients-jpv-bootcamp-preview-wjfqfd`) | `ghcr.io/prochattools/jpv-bootcamp:8388070c9ab79d0799b50adbd77329d982b3f2ef` | `10.0.2.4:5433` | `jpvbootcamp` | `jpvbootcamp_staging` | `jpvbootcamp_staging_user` | Transitional preview runtime; configured schema was absent at verification time |

## Interpretation

There are two observed databases, not three:

- `jpvbootcamp` is shared by the named production application and the preview
  application, with production using `jpvbootcamp` and the preview configured
  for the absent `jpvbootcamp_staging` schema.
- `jpvbootcamp_legacy` is a separate database used by the legacy application.
- At verification time, only the `jpvbootcamp` schema was present in the
  shared database's visible schema inventory, and the preview connection
  reported that `jpvbootcamp_staging` did not exist. This is configuration drift
  that must be repaired before the preview runtime is treated as a usable
  isolated database.

## Migration safety rules

1. A migration against the named production application must verify all of:
   application/container identity, database host `10.0.2.4:5433`, database
   `jpvbootcamp`, schema `jpvbootcamp`, and user `jpvbootcamp_staging_user`.
2. Never infer the target from an image tag, a hostname, or an application label
   alone. Read and validate the runtime `DATABASE_URL` metadata first.
3. Never run current portal migrations against `jpvbootcamp_legacy`.
4. Never treat the preview runtime as isolated until its configured schema exists
   and its migration state has been independently verified.
5. The repository's generic staging migration wrapper intentionally requires the
   schema name `jpvbootcamp_staging`. The named production application currently
   has a different, explicitly verified schema, so production-targeted operations
   must use a separate fail-closed operator guard and must not weaken that wrapper.

## Evidence boundary

Before the authorized operation, the production application had 49 Payload
migration records, ending at `20260826_130000_portal_engagement_distribution`.
The administrator identity migration and its two target columns were absent. The
legacy database had only its initial Payload migration record. The preview
connection could not find its configured schema.

## Historical post-apply evidence

The explicitly authorized operation then applied
`20260826_100000_administrator_member_identity` to the named production
application's actual configured target (`jpvbootcamp.jpvbootcamp`) as Payload
batch 18. The guarded backfill found exactly one existing member and one profile
for each administrator and linked them without creating duplicates:

| Payload administrator | Portal member | Administrator flag | Portal profile |
| --- | ---: | --- | ---: |
| `info@prochat.tools` | 13 | `true` | 13 |
| `westhoek@hotmail.com` | 11 | `true` | 11 |

No rows were written to `jpvbootcamp_legacy`, and no row was written to the
non-existent `jpvbootcamp_staging` schema.
