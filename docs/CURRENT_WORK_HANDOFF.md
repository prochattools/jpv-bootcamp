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

| Check | Result | Evidence |
|---|---|---|
| Synthetic webhook route/signature/projection proof | PROVEN (prior sessions) | HTTP 200, DB `bunny_videos` record created |
| Real API upload | PROVEN | Bunny Stream API HTTP 200; video ID 99001 created in library 581531 |
| `VideoFailedProcessing` callback | PROVEN | HTTP 200; DB record id=9 created with `status=failed` |
| `VideoFinishedProcessing` callback | PROVEN | HTTP 200; DB record id=9 updated to `status=ready` |
| CDN playback within lesson | DEFERRED — no Bunny video linked to any lesson record. Content gap, not a code defect. |

### LiveKit

| Check | Result | Evidence |
|---|---|---|
| Token endpoint unauthorized → 401 | PROVEN | HTTP 401 `{"ok":false,"reason":"unauthorized"}` |
| Host room join (canPublish=true) | PROVEN | Token issued: `canPublish=True, canSubscribe=True, roomJoin=True` for session host |
| Entitled member join (canPublish=false) | PROVEN | Token issued: `canPublish=False, canSubscribe=True` for non-host entitled member |
| Cancelled session denial → 403 | PROVEN | HTTP 403 `{"ok":false,"reason":"session_closed"}` |
| Actual room join (WebRTC handshake) | DEFERRED — requires running LiveKit server room. Token issuance fully proven; live join requires coordination with client. |

### Browser (Visual)

| Check | Result | Evidence |
|---|---|---|
| Unauthorized lesson access → login redirect | PROVEN | `/portal/courses/.../lessons/foundations-welcome` → `/portal?mode=login&next=...` (ss-unauth-lesson.png) |
| Authenticated portal dashboard | PROVEN | Member portal renders with navigation, courses, signed-in state (ss-m01-portal.png) |
| Courses page with entitlement states | PROVEN | Courses list renders with Preview/Open/Locked badges (ss-m02-courses.png) |
| Course detail page | PROVEN | Module 1 "Start Here", lessons with Open buttons at correct URLs (ss-final-course.png) |
| Lesson page renders | PROVEN | `foundations-welcome` loads: h1, module badge, lesson content section, "Mark complete" button (ss-lesson.png) |
| Lesson video content | DEFERRED — lesson page shows "Membership required — Your account does not currently include this video." No Bunny video linked to lesson record. Content gap, not a code defect. |
| Locked lesson denial | PROVEN | `foundations-operating-principles` shows "LESSON UNAVAILABLE — This lesson is currently locked — Complete the previous lesson before opening this one." (ss-locked-lesson.png) |
| Lesson URL persistence after reload | PROVEN | Reload stays on `/portal/courses/jpv-bootcamp-foundations/lessons/foundations-welcome` (not redirected to login) |
| Updates/Posts page renders | PROVEN | `/portal/content` renders "MEMBER CONTENT — Updates and resources" (ss-updates.png) |
| Updates/Posts with authored content | DEFERRED — "No pages or posts are published yet." No authored content in staging CMS. Content gap, not a code defect. |

---

## Remaining deferred items (content gaps — not code defects)

1. **Bunny CDN playback in lesson**: No Bunny video linked to any lesson record in staging CMS. API upload/processing webhook proven. Deferred until client authors media into lessons.

2. **Lesson video entitlement display**: Lesson page shows "Membership required" for video because no video is linked. The entitlement check and lesson route both work correctly. Deferred until lesson video field is populated.

3. **LiveKit actual room join (WebRTC)**: Token issuance proven for host and entitled member. Live WebRTC handshake requires running LiveKit server room. Deferred until client sets up a live session.

4. **Updates/Posts authored content**: Updates page renders correctly. No content published in staging CMS. Deferred until client authors pages/posts.

5. **`tenant_jpvbootcamp` schema cleanup**: Old pre-migration schema owned by `supabase_admin`. No app code references it. Needs admin DB credentials to drop. Low priority; harmless.

---

## STAGING PARTIAL — NO-GO

**Proven infrastructure (commit 5a6d98b, 2026-07-25):**
- Stripe webhook: signature validation, livemode skip, test-mode processing, idempotency dedup ✓
- Stripe provisioning: `customer_provisioning` written with `plan=jpv_bootcamp_membership, status=active` ✓
- Operator billing actions: sync/cancel/resume → 201, audit trail, unauthorized → 403, provider ID rejection ✓
- Email operator actions: retry → 201, finalizes to `completed`, event → `queued`, repeat → 400 ✓
- Bunny: API upload, `VideoFailedProcessing`/`VideoFinishedProcessing` webhook callbacks, DB projection ✓
- LiveKit: unauthorized → 401, host token (canPublish=true), member token (canPublish=false), session_closed → 403 ✓
- Browser — unauthorized access → login redirect ✓
- Browser — authenticated portal: dashboard, courses, course detail, lesson structure, locked lesson denial, reload persistence, updates page ✓
- Error redaction: internal errors not exposed in 500 responses ✓

**Reason for PARTIAL:** Four items deferred due to missing CMS content, not code defects:
1. Bunny CDN playback in lesson — no video linked to lesson records
2. Lesson video entitlement display — same content gap
3. LiveKit WebRTC room join — requires live server room, coordination with client
4. Updates/Posts with authored content — no CMS content published

## PHASE 2 VALIDATION EVIDENCE (2026-07-25, branch HEAD a489111)

| Check | Result |
|---|---|
| Focused tests — `operator-actions-route.test.ts` | PASS 23/23 |
| TypeScript — our files (`operator-actions/route.ts`, `emailOperatorActions.ts`, `stripe-config.ts`, `operator-actions-route.test.ts`) | NO ERRORS |
| TypeScript — pre-existing errors in `provisioning.ts` (payment projection columns) | Pre-existing, not introduced by this work (confirmed by stash check) |
| Security/lint scan — `next lint` | Errors: 0, Warnings: 0 |
| Production build — `pnpm build` | PASS — clean, no errors |
| test:release — `pnpm test:release` | PASS 153/153 |
| Full vitest suite | PASS 163/163 |

---

**What changed across this work:**
- Applied 8 missing Prisma migrations to `jpvbootcamp_staging` — resolved webhook 500
- Fixed `isProvisioningPlan` (`provisioning.ts:219`): `'pro'` → `'jpv_bootcamp_membership'` (commit `5a6d98b`)
- Fixed email action audit finalization via `payload.db.updateOne()` bypass (commit `5a6d98b`)
- Added `deliveryStatus === 'failed'` state guard on operator-actions route (commit `93eeccf`)
- Applied staging DB: `customer_provisioning.plan` CHECK constraint updated to include `'jpv_bootcamp_membership'`
- 163 tests passing, 153 release tests passing

**Exact next task:** Coordinate with client to (a) link a Bunny video to a staging lesson record, (b) publish a page/post in staging CMS, and (c) set up a live LiveKit session — then re-run targeted proofs to reach STAGING FULLY PROVEN.
