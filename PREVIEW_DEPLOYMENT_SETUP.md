# Preview Deployment Setup

## Overview
Feature branches can be deployed to a preview/staging environment completely isolated from production. Deployment is not automatic — it requires separate manual authorization. See `docs/PREVIEW_RELEASE_READINESS.md` for the approved release process.

## Infrastructure

### Database
✅ **Created:** `jpvbootcamp_staging` schema
- Duplicated from production `jpvbootcamp` schema
- Connection: `<staging DATABASE_URL — stored in Dokploy env>`
- User: `jpvbootcamp_staging_user`
- All 25 tables copied with production data snapshot
- **Safety:** Completely isolated from production data

### Dokploy Applications
- **Production:** `jpvbootcamp` app → main branch → production database
- **Preview:** `jpvbootcamp-preview` app → feature branches → staging database

## GitHub Setup Required

Add the following secrets to GitHub repo settings (Settings → Secrets and variables → Actions):

| Secret | Value | Source |
|--------|-------|--------|
| `DOKPLOY_API_KEY` | `XXVAsCORRQVukrFqZiRHhrSnWlZLlgTfolmPmeKdjdfdbNMqIBxEhaBXhxEkeqbD` | From your Dokploy API key |
| `DOKPLOY_API_BASE_URL` | `https://dokploy.prochat.tools` | Your Dokploy URL |
| `DOKPLOY_PREVIEW_APP_ID` | `<get-from-dokploy-ui>` | Preview app ID in Dokploy UI |
| `DOKPLOY_APP_ID` | `<already-set>` | Production app ID (already configured) |

**To find `DOKPLOY_PREVIEW_APP_ID`:**
1. Open Dokploy UI: https://dokploy.prochat.tools
2. Navigate to the preview app
3. Copy the app ID from the URL or app details

## Dokploy Preview App Configuration

Update the preview app environment variables to use the staging database:

```bash
# Change these from production values:
DATABASE_URL=postgresql://jpvbootcamp_staging_user:yR7pQ1wKfZ9mH2bTnC4xV6sLdP8eA3uB@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp_staging
SYSTEM_DATABASE_URL=postgresql://supabase_admin:HdgqzDjeGzta3VcE7nNCfKCGyEcwU4XV@10.0.2.4:5433/jpvbootcamp?schema=public

# Update these to preview domain:
APP_BASE_URL=https://preview.jpvbootcamp.com
NEXT_PUBLIC_SERVER_URL=https://preview.jpvbootcamp.com
NEXT_PUBLIC_APP_URL=https://preview.jpvbootcamp.com
NEXT_PUBLIC_APP_DOMAIN=preview.jpvbootcamp.com

# Update redirect URLs:
STRIPE_SUCCESS_URL=https://preview.jpvbootcamp.com/thank-you?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://preview.jpvbootcamp.com
SPONSORED_SEATS_SUCCESS_URL=https://preview.jpvbootcamp.com/thank-you/sponsor?session_id={CHECKOUT_SESSION_ID}
SPONSORED_SEATS_CANCEL_URL=https://preview.jpvbootcamp.com/#pricing

# Identification:
NEW_RELIC_APP_NAME=JPV Bootcamp Preview
```

## Workflows

### Production Deployment (main branch)
- Triggers on push to `main`
- Builds Docker image
- Pushes to GHCR as `latest`
- Deploys to production Dokploy app
- Uses production database

### Preview CI (feature branches)
- Triggers on push to `feature/*` or `pr/*` branches
- **Preview Validation workflow:** builds and tests the image only — no image push, no deployment
- **Publish Preview Image workflow:** builds and pushes a tagged image to GHCR (e.g., `feature-course-branding-and-preview`) — no deployment
- Neither workflow calls Dokploy or deploys to the preview environment
- Deployment requires separate manual authorization per `docs/PREVIEW_RELEASE_READINESS.md`

## Usage

### Testing a feature branch in preview:

1. Push to feature branch (e.g., `feature/my-feature`)
2. GitHub Actions runs Preview Validation (build/test only) and Publish Preview Image (image publication only) — no automatic deployment occurs
3. Follow the manual authorization steps in `docs/PREVIEW_RELEASE_READINESS.md` to deploy to preview
4. Visit `https://preview.jpvbootcamp.com` to test
5. Verify changes in staging database
6. If everything works, merge to main
7. GitHub Actions automatically deploys main to production

### Rolling back:

- **Feature branch issues:** Just don't merge to main (feature stays in preview)
- **Production issues:** Revert on main, push, and production auto-redeployes
- **Both isolated:** Staging issues don't affect production data or users

## Safety Guarantees

✅ Feature branches **cannot** affect production users  
✅ Production database **never** receives writes from feature branches  
✅ Staging database is a **fresh copy**, changes don't leak back to production  
✅ Preview deployment uses **separate Docker image** tagged by branch  
✅ **Easy rollback:** Revert commit and push to instantly redeploy old version  

## Next Steps

1. **Add GitHub secrets** (listed above)
2. **Update Dokploy preview app env vars** (database URLs + domain)
3. **Test:** Push a change to a feature branch, authorize deployment per `docs/PREVIEW_RELEASE_READINESS.md`, and verify it deploys to preview
4. **Merge to main** when confident and ready for production

---

**Database Status:**
- ✅ Production: `jpvbootcamp` (untouched)
- ✅ Staging: `jpvbootcamp_staging` (created with full copy of production data)
- ✅ Both users configured with same password for easy management
