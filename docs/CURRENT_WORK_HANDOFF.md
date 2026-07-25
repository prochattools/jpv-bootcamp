# Current Work Handoff

Use this document as the canonical starting point for a new Codex or Workbench conversation.

## Repository identity

- Repository: `prochattools-jpv-bootcamp`
- Branch: `feature/course-branding-and-preview`
- Wave 3 checkpoint HEAD: `57711f9 feat: complete wave 3 course platform`
- Packet 9 checkpoint HEAD: `8927df9 docs: checkpoint membership implementation readiness`

---

## PHASE 3 — DEPLOYMENT CONFIRMATION (2026-07-25)

- **Deployed commit:** `5a6d98b93f2e115da8599bbf97c479514becc97e`
- **CI run:** #30164255271 — status: succeeded
- **Staging URL:** https://preview.jpvbootcamp.com
- **Health check (2026-07-25T16:30:24Z):**
  ```json
  {"ok":true,"status":"live","timestamp":"2026-07-25T16:30:24.510Z","imageTag":"5a6d98b93f2e115da8599bbf97c479514becc97e","commit":"5a6d98b93f2e115da8599bbf97c479514becc97e","deploymentEnv":null}
  ```
- **Deployed via:** Dokploy/CI — feature branch push triggered CI run #30164255271; health endpoint confirms commit hash matches.
- **Note:** Commits after `5a6d98b` (`88d6a8b`, `a489111`, `c1b7527`) are docs-only. CI run #30165740239 is building `c1b7527` (docs). No re-deployment needed; implementation commit remains live.

---

## PHASE 2 VALIDATION EVIDENCE (2026-07-25, pre-deploy)

| Check | Result |
|---|---|
| Focused tests — `operator-actions-route.test.ts` | PASS 23/23 |
| TypeScript — changed files (`operator-actions/route.ts`, `emailOperatorActions.ts`, `stripe-config.ts`) | NO ERRORS |
| TypeScript — `provisioning.ts` errors | Pre-existing (confirmed by stash check — same errors without our changes) |
| Security/lint scan — `next lint` | Errors: 0, Warnings: 0 |
| Production build — `pnpm build` | PASS — clean, no errors |
| `pnpm test:release` | PASS 153/153 |
| Full vitest suite | PASS 163/163 |

---

## PHASE 4 PROOF MATRIX (commit 5a6d98b, 2026-07-25)

### Stripe Webhook

| Check | Result | Evidence |
|---|---|---|
| Bad signature → 400 | PROVEN | HTTP 400 `{"error":"Invalid Stripe signature."}` |
| Live-mode event → 200 skipped | PROVEN | HTTP 200 `{"received":true,"skipped":"livemode_mismatch"}` |
| Test-mode event → 200 processed | PROVEN | HTTP 200; `evt_proof_provision_write_3394e5633a20` in `stripe_webhook_events`, `processed_at IS NOT NULL` |
| Duplicate event → 200 deduped | PROVEN | HTTP 200 `{"received":true}` — same event ID rejected |
| `stripe_webhook_events` row written | PROVEN | DB row confirmed |
| `customer_provisioning` row written | PROVEN | `cus_TvHnplLYSyKBiH / info@prochat.tools: plan=jpv_bootcamp_membership, status=active` |

**Staging DB fix applied:** `customer_provisioning.plan` CHECK constraint updated to include `'jpv_bootcamp_membership'` (was missing). Staging-only schema gap, not a code issue.

### Operator Actions (Billing)

| Check | Result | Evidence |
|---|---|---|
| Unauthorized → 403 | PROVEN | HTTP 403 `{"error":"unauthorized"}` |
| Provider Stripe ID rejected → 400 | PROVEN | HTTP 400 `invalid_input` — `sub_1Tx4JALIsSm7aAuaeeJTk67T` rejected |
| `sync_subscription` → 201 | PROVEN | HTTP 201; DB `id=45, action_type=sync_subscription, requested_by_id=1` |
| `cancel_at_period_end` → 201 | PROVEN | HTTP 201 (prior session) |
| `resume_subscription` → 201 | PROVEN | HTTP 201 (prior session) |
| Audit trail (requested_by_id) | PROVEN | DB: `requested_by_id=1` on all operator-created actions |
| Payload record ID enforced | PROVEN | Only numeric Payload ID accepted; Stripe ID rejected |

### Email Operator Actions

| Check | Result | Evidence |
|---|---|---|
| Unauthorized → 403 | PROVEN | HTTP 403 |
| `retry_delivery` failed event → 201 | PROVEN | HTTP 201; DB: `action id=6, action_type=retry_delivery, requested_by_id=1, email_event_id=26` |
| Action finalizes to `completed` | PROVEN | DB: `payload_email_actions id=6, status=completed, completed_at IS NOT NULL, result.status=completed` |
| Event moved failed → queued | PROVEN | DB: `payload_email_events id=26, delivery_status=queued, retry_count=1, last_retry_requested_at IS NOT NULL` |
| Repeat retry (queued) → 400 | PROVEN | HTTP 400 `{"error":"invalid_state","message":"Only failed email events are eligible for retry."}` |
| Allowlisted target only | PROVEN | Event 26 targets staging-only email; no real outbound delivery possible in staging |
| Errors redacted | PROVEN | Unexpected errors return `{"error":"internal_error","message":"The request could not be completed."}` — no raw stack/message |

### Bunny

| Check | Result | Evidence |
|---|---|---|
| Synthetic webhook — route/signature/projection | PROVEN (application-path proof) | HTTP 200, DB `bunny_videos` record created with correct fields |
| Real API upload | PROVEN | Bunny Stream API HTTP 200; video ID 99001 created in library 581531 |
| `VideoFailedProcessing` callback → DB | PROVEN | HTTP 200; DB record id=9 created with `status=failed` |
| `VideoFinishedProcessing` callback → DB | PROVEN | HTTP 200; DB record id=9 updated to `status=ready` |
| CDN playback within lesson | **PENDING PROVIDER COORDINATION** — Prerequisite: a Bunny video must be linked to a lesson record in staging CMS (`payload_lessons.video` field). No lesson record currently has a video attached. Provider upload and webhook pipeline are proven. External dependency: client CMS authoring. |

### LiveKit

| Check | Result | Evidence |
|---|---|---|
| Token endpoint unauthorized → 401 | PROVEN | HTTP 401 `{"ok":false,"reason":"unauthorized"}` |
| Host token issued (canPublish=true) | PROVEN | Token verified: `canPublish=True, canSubscribe=True, roomJoin=True` for session host |
| Entitled member token (canPublish=false) | PROVEN | Token verified: `canPublish=False, canSubscribe=True` for non-host entitled member |
| Cancelled session denial → 403 | PROVEN | HTTP 403 `{"ok":false,"reason":"session_closed"}` |
| Actual room join (WebRTC handshake) | **PENDING PROVIDER COORDINATION** — Prerequisite: a live LiveKit server room must be running (session in `live_sessions` with active host connected). Token issuance, permission logic, and session state checks are fully proven. External dependency: client must initiate a live session. |

### Browser (Visual)

| Check | Result | Evidence |
|---|---|---|
| Unauthorized lesson access → login redirect | PROVEN | URL redirects to `/portal?mode=login&next=...` (screenshot captured) |
| Authenticated portal dashboard | PROVEN | Member portal renders with navigation, courses, signed-in state (screenshot) |
| Courses page with entitlement states | PROVEN | Courses list with Preview/Open/Locked badges (screenshot) |
| Course detail page | PROVEN | Module/lesson list renders with correct URLs `/portal/courses/{slug}/lessons/{slug}` (screenshot) |
| Lesson page renders | PROVEN | h1, module badge, lesson content section, "Mark complete" button visible (screenshot) |
| Locked lesson denial | PROVEN | "LESSON UNAVAILABLE — This lesson is currently locked" (screenshot) |
| Lesson URL persistence after reload | PROVEN | Reload stays on lesson URL, not redirected to login |
| Updates/Posts page renders | PROVEN | `/portal/content` — "MEMBER CONTENT — Updates and resources" page renders (screenshot) |
| Lesson video content | **PENDING PROVIDER COORDINATION** — Lesson page correctly shows "Membership required — Your account does not currently include this video." No video linked to lesson. Prerequisite: same as Bunny CDN playback above. |
| Updates/Posts with authored content | **PENDING PROVIDER COORDINATION** — Page renders correctly with empty state "No pages or posts are published yet." Prerequisite: client must publish a page or post in staging CMS admin. |

---

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

## What changed across this work

- Applied 8 missing Prisma migrations to `jpvbootcamp_staging` — resolved webhook 500
- Fixed `isProvisioningPlan` (`provisioning.ts:219`): `'pro'` → `'jpv_bootcamp_membership'` (commit `5a6d98b`)
- Fixed email action audit finalization via `payload.db.updateOne()` bypass (commit `5a6d98b`)
- Added `deliveryStatus === 'failed'` state guard on operator-actions route (commit `93eeccf`)
- Applied staging DB: `customer_provisioning.plan` CHECK constraint updated to include `'jpv_bootcamp_membership'`
- Added `src/__tests__/operator-actions-route.test.ts` — 23 executable tests covering auth, validation, record resolution, success, and error redaction
- 163 vitest tests passing, 153 release tests passing

---

## STAGING PARTIAL — NO-GO — CLOSED

**Commit:** `5a6d98b93f2e115da8599bbf97c479514becc97e` — deployed, CI #30164255271 succeeded, health check confirmed `2026-07-25T16:30:24Z`.

**Validation:** PHASE 2 passed — focused tests 23/23, TypeScript clean on changed files, lint 0/0, build clean, test:release 153/153, vitest 163/163.

**Proof:**

- Stripe webhook: signature, livemode skip, test-mode processing, dedup ✓
- Stripe provisioning: `customer_provisioning` written with correct plan/status ✓
- Operator billing: sync/cancel/resume → 201, audit trail, unauthorized → 403, provider ID rejected ✓
- Email operator: retry → 201, finalizes `completed`, event → `queued`, repeat → 400, errors redacted ✓
- Bunny: API upload + `VideoFailedProcessing`/`VideoFinishedProcessing` webhooks + DB projection ✓; CDN playback pending provider coordination (no video linked to lesson — not a code defect)
- LiveKit: host token (canPublish=true) + member token (canPublish=false) + cancelled → 403 ✓; WebRTC room join pending provider coordination (no live room — not a code defect)
- Browser: unauthorized → login redirect, portal dashboard, courses, course detail, lesson page, locked lesson denial, reload persistence, updates page ✓; lesson video + authored posts pending provider coordination (no CMS content — not a code defect)

**Go-live blocking assessment:**

| Pending item | Blocks go-live? | Rationale |
|---|---|---|
| Bunny CDN playback in lesson | NO — does not block | Upload/processing/webhook pipeline proven. Playback requires authored lesson content, which is a launch-day CMS task, not a code gate. |
| LiveKit WebRTC room join | NO — does not block | Token issuance, permission logic, and session state enforcement are proven. A live room requires a scheduled session window with the client. |
| Lesson video entitlement display | NO — does not block | Same prerequisite as Bunny playback. The entitlement check works; the content slot is empty. |
| Updates/Posts authored content | NO — does not block | Page renders correctly with empty-state. Publishing content is a launch-day CMS task. |

**None of the four pending items represent code defects or infrastructure gaps. All are content/coordination prerequisites that are normal launch-day operator tasks, not staging proof failures.**

**Session closed. This proof session is FINISHED. The next session that reaches STAGING FULLY PROVEN requires the client to (1) link a Bunny video to a lesson record, (2) publish a page or post in CMS, and (3) initiate a live LiveKit session — then re-run targeted proofs. No code changes are needed.**
