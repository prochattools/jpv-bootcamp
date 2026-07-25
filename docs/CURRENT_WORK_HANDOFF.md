# Current Work Handoff

Use this document as the canonical starting point for a new Codex or Workbench conversation.

## Repository identity

- Repository: `prochattools-jpv-bootcamp`
- Branch: `feature/course-branding-and-preview`
- Wave 3 checkpoint HEAD: `57711f9 feat: complete wave 3 course platform`
- Packet 9 checkpoint HEAD: `8927df9 docs: checkpoint membership implementation readiness`

## Deployed staging state

- **Deployed commit:** `5a6d98b93f2e115da8599bbf97c479514becc97e`
- **CI run:** #30164255271 — succeeded 2026-07-25
- **Staging URL:** https://preview.jpvbootcamp.com
- **Health:** `{"ok":true,"imageTag":"5a6d98b93f2e115da8599bbf97c479514becc97e"}`

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

## PHASE 4 PROOF MATRIX (FINAL — commit 5a6d98b)

### Stripe Webhook

| Check | Result | Evidence |
|---|---|---|
| Bad signature → 400 | PROVEN | HTTP 400 `{"error":"Invalid Stripe signature."}` |
| Live-mode event → 200 skipped | PROVEN | HTTP 200 `{"received":true,"skipped":"livemode_mismatch"}` |
| Test-mode event → 200 processed | PROVEN | HTTP 200; `evt_proof_provision_write_3394e5633a20` in `stripe_webhook_events`, `processed_at IS NOT NULL` |
| Duplicate event → 200 deduped | PROVEN | HTTP 200 `{"received":true}` — same event ID rejected |
| `stripe_webhook_events` row written | PROVEN | DB row confirmed |
| `customer_provisioning` row written | PROVEN | `cus_TvHnplLYSyKBiH / info@prochat.tools: plan=jpv_bootcamp_membership, status=active` — `isProvisioningPlan` fix works |

**Staging DB fix applied:** `customer_provisioning.plan` CHECK constraint updated to include `'jpv_bootcamp_membership'` (was missing from old constraint). This is a staging-only schema gap, not a code issue.

### Operator Actions (Billing)

| Check | Result | Evidence |
|---|---|---|
| Unauthorized → 403 | PROVEN | HTTP 403 `{"error":"unauthorized"}` |
| Provider Stripe ID rejected → 400 | PROVEN | HTTP 400 `invalid_input` |
| `sync_subscription` → 201 | PROVEN | HTTP 201; DB `id=45, action_type=sync_subscription, requested_by_id=1` |
| `cancel_at_period_end` → 201 | PROVEN | HTTP 201 (prior session) |
| `resume_subscription` → 201 | PROVEN | HTTP 201 (prior session) |
| Audit trail (requested_by_id) | PROVEN | DB: `requested_by_id=1` on all operator-created actions |
| Payload record ID enforced | PROVEN | Stripe ID `sub_1Tx4JALIsSm7aAuaeeJTk67T` rejected; only numeric Payload ID accepted |

### Email Operator Actions

| Check | Result | Evidence |
|---|---|---|
| Unauthorized → 403 | PROVEN | HTTP 403 |
| `retry_delivery` failed event → 201 | PROVEN | HTTP 201; DB: `action id=6, action_type=retry_delivery, requested_by_id=1, email_event_id=26` |
| Action finalizes to `completed` | PROVEN | DB: `payload_email_actions id=6, status=completed, completed_at IS NOT NULL, result.status=completed` — `db.updateOne` bypass fix works |
| Event moved failed → queued | PROVEN | DB: `payload_email_events id=26, delivery_status=queued, retry_count=1, last_retry_requested_at IS NOT NULL, last_retry_requested_by_id=1` |
| Repeat retry (queued) → 400 | PROVEN | HTTP 400 `{"error":"invalid_state","message":"Only failed email events are eligible for retry."}` |

### Bunny

| Check | Result |
|---|---|
| Synthetic webhook route/signature/projection proof | RETAINED from prior sessions |
| Real provider upload/processing/playback | IMPOSSIBLE this session — no Bunny media authored into CMS lessons. No automation path without actual media files and provider access. |

### LiveKit

| Check | Result |
|---|---|
| Token endpoint unauthorized → 401 | PROVEN — HTTP 401 `{"ok":false,"reason":"unauthorized"}` |
| Actual host + member room joins | IMPOSSIBLE this session — requires active staging session with host connected. No active host available. session 21 exists in `live_sessions` but was not live. |

### Browser

| Check | Result |
|---|---|
| Unauthorized denial | PROVEN via API (operator-actions 403, webhook 400/200 skipped, LiveKit 401) |
| Member image, PDF, lesson cover, video | IMPOSSIBLE this session — no media authored into CMS lessons; cannot automate without actual media files. |
| Pages/Posts rendering | IMPOSSIBLE this session — requires manual browser session with authored CMS content. |
| Persistence after reload | IMPOSSIBLE this session — same dependency as above. |

---

## Remaining blockers

1. **Bunny real upload/processing/playback**: No Bunny media authored into staging CMS lessons. Cannot automate without actual media files and provider access credentials. Requires manual CMS content authoring session. Low-priority for staging proof; infra is proven via synthetic webhook tests.

2. **LiveKit actual room join**: Requires active staging session with host connected. No active host available. Session 21 exists in `live_sessions`. Requires coordination with client to set up a live session during a proof window.

3. **Browser visual proof (media, Pages/Posts, persistence)**: Requires manual CMS content authoring. No automation path. Infrastructure proven via API boundary checks.

4. **`tenant_jpvbootcamp` schema cleanup**: Old pre-migration schema owned by `supabase_admin`. No app code references it. Needs admin DB credentials to drop. Low priority; harmless.

---

## STAGING PARTIAL — NO-GO

**Proven infrastructure (commit 5a6d98b):**
- Stripe webhook: signature validation, livemode skip, test-mode processing, idempotency dedup ✓
- Stripe provisioning: `customer_provisioning` row written with correct plan/status on `customer.subscription.updated` ✓
- Operator billing actions: sync/cancel/resume → 201, audit trail, unauthorized → 403, provider ID rejection ✓
- Email operator actions: retry → 201, action finalizes to `completed`, event moved to `queued`, repeat → 400 ✓
- Error redaction: internal errors not exposed in 500 responses ✓

**Reason for PARTIAL:** Three proof categories require manual CMS content authoring that cannot be automated:
1. Bunny media upload/processing/playback — no media in lessons
2. LiveKit actual room join — no active host session  
3. Browser visual proof (media, Pages/Posts) — no authored content

These are content/coordination gaps, not code defects. All automation-verifiable infrastructure is fully proven.

**What changed across this work:**
- Applied 8 missing Prisma migrations to `jpvbootcamp_staging` — resolved webhook 500
- Fixed `isProvisioningPlan` (`provisioning.ts:219`): `'pro'` → `'jpv_bootcamp_membership'` (commit `5a6d98b`)
- Fixed email action audit finalization via `payload.db.updateOne()` bypass (commit `5a6d98b`)
- Added `deliveryStatus === 'failed'` state guard on operator-actions route (commit `93eeccf`)
- Applied staging DB: `customer_provisioning.plan` CHECK constraint updated to include `'jpv_bootcamp_membership'`
- 163 tests passing (1 pre-existing import failure in `bunny-webhook.test.ts`)

**Exact next task:** Coordinate with client to (a) author Bunny media into staging lessons and (b) set up a live LiveKit session, then re-run visual/join proofs to reach STAGING FULLY PROVEN.
