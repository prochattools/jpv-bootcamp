# Preview-to-staging inventory

**Status:** E1 Gate A inventory — current, historical, and immutable references
classified; no live mutation performed

**Evidence date:** 2026-08-28

This inventory prevents a retained `preview` string from being mistaken for a
live environment authority. Current staging behavior must use
`https://staging.jpvbootcamp.com`; historical evidence and external immutable
identifiers remain labelled below until a separately authorized cleanup.

## Runtime and provider inventory

| Reference | Classification | E1 disposition |
| --- | --- | --- |
| `https://jpvbootcamp.com` | Current production origin | Canonical production; protected |
| `https://preview.jpvbootcamp.com` | Current transitional staging origin | Live today, but deprecated as the public staging identity; replace only in Gate B after routing is ready |
| `https://staging.jpvbootcamp.com` | Intended staging origin | Canonical target; currently returns 404 and is not promoted by E1 |
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
| `jpvbootcamp_preview` / `jpvbootcamp_staging` | Transitional staging | Current live preview runtime database/schema pair; read-only migration evidence is mismatched |
| `jpvbootcamp_staging` / `jpvbootcamp` | Intended staging target | Preferred Gate B target; provisioning and migration are not authorized in E1 |
| `jpvbootcamp_legacy` / `jpvbootcamp` | Legacy | Separate frozen legacy database/schema pair |
| `jpvbootcamp_staging_user` | Current observed role label | Used by production and transitional staging; role repair is deferred and fail-closed |
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

The legacy hostname is not used by current-platform automation except where it
appears in explicit production/legacy deny-lists, topology documentation, or
defensive tests. Those references are intentional safety boundaries.

## Gate B removal/repoint checklist

Do not remove or repoint the current preview route until all of the following
are evidenced in one reviewed packet:

1. The intended staging database/schema/role exists and is independently
   identified without secrets.
2. The staging migration state matches the repository registry, or the exact
   reviewed repair is recorded.
3. Dokploy environment values use `DEPLOYMENT_ENV=staging` and the staging
   origin consistently.
4. `https://staging.jpvbootcamp.com` serves health and the acceptance suite.
5. The production and legacy deny-lists still reject accidental targeting.
6. Rollback to the known current transitional runtime is documented and
   tested.
