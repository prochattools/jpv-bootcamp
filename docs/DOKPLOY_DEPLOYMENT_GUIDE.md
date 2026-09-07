# Dokploy Deployment Guide — Historical Reference

> **NON-OPERATIVE HISTORICAL DOCUMENT.** Do not use commands, target mappings,
> secret names, provider configuration, SSH procedures, or deployment claims
> from older revisions of this file. They described a July 2026 preview-era
> topology and can target the current production application incorrectly.
>
> Current release authority is
> `docs/release/REPOSITORY_RECONCILIATION_CURRENT_TRUTH_2026-09-06.md` and
> `docs/release/REPOSITORY_RECONCILIATION_IMPLEMENTATION_PLAN_2026-09-06.md`.
> Deployment must use the checked-in guarded GitHub workflows below.

## Current deployment authority — 2026-09-07

| Environment | Runtime authority | Dokploy target | Guarded workflow |
| --- | --- | --- | --- |
| Staging | `https://staging.jpvbootcamp.com` | `clients-jpv-bootcamp-preview-wjfqfd` / `bZllV93NqsPZAFCsqDskb` | `.github/workflows/deploy-preview.yml` |
| Production | `https://jpvbootcamp.com` | `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU` | `.github/workflows/publish-root-domain-image.yml` |

Staging accepts only approved `feature/*`, `fix/*`, or `release/*` source refs;
`main` is denied by the staging workflow. Production is bound to protected
`main`; manual publication additionally requires the exact full SHA and the
workflow confirmation value.

The production image workflow builds and publishes an immutable
`ghcr.io/${repository}:${github.sha}` image, updates only the production Dokploy
application, triggers deployment, and waits for exact runtime convergence.
Environment-variable mutation is not part of that deployment lane.

The separate `.github/workflows/production-prisma-migrations.yml` workflow is a
database-mutation lane. It is not part of ordinary application deployment and
must not be run unless fresh read-only migration evidence demonstrates a pending
migration and the migration operation is separately justified.

For the repository-reconciliation release, staging promotion must use this
sequence for one exact candidate SHA:

1. `read-only-migration-plan` — require the expected migration inventory,
   `0` pending migrations, zero anomalies, and healthy Prisma access.
2. `deploy-preview` — require `/api/health` to report the exact candidate SHA
   with `deploymentEnv=staging`.
3. `authenticated-acceptance` — require the complete required acceptance matrix
   to pass.
4. Only after those checks pass may the same reviewed candidate be integrated
   into protected `main` and published through
   `.github/workflows/publish-root-domain-image.yml`.

Do not substitute direct SSH, Docker Swarm commands, ad-hoc Dokploy API calls,
provider edits, environment changes, migration apply, bootstrap, backfill, seed,
billing, credential, or DNS changes for these guarded lanes.

## Historical provenance — 2026-07-20

Older revisions of this document recorded a preview deployment at
`preview.jpvbootcamp.com`, local AMD64 image builds, direct Dokploy provider
updates, and Docker Swarm deployment over SSH. That topology and procedure are
retained only as provenance; they are superseded and must not be executed.

The dated evidence recorded at that checkpoint included:

- source branch `feature/course-branding-and-preview` at `a77ecc9`;
- deployed image SHA `de1e9c68ba18bc6d1b08894145f69d4ff555c75b`;
- GHCR AMD64 digest
  `sha256:ce47b0cbb54dd6d461e7238cf1e72e05d13950837d3ce0895a10dc7182247a71`;
- health route returning HTTP 200 with that image tag;
- unauthenticated Bunny video route returning HTTP 401;
- invalid Bunny webhook signature returning HTTP 403;
- 40/40 smoke checks and the then-scoped focused E2E verification passing;
- migration `20260720_000000_locked_docs_rels_new_collections` covering missing
  locked-document relation columns at that historical checkpoint.

None of those historical hostnames, image tags, procedures, or validation counts
establish current staging or production state.
