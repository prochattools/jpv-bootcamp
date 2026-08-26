# Production Launch GO Approval

- Decision ID: `production-launch-go`
- Current status: `PENDING`
- Depends on: `staging-go` (STAGING_GO must be approved first)
- Gate tier: `PRODUCTION_LAUNCH_GO` (new purchases safe; legacy users may stay on old platform)

## Purpose

PRODUCTION_LAUNCH_GO certifies that the platform is safe for new member
purchases on production after the exact main SHA is deployed, production
isolation is verified, and one controlled live end-to-end journey confirms
the checkout→webhook→entitlement→portal/email/video path.

Accepted placeholder content and deferred zero-row/REM-06 work may allow
CONDITIONAL GO with named exceptions.

## Required fields before PRODUCTION_LAUNCH_GO

- [ ] Exact main SHA to deploy: `[TO BE FILLED — must match reviewed release candidate]`
- [ ] STAGING_GO approval reference: `[TO BE FILLED — cite STAGING_GO decision record]`
- [ ] Production DB: `jpvbootcamp` (isolated from staging; must be confirmed before deploy)
- [ ] Production DB backup path/timestamp: `[TO BE FILLED before any production deploy]`
- [ ] Stripe env on production: `live` confirmed
- [ ] Production webhook URL: `jpvbootcamp.com/api/webhook/stripe` (not preview.*)
- [ ] Production webhook enabled in Stripe LIVE dashboard: `[TO BE FILLED]`
- [ ] Staging webhook disabled on go-live day: `[TO BE FILLED]`
- [ ] One controlled live journey confirmed:
  - [ ] New checkout (live Stripe TEST card or approved test method)
  - [ ] Webhook receipt confirmed (`jpvbootcamp.com` webhook)
  - [ ] Entitlement granted (member portal access confirmed)
  - [ ] Welcome email received
  - [ ] Video access confirmed (Bunny CDN stream loads)
- [ ] Monitoring owner: `[TO BE FILLED]`
- [ ] Rollback owner (production): `[TO BE FILLED]`
- [ ] Rollback command: `[TO BE FILLED]`
- [ ] Abort threshold: `[TO BE FILLED]`
- [ ] Communication owner: `[TO BE FILLED]`
- [ ] Named operator: `[TO BE FILLED]`
- [ ] Named technical approver: `[TO BE FILLED]`
- [ ] Named client approver: `[TO BE FILLED]`

## Conditional GO exceptions

If the following items are explicitly accepted by the client, they may be
deferred without blocking PRODUCTION_LAUNCH_GO:

| Item | Condition for CONDITIONAL GO |
| --- | --- |
| Programme content | Client explicitly accepts placeholder preview |
| REM-06 PartnerAttributionAdapter | Zero-row source confirmed or explicitly deferred |
| table-plan-to-free migration | No legacy Stripe subscriptions exist on production, OR explicit acceptance |

## Current evidence

Not yet collected. STAGING_GO is a prerequisite.

## PRODUCTION_LAUNCH_GO decision

- GO: `[REQUIRES: STAGING_GO approved, exact main SHA, production backup, live journey confirmed, all owners named]`
- CONDITIONAL GO: `[REQUIRES: same as GO plus named exceptions accepted by client]`
- NO-GO: `Current default`
