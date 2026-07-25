# Current Work Handoff

Use this document as the canonical starting point for a new Codex or Workbench conversation.

## Repository identity

- Repository: `prochattools-jpv-bootcamp`
- Branch: `feature/course-branding-and-preview`
- Wave 3 checkpoint HEAD: `57711f9 feat: complete wave 3 course platform`
- Packet 9 checkpoint HEAD: `8927df9 docs: checkpoint membership implementation readiness`

## Deployed staging state

- **Deployed commit:** `93eeccfcd83062b0a45411aec8c90f80bd8c039d`
- **CI run:** #30163429132 — succeeded 2026-07-25
- **Staging URL:** https://preview.jpvbootcamp.com
- **Container:** `clients-jpv-bootcamp-app-tp9xrk` — healthy

## Staging DB migrations applied this session

Applied manually to `jpvbootcamp_staging` schema (were missing since April 2026):

| Migration | Status |
|---|---|
| `20260703_120000_add_subscription_projection` | Applied |
| `20260703_130000_add_payment_state_projection` | Applied |
| `20260703_140000_add_refund_dispute_projection` | Applied |
| `20260707_120000_rename_account_identity_columns` | Applied (staging-adapted) |
| `20260710_214000_add_subscription_commitment_projection` | Applied |
| `20260712_151700_add_support_requests` | Applied |
| `20260718_153220_add_claimed_by_account_id_to_sponsored_seats` | Applied |
| `20260722120000_add_email_events` | Applied (staging-adapted) |

Root cause of webhook 500: Prisma queried `billing_cadence` on `customer_provisioning` — column missing. Fixed by applying above migrations.

---

## PHASE 4 PROOF MATRIX

### Stripe Webhook

| Check | Result | Evidence |
|---|---|---|
| Bad signature → 400 | PROVEN | HTTP 400 `{"error":"Invalid Stripe signature."}` |
| Live-mode event → 200 skipped | PROVEN | HTTP 200 `{"received":true,"skipped":"livemode_mismatch"}` |
| Test-mode event → 200 processed | PROVEN | HTTP 200 `{"received":true}`; DB row `evt_final_proof_50da69ecdfbc` in `stripe_webhook_events` with `processed_at IS NOT NULL = true` |
| Duplicate event → 200 deduped | PROVEN | HTTP 200; container log `webhook_duplicate_ignored outcome=deduped reason=already_processed` |
| `stripe_webhook_events` row written | PROVEN | DB row: `event_id=evt_final_proof_50da69ecdfbc, type=customer.subscription.updated, livemode=false, confirmed=true` |
| Webhook subscription projection | **PARTIAL** | Webhook processes and records to DB; provisioning skips with `reason=invalid_plan` because `isProvisioningPlan()` only accepts `'pro'` not `'jpv_bootcamp_membership'` — **pre-existing bug, not introduced here** |

**Note on provisioning skip:** `provisioning.ts:219` `isProvisioningPlan(value) { return value === 'pro' }` — never updated when plan renamed. Webhook infrastructure is proven; end-to-end provisioning write blocked by this pre-existing defect.

### Operator Actions (Billing)

| Check | Result | Evidence |
|---|---|---|
| Unauthorized → 403 | PROVEN | HTTP 403 `{"error":"unauthorized"}` |
| Provider Stripe ID rejected → 400 | PROVEN | HTTP 400 `{"error":"invalid_input","message":"A valid Payload subscription record ID is required."}` |
| `sync_subscription` → 201 | PROVEN | HTTP 201 `{"id":45,"status":"pending","actionType":"sync_subscription"}`; DB: `id=45, action_type=sync_subscription, requested_by_id=1, subscription_id=60` |
| `cancel_at_period_end` → 201 | PROVEN | HTTP 201 `{"id":41,...}` (prior session) |
| `resume_subscription` → 201 | PROVEN | HTTP 201 `{"id":43,...}` (prior session) |
| Audit trail (requested_by_id) | PROVEN | DB: `requested_by_id=1` on all operator-created actions |
| Payload record ID enforced | PROVEN | Stripe ID `sub_1Tx4JALIsSm7aAuaeeJTk67T` rejected; only numeric Payload ID 60 accepted |

### Email Operator Actions

| Check | Result | Evidence |
|---|---|---|
| Unauthorized → 403 | PROVEN | HTTP 403 |
| `retry_delivery` failed event → 201 | PROVEN | HTTP 201 `{"id":5,"status":"pending","actionType":"retry_delivery"}`; DB: `id=5, action_type=retry_delivery, requested_by_id=1, email_event_id=26` |
| Event moved failed → queued | PROVEN | DB: `payload_email_events id=26, delivery_status=queued, retry_count=1, last_retry_requested_at IS NOT NULL` |
| Repeat retry (queued) → 400 | PROVEN | HTTP 400 `{"error":"invalid_state","message":"Only failed email events are eligible for retry."}` |
| Email actually sent | **PARTIAL** | Action created, event queued; background `emailOperatorActions.ts` afterChange hook fails to finalize audit update due to Payload relationship filter re-validation on update (not a send failure — staging email guard prevents actual send to non-allowlisted addresses) |

### Bunny

| Check | Result |
|---|---|
| Synthetic webhook route/signature/projection proof | RETAINED from prior sessions |
| Real provider upload/processing/playback | PENDING — no Bunny media authored into lessons |

### LiveKit

| Check | Result |
|---|---|
| Token endpoint unauthorized → 401 | PROVEN — HTTP 401 `{"ok":false,"reason":"unauthorized"}` |
| Actual host + member room joins | PENDING — requires active LiveKit session and entitled member; session 21 exists in `live_sessions` but no active host connection available in this session |

### Browser

| Check | Result |
|---|---|
| Member image, PDF, lesson cover, video | PENDING — no media authored into CMS lessons |
| Pages/Posts rendering | PENDING — browser proof not captured |
| Unauthorized denial | PROVEN via API (operator-actions 403, webhook 400/200 skipped, LiveKit 401) |
| Persistence after reload | PENDING |

---

## Remaining blockers

1. **`isProvisioningPlan` plan name mismatch** (`provisioning.ts:219`): returns `value === 'pro'` but plan is `jpv_bootcamp_membership`. Webhook processes and records correctly but provisioning skips. Fix: `return value === 'jpv_bootcamp_membership' || value === 'pro'` (backward compat) or remove `'pro'` entirely.

2. **Email retry audit finalization** (`emailOperatorActions.ts:197`): `payload.update()` with `overrideAccess: true` still re-validates `filterOptions` on relationship fields in Payload v3. The action record stays `pending` instead of completing. Fix options: use raw Prisma update for the status write, or drop the `emailEvent` relationship from the update data (it doesn't need to change on the update).

3. **Lesson media / browser proof**: Requires manual CMS authoring of images, PDFs, videos into lesson records. Cannot be automated without actual media files.

4. **LiveKit actual room join**: Requires an active staging session with a host connected. No host session was available during this proof session.

5. **`tenant_jpvbootcamp` schema cleanup**: Old pre-migration schema owned by `supabase_admin`. No current app code references it. Needs admin DB credentials to drop. Low priority.

---

## STAGING PARTIAL — NO-GO

**Reason for NO-GO:** End-to-end Stripe provisioning write is blocked by pre-existing `isProvisioningPlan` defect. Email retry audit finalization stuck at `pending`. Browser/media/LiveKit proofs not captured. These are pre-existing bugs and content gaps — the infrastructure (webhook, operator-actions, DB, idempotency, schema) is fully proven.

**What changed this session:**
- Applied 8 missing Prisma migrations to `jpvbootcamp_staging` — resolved webhook 500
- Added `deliveryStatus === 'failed'` state check to operator-actions route (commit `93eeccf`)
- Added test coverage for invalid_state (23 tests passing)
- Deployed and verified on staging

**Exact next task:** Fix `isProvisioningPlan` in `provisioning.ts:219` to accept `'jpv_bootcamp_membership'`, then re-run webhook proof to confirm provisioning row written to `customer_provisioning`.
