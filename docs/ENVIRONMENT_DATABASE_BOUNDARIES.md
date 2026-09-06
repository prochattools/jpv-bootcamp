# JPV Bootcamp environment and database boundaries

> **HISTORICAL ENVIRONMENT SNAPSHOT — 2026-08-29.** Use
> `docs/release/REPOSITORY_RECONCILIATION_CURRENT_TRUTH_2026-09-06.md` for
> current repository authority. Values below record the environment observed at
> their dated checkpoint and do not establish current staging or production
> migration state.

Verified 2026-08-29 from live staging, production, legacy, DNS, TLS, and health
evidence on the authorized host. This
document records runtime facts only; passwords and other secret values are never
stored here.

## CURRENT E1 FINAL CLOSEOUT — 2026-08-29

The following read-only evidence is current. The production application is
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
