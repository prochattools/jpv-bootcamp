# Preview-to-staging inventory

**Status:** E1 final closeout — staging authority verified; preview compatibility
state classified; no preview retirement performed

**Evidence date:** 2026-08-29

This inventory prevents a retained `preview` string from being mistaken for a
live environment authority. Current staging behavior uses
`https://staging.jpvbootcamp.com`; historical evidence and external immutable
identifiers remain labelled below. E1 verified staging without retiring the
still-active preview hostname.

## E1 final closeout — 2026-08-29

The staging application `clients-jpv-bootcamp-preview-wjfqfd` /
`bZllV93NqsPZAFCsqDskb` is now live at `https://staging.jpvbootcamp.com` with
`deploymentEnv=staging` and image/commit
`0515b792f0aa6ab89db94f30e6176421e06546ae`. Its target is database
`jpvbootcamp_staging`, schema `jpvbootcamp`, role
`jpvbootcamp_staging_app`. The exact-SHA read-only plan passed with 52 Payload
migrations applied, zero expected pending migrations, no unexpected,
duplicate, malformed, or ordering-anomaly records, and healthy Prisma access.
The guarded administrator-member backfill resolved and linked one identity.

`https://preview.jpvbootcamp.com` remains HTTP 200 with no redirect, but serves
the production image/commit
`08605e52af4abb0b1bdcdfbe6890d010c545b636` with `deploymentEnv=production`.
It is therefore a stale compatibility endpoint, not staging authority. No DNS,
provider, preview, production, or legacy mutation was performed by this
closeout.

## Runtime and provider inventory

| Reference | Classification | E1 disposition |
| --- | --- | --- |
| `https://jpvbootcamp.com` | Current production origin | Canonical production; protected |
| `https://preview.jpvbootcamp.com` | Active stale compatibility endpoint | HTTP 200 with production runtime; not staging authority; retirement/repointing remains separately authorized |
| `https://staging.jpvbootcamp.com` | Current staging origin | Canonical staging authority; HTTP 200, exact staging SHA, `deploymentEnv=staging` |
| `https://legacy.jpvbootcamp.com` | Legacy origin | Frozen and retained; no current staging or production authority |
| `clients-jpv-bootcamp-preview-wjfqfd` | Dokploy application slug | External immutable identifier for the staging application; retain and document |
| `bZllV93NqsPZAFCsqDskb` | Dokploy application ID | External immutable identifier for the staging application; retain and document |
| `DOKPLOY_PREVIEW_APP_ID` | GitHub/Dokploy secret name | Existing external secret name; retain until a separately authorized secret migration |
| `deploy-preview.yml` and `publish-preview-image.yml` | Workflow filenames | Existing external filenames; active contracts now enforce staging origin and approved source-ref patterns |
| `/etc/dokploy/traefik/dynamic/preview-jpvbootcamp.yml` | Host-managed Traefik path | External immutable path; do not rename without routing migration and rollback proof |
| `jpv-bootcamp-preview-media` and `jpv-bootcamp-preview-private-media` | External volume names | Retained provider identifiers; not environment authority |

## Database and schema inventory

| Reference | Classification | Observed or intended state |
| --- | --- | --- |
| `jpvbootcamp` / `jpvbootcamp` | Production | Current production database/schema pair |
| `jpvbootcamp_staging` / `jpvbootcamp` | Current staging | Verified staging database/schema pair; exact-SHA read-only plan passed with 52 Payload migrations and no expected pending migrations |
| Preview hostname runtime | Non-authoritative compatibility state | Serves production runtime; do not infer a database or staging authority from the preview hostname |
| `jpvbootcamp_legacy` / `jpvbootcamp` | Legacy | Separate frozen legacy database/schema pair |
| `jpvbootcamp_staging_user` | Production role label | Observed on production and retained as configuration drift; no role repair was performed by E1 |
| `jpvbootcamp_staging_app` | Current staging role | Verified staging application role; no credentials are stored here |
| `jpvbootcamp_user` | Legacy role | Legacy only |

## Repository reference inventory

The following active staging entry points were corrected in this E1 packet to
derive their default origin from `src/lib/environmentTopology.ts` or to use the
canonical staging default:

- `Dockerfile`
- `playwright.staging.config.ts`
- `playwright-staging.config.ts`
- `e2e/admin-crud-staging.spec.ts`
- `e2e/stripe-webhook-staging.spec.ts`
- `e2e/staging-smoke.spec.ts`
- `scripts/e2e/stagingSmokeTest.ts`
- `scripts/staging-livekit-bunny-test.mts`
- `scripts/staging_livekit_bunny_e2e_verification.test.ts`
- `scripts/verify-staging-auth.mts`
- `scripts/portal-admin-smoke-evidence.ts`
- `scripts/portal-admin-mutation-smoke.test.ts`
- `scripts/portal-admin-server-action-smoke.test.ts`
- `scripts/staging_email_auth_verification.ts`
- `scripts/live_email_auth_proof_execution.ts`
- `scripts/payload_admin_logout_route.test.ts` and its route fallback
- `src/lib/billing-portal-return.ts`

The following are retained as historical packet fixtures or evidence and must
not be treated as current release authority without a later packet explicitly
adopting them:

- `feature/course-branding-and-preview` in dated packet tests, manifests, and
  historical evidence documents
- `scripts/preview/**`
- dated release, acceptance, and staging evidence documents containing the old
  preview origin
- old preview workflow and Traefik terminology preserved in filenames, secret
  names, and host paths
- `.deployment-status.json`, which is a dated 2026-07-18 status artifact; its
  preview URL, branch, and claims are not current live evidence
- `scripts/run-remediation.sh`, a legacy member-specific utility with hard-coded
  historical preview endpoints; it is not part of the E1 staging migration lane
- the `preview:*` package scripts, which generate or validate historical preview
  packets; current staging plans use `scripts/release/runStagingPayloadMigration.ts`
  and the `staging:*` package scripts
- `src/lib/staging-auto-provision.ts` accepting the historical `preview`
  environment label for compatibility; it does not establish hostname,
  database, or schema authority

The legacy hostname and preview-host media rewrite are not used by
current-platform authority except where they appear in explicit production or
legacy deny-lists, topology documentation, compatibility code, or defensive
tests. Those references are intentional safety boundaries.

## Preview retirement/repoint checklist — separate authorization

E1 did not remove or repoint the active preview hostname. Any future retirement
or repointing must preserve the verified staging authority and evidence all of
the following in one reviewed packet:

1. The verified staging database/schema/role remains independently identified
   without secrets.
2. The staging migration state remains matched to the repository registry.
3. Dokploy environment values continue to use `DEPLOYMENT_ENV=staging` and the
   staging origin consistently.
4. `https://staging.jpvbootcamp.com` continues to serve health and acceptance.
5. The production and legacy deny-lists still reject accidental targeting.
6. Rollback to the known current transitional runtime is documented and
   tested.

Earlier Gate-A inventory statements that described preview as current staging
or staging as a 404 are historical checkpoint evidence, superseded by the E1
closeout above.
