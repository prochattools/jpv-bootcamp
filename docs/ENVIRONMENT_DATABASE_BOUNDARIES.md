# JPV Bootcamp environment and database boundaries

Verified 2026-08-26 from the live Dokploy containers on the authorized host. This
document records runtime facts only; passwords and other secret values are never
stored here.

## Verified mapping

| Application | Runtime image | Database host | Database | Configured schema | Database user | Status |
| --- | --- | --- | --- | --- | --- | --- |
| JPV Bootcamp (`clients-jpv-bootcamp-app-tp9xrk`) | `ghcr.io/prochattools/jpv-bootcamp:e39bcce527617fd927303ba8e0f80861e686c75a` | `10.0.2.4:5433` | `jpvbootcamp` | `jpvbootcamp` | `jpvbootcamp_staging_user` | Named production application; authorized migration target |
| JPV Bootcamp \| Legacy (`web-public-jpv-bootcamp-l66egq`) | `ghcr.io/prochattools/jpv-bootcamp:e88cb8de015c329a64d8aa303bd36c3ff4aa3ec0-legacy` | `10.0.2.4:5433` | `jpvbootcamp_legacy` | `jpvbootcamp` | `jpvbootcamp_user` | Separate legacy database; do not use for current portal migrations |
| JPV Bootcamp \| Staging (`clients-jpv-bootcamp-preview-wjfqfd`) | `ghcr.io/prochattools/jpv-bootcamp:8388070c9ab79d0799b50adbd77329d982b3f2ef` | `10.0.2.4:5433` | `jpvbootcamp` | `jpvbootcamp_staging` | `jpvbootcamp_staging_user` | Independent preview runtime; configured schema was absent at verification time |

## Interpretation

There are two databases, not three:

- `jpvbootcamp` is shared by the named production application and the preview
  application, with different intended schemas (`jpvbootcamp` and
  `jpvbootcamp_staging`).
- `jpvbootcamp_legacy` is a separate database used by the legacy application.
- At verification time, only the `jpvbootcamp` schema was present in the
  production connection's database, and the preview connection reported that
  `jpvbootcamp_staging` did not exist. This is configuration drift that must be
  repaired before the preview runtime is treated as a usable isolated database.

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

## Post-apply evidence

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
