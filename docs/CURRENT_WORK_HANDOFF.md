# Current Work Handoff

Use this document as the canonical starting point for a new Codex or Workbench conversation.

---

## PHASE A — PORTAL DESIGN TOKEN HARDENING (2026-07-26)

**Branch:** `feature/course-branding-and-preview`
**Status: PHASE A COMPLETE**

### Mission

Remove high-visibility off-token styling from the member portal and standardize primary actions and eyebrows using existing JPV design tokens. Public frontend design is LOCKED — only portal internals changed.

### Token violations removed

| File | Violations removed |
|---|---|
| `portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx` | `bg-amber-50`, `border-amber-200`, `text-amber-800/950/900` (×2 sections), `bg-blue-50`, `text-blue-700` (preview badge), `bg-neutral-950` (2× buttons) |
| `portal/courses/[courseSlug]/page.tsx` | `bg-amber-50`, `border-amber-200`, `text-amber-950/900` (locked section), `bg-amber-50`/`text-amber-700` (lesson badge), `bg-blue-50`/`text-blue-700` (preview badge), `bg-neutral-950` (Open button + progress badge) |
| `portal/page.tsx` | `bg-neutral-950` (Continue lesson CTA) |
| `portal/courses/page.tsx` | `bg-neutral-950` (Open course CTA) |
| `src/components/portal/BillingPortalButton.tsx` | `bg-neutral-950` + custom hover classes |
| `src/components/portal/MemberCheckoutButtons.tsx` | `bg-neutral-950` (monthly), ad-hoc secondary button classes (annual) |

### Token replacements applied

| Old pattern | Replacement |
|---|---|
| `border-amber-200 bg-amber-50 text-amber-*` (locked/error) | `jpv-notice jpv-notice-danger` |
| `border-neutral-200 bg-neutral-50 text-neutral-*` (coming-soon) | `jpv-notice` |
| `bg-blue-50 text-blue-700` (preview badge) | `bg-emerald-50 text-emerald-700` |
| `bg-neutral-950 text-white` (primary CTA) | `jpv-button-primary` |
| Ad-hoc secondary button classes | `jpv-button-secondary` |
| `text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500` | `jpv-eyebrow` |
| `text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500` | `jpv-eyebrow` |
| `bg-neutral-950 text-white` (progress badge) | `bg-[var(--jpv-brand-deep)] text-[var(--jpv-canvas)]` |

### Static enforcement test added

`src/__tests__/portal-design-tokens.test.ts` — 45 tests:
- No `bg-amber-*`, `border-amber-*`, `text-amber-*` in scoped lesson/course files
- No `bg-blue-*`, `text-blue-*` in scoped files
- All 6 CTA files use `jpv-button-primary`
- No raw `bg-neutral-950` primary action in 5 CTA files
- All 4 portal pages use `jpv-eyebrow`
- No ad-hoc `tracking-[0.2em]` or `tracking-[0.18em]` patterns
- Business logic preserved: `detail.allowed`, `lockState`, `completeLesson`, `requirePortalMember`, `openBillingPortal`, `startMemberCheckout`, `recurringPaymentAccepted`

### Validation

| Check | Result |
|---|---|
| Portal design token tests — 45/45 | PASS |
| TypeScript (`pnpm type-check:payload`) | CLEAN |
| Production build (`pnpm build`) | PASS |
| Security scan | NO FINDINGS — pure CSS class substitution |
| `pnpm test:release` | PASS 153/153 |

### Browser proof — 390×844 (mobile) and 1280×900 (desktop)

Screenshots captured to `docs/phase-a-screenshots/` via `scripts/phase-a-browser-proof.ts`.

| Scenario | Mobile | Desktop | Result |
|---|---|---|---|
| Lesson locked/unavailable state (`jpv-notice-danger`) | ✓ | ✓ | Red-tinted surface, danger ink, no amber |
| Lesson coming-soon state (`jpv-notice` neutral) | ✓ | ✓ | Neutral surface, no amber |
| Lesson preview badge (`bg-emerald-50 text-emerald-700`) | ✓ | ✓ | Green badge, no blue |
| Mark complete button + Download button (`jpv-button-primary`) | ✓ | ✓ | Brand-deep (#123d2d) buttons |
| Dashboard Continue lesson CTA + eyebrow | ✓ | ✓ | Brand-deep button, uppercase eyebrow |
| Courses page Open course CTA + eyebrow | ✓ | ✓ | Brand-deep button |
| Course detail: locked/coming-soon/preview/complete lesson badges + Open button | ✓ | ✓ | Correct badge hierarchy, no amber/blue |
| BillingPortalButton normal + disabled | ✓ | ✓ | Brand-deep, 55% opacity on disabled |
| MemberCheckoutButtons monthly (primary) vs annual (secondary) + disabled | ✓ | ✓ | Clear hierarchy preserved |

No overflow detected at either viewport. Focus ring (`outline: 3px solid var(--jpv-focus)`) and disabled opacity (0.55) verified in rendered output.

### Files changed

```
src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx
src/app/(frontend)/portal/courses/[courseSlug]/page.tsx
src/app/(frontend)/portal/courses/page.tsx
src/app/(frontend)/portal/page.tsx
src/components/portal/BillingPortalButton.tsx
src/components/portal/MemberCheckoutButtons.tsx
src/__tests__/portal-design-tokens.test.ts          (new — static enforcement)
scripts/phase-a-browser-proof.ts                    (new — screenshot harness)
docs/phase-a-screenshots/                           (new — 18 screenshots + manifest)
```

### What was NOT changed

- No business logic, conditions, or entitlement checks
- No auth, billing behavior, Payload schemas, or API contracts
- No landing page or auth shell
- Public frontend design untouched

### Remaining design phases (not yet scoped)

- **Phase B:** Portal navigation and layout token cleanup (if any off-token patterns remain in nav/header/shell)
- **Phase C:** Admin branding alignment (if applicable)
- **Phase D:** Email template token consistency (email uses `emailInterface`/`emailEditorial` fonts)

---

## Repository identity

- Repository: `prochattools-jpv-bootcamp`
- Branch: `feature/course-branding-and-preview`
- Wave 3 checkpoint HEAD: `57711f9 feat: complete wave 3 course platform`
- Packet 9 checkpoint HEAD: `8927df9 docs: checkpoint membership implementation readiness`

---

## PHASE 5 — FINAL STAGING PROOF (2026-07-25)

**Deployed commit:** `5a6d98b93f2e115da8599bbf97c479514becc97e` (all code changes)
**Redirect fix commit:** `50d89af2c946ec711daf228fc30f2b816bb2ad6f` (next.config.js)
**Staging URL:** https://preview.jpvbootcamp.com
**Health check (2026-07-25):**
```json
{"ok":true,"status":"live","timestamp":"2026-07-25T16:30:24.510Z","imageTag":"5a6d98b93f2e115da8599bbf97c479514becc97e"}
```

---

## PHASE 2 VALIDATION EVIDENCE (2026-07-25)

| Check | Result |
|---|---|
| Focused tests — `operator-actions-route.test.ts` | PASS 23/23 |
| TypeScript — changed files | NO ERRORS |
| TypeScript — `provisioning.ts` errors | Pre-existing (stash-verified) |
| Lint — `next lint` | Errors: 0, Warnings: 0 |
| Production build — `pnpm build` | PASS |
| `pnpm test:release` | PASS 153/153 |
| Full vitest suite | PASS 163/163 |

Final re-validation (2026-07-25, this session):
- vitest: **163/163 PASS**
- TypeScript: **clean**
- Next.js lint: **Errors: 0, Warnings: 0**
- test:release: **153/153 PASS**

---

## PHASE 3 — DEPLOYMENT CONFIRMATION (2026-07-25)

- **Deployed commit:** `5a6d98b93f2e115da8599bbf97c479514becc97e`
- **CI run:** #30164255271 — status: succeeded
- **Health check confirmed** `2026-07-25T16:30:24Z`
- **Redirect fix** (`50d89af`) deployed — browser-verified: HTTP 200 on `/admin`, no more loops

---

## PHASE 4 PROOF MATRIX — FULLY RESOLVED (2026-07-25)

### Auth fixes (this session)

| Fix | Evidence |
|---|---|
| ERR_TOO_MANY_REDIRECTS on `/admin/login` | Root cause: static 308 `/admin`→`/admin/login` in `next.config.js`. Fix: removed redirect block (`50d89af`). Verified: `curl -sv https://preview.jpvbootcamp.com/admin` → HTTP 200. |
| Member login "cannot sign in at the moment" | Root cause: `payload_members` id=34 had `account_status='blocked'`. SQL fix: `account_status='active'`, `email_verified_at=NOW()`. Verified: `/api/member-session` → `{"allowed":true}`. |

### Stripe Webhook

| Check | Result | Evidence |
|---|---|---|
| Bad signature → 400 | PROVEN | HTTP 400 `{"error":"Invalid Stripe signature."}` |
| Live-mode event → 200 skipped | PROVEN | HTTP 200 `{"received":true,"skipped":"livemode_mismatch"}` |
| Test-mode event → 200 processed | PROVEN | HTTP 200; event row in `stripe_webhook_events`, `processed_at IS NOT NULL` |
| Duplicate event → 200 deduped | PROVEN | HTTP 200 — same event ID rejected |
| `customer_provisioning` row written | PROVEN | `cus_TvHnplLYSyKBiH: plan=jpv_bootcamp_membership, status=active` |

### Operator Actions (Billing)

| Check | Result | Evidence |
|---|---|---|
| Unauthorized → 403 | PROVEN | HTTP 403 `{"error":"unauthorized"}` |
| Provider Stripe ID rejected → 400 | PROVEN | HTTP 400 `invalid_input` |
| `sync_subscription` → 201 | PROVEN | HTTP 201; DB `id=45, action_type=sync_subscription, requested_by_id=1` |
| `cancel_at_period_end` → 201 | PROVEN | HTTP 201 |
| `resume_subscription` → 201 | PROVEN | HTTP 201 |
| Audit trail | PROVEN | `requested_by_id=1` on all operator-created actions |

### Email Operator Actions

| Check | Result | Evidence |
|---|---|---|
| Unauthorized → 403 | PROVEN | HTTP 403 |
| `retry_delivery` → 201 | PROVEN | HTTP 201; DB: `action id=6, status=completed` |
| Event moved failed → queued | PROVEN | DB: `delivery_status=queued, retry_count=1` |
| Repeat retry (queued) → 400 | PROVEN | HTTP 400 `{"error":"invalid_state"}` |

### Bunny

| Check | Result | Evidence |
|---|---|---|
| Synthetic webhook — route/signature | PROVEN | HTTP 200, `bunny_videos` record created |
| Real API upload | PROVEN | Bunny Stream HTTP 200; video ID 99001 in library 581531 |
| `VideoFailedProcessing` callback | PROVEN | DB record id=9 `status=failed` |
| `VideoFinishedProcessing` callback | PROVEN | DB record id=9 `status=ready` |
| CDN playback for enrolled member | **PROVEN** | Enrolled member → `{"ok":true,"url":"https://vz-d0404b6f-bd9.b-cdn.net/5fda17bf-3547-494e-8664-12edcdb7f7cb/playlist.m3u8?token=..."}` |
| CDN denied for unenrolled member | **PROVEN** | `{"ok":false,"reason":"not_entitled"}` |
| CDN denied unauthorized | **PROVEN** | `{"ok":false,"reason":"unauthorized"}` |
| Lesson 1 (`foundations-welcome`) video linked | **PROVEN** | `bunny_video_id=9, status=ready, video_guid=5fda17bf-3547-494e-8664-12edcdb7f7cb` |

### LiveKit (16/16 PASS, 2026-07-25)

| Check | Result | Evidence |
|---|---|---|
| Token unauthorized → 401 | **PROVEN** | HTTP 401 `{"ok":false,"reason":"unauthorized"}` |
| Host token issued (canPublish=true) | **PROVEN** | JWT claims: `canPublish=true, canSubscribe=true, roomJoin=true, room=livekit-webrtc-proof-room` |
| Entitled member token (canPublish=false) | **PROVEN** | JWT claims: `canPublish=false, canSubscribe=true, roomJoin=true` |
| Host token includes wsUrl + roomName | **PROVEN** | `wsUrl=wss://jpv-bootcamp-8wi8xcoy.livekit.cloud, roomName=livekit-webrtc-proof-room` |
| Cancelled session → 403 session_closed | **PROVEN** | Session 22 (cancelled): HTTP 403 `{"ok":false,"reason":"session_closed"}` |
| Unenrolled member denied | **PROVEN** | HTTP 404 via access-controlled `findByID` (Payload returns null for non-enrolled member) |
| LiveKit server API reachable | **PROVEN** | `RoomServiceClient.listRooms()` → success, `createRoom('livekit-webrtc-proof-room')` → `sid=RM_2tt5L95GCMSc` |
| Room create/list/delete via SDK | **PROVEN** | Room created, 0 participants verified, room deleted |
| Session 23 state: live, host=user 1 | CONFIRMED | DB: `status=live, host_user_id=1, room_name=livekit-webrtc-proof-room, course_id=1` |

### Browser / E2E (26/26 PASS — desktop 1280×900 + mobile 390×844)

| Check | Result | Evidence |
|---|---|---|
| Unauthorized lesson → login redirect | PROVEN | URL: `/portal?mode=login&next=%2F...foundations-welcome` |
| Authenticated portal dashboard | PROVEN | Member portal renders with nav + courses |
| Courses page | PROVEN | 6 course elements visible |
| Course detail → lesson list | PROVEN | Module/lesson list with slugged URLs |
| Lesson page (h1, content) | PROVEN | h1="Welcome and How to Use the Bootcamp" |
| **Lesson video player** | **PROVEN** | `video_elements=1`, `membership_required=false` (Bunny video linked and playing) |
| Locked lesson denial | PROVEN | "LESSON UNAVAILABLE — This lesson is currently locked" |
| Lesson reload persistence | PROVEN | URL stays on `/lessons/foundations-welcome` after reload |
| **Updates/Posts with authored content** | **PROVEN** | "MEMBER CONTENT — Updates and resources — Published" — page + post visible |
| Live sessions page | PROVEN | Renders without redirect |
| Account page | PROVEN | Renders without redirect |
| Billing page | PROVEN | Renders without redirect |
| Logout flow | PROVEN | Sign out works |
| Unauthenticated portal → login redirect | PROVEN | `/portal?mode=login&next=%2Fportal` |

---

## Staging DB state (proof data)

| Record | State |
|---|---|
| `payload_members` id=34 (`info@prochat.tools`) | `account_status=active`, `email_verified_at=SET`, enrolled in course 1 |
| `payload_lessons` id=1 (`foundations-welcome`) | `bunny_video_id=9` — Bunny video `guid=5fda17bf-3547-494e-8664-12edcdb7f7cb` `status=ready` |
| `payload_pages` id=1 | `status=published` — "Staging Proof Page" |
| `payload_posts` id=1 | `status=published` — "Staging Proof Post" |
| `live_sessions` id=23 | `status=live`, `host_user_id=1`, `room_name=livekit-webrtc-proof-room`, `course_id=1` |
| `live_sessions` id=22 | `status=cancelled` (denial test target) |
| `live_sessions` id=4 | `status=scheduled` (host-access test target) |

---

## What changed across this work

- Applied 8 missing Prisma migrations to `jpvbootcamp_staging` — resolved webhook 500
- Fixed `isProvisioningPlan` (`provisioning.ts:219`): `'pro'` → `'jpv_bootcamp_membership'` (commit `5a6d98b`)
- Fixed email action audit finalization via `payload.db.updateOne()` bypass (commit `5a6d98b`)
- Added `deliveryStatus === 'failed'` state guard on operator-actions route
- Applied staging DB: `customer_provisioning.plan` CHECK constraint updated
- Added `src/__tests__/operator-actions-route.test.ts` — 23 executable tests
- **Removed `/admin`→`/admin/login` 308 redirect from `next.config.js`** — fixed ERR_TOO_MANY_REDIRECTS (commit `50d89af`)
- SQL fix: `payload_members` id=34 `account_status` set to `active` — fixed member login

---

## GO-LIVE READY

**Status: STAGING FULLY PROVEN — GO-LIVE READY**

**Date:** 2026-07-25

### Final validation
- vitest 163/163 ✓
- TypeScript clean ✓
- lint Errors: 0, Warnings: 0 ✓
- test:release 153/153 ✓
- Browser E2E 26/26 (desktop + mobile) ✓
- LiveKit proof 16/16 ✓
- Bunny CDN playback proven ✓
- Admin + member login proven ✓

### No remaining blockers

All previously deferred items are now PROVEN:
- Bunny CDN playback in lesson — **PROVEN** (lesson video player visible, enrolled member gets signed URL)
- LiveKit WebRTC token issuance + server API — **PROVEN** (host/member JWT claims correct, LiveKit cloud server reachable)
- Lesson video entitlement display — **PROVEN** (no "Membership required" shown; video element present)
- Updates/Posts authored content — **PROVEN** (published page + post visible in `/portal/content`)

### Production cutover checklist

| Item | Owner | Action | Verification |
|---|---|---|---|
| `DATABASE_URL` → production schema | DevOps | Update to `jpvbootcamp` schema (not `jpvbootcamp_staging`) | `SELECT 1` from prod schema |
| `STRIPE_ENV=live` | DevOps | Set to `live` (staging uses `test`) | `getStripeConfig()` logs `stripeEnv=live` on startup |
| `STRIPE_SECRET_KEY_LIVE` | DevOps | Set live Stripe secret key | Stripe API auth check |
| `STRIPE_WEBHOOK_SECRET_LIVE` | DevOps | Set live webhook secret | Webhook signature check |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE` | DevOps | Set live publishable key | Browser Stripe.js loads |
| `STRIPE_PRICE_MONTHLY_LIVE` / `_ANNUALLY_LIVE` | Client | Set live price IDs from Stripe dashboard | Checkout price resolution |
| `STRIPE_PRODUCT_JPV_BOOTCAMP_MEMBERSHIP_LIVE` | Client | Set live product ID | Provisioning plan match |
| `STRIPE_PORTAL_CONFIGURATION_ID_LIVE` | Client | Set live billing portal config | Billing portal loads |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Client | Already in staging env — confirm prod credentials | Token endpoint returns `ok:true` |
| `BUNNY_STREAM_*` production keys | Client | Update to production Bunny library/signing keys | CDN playback URL returned |
| `RESEND_API_KEY` / `EMAIL_FROM` | Client | Set production Resend API key + verified from address | Email delivery confirmed |
| `PAYLOAD_SECRET` (production) | DevOps | Use unique secret (not staging value) | Admin login works |
| `APP_BASE_URL` / `NEXT_PUBLIC_SERVER_URL` | DevOps | Set to production domain | CSRF origin checks pass |
| Run Prisma migrations on prod DB | DevOps | `pnpm payload migrate` | No pending migrations |
| Stripe webhook endpoint registered | Client | Register `https://<prod-domain>/api/stripe/webhook` in Stripe dashboard | Stripe webhook delivers |
| LiveKit session in CMS (first live session) | Client | Create a session in `/admin/live_sessions` with host and course | Token endpoint returns room token |
| Publish a Page or Post in CMS | Client | Create + publish in `/admin/pages` or `/admin/posts` | Content visible in `/portal/content` |

### Rollback plan
- Dokploy: redeploy previous image tag from CI history
- DB: all staging migrations applied are additive (no column drops) — safe to roll back app without DB rollback
- Stripe: set `STRIPE_ENV=test` to switch back to test mode immediately

---

## Session history

- PHASE 3: Deploy confirmed (`5a6d98b`, CI #30164255271, health check `2026-07-25T16:30:24Z`)
- PHASE 4: Full proof — Stripe, operator billing, email, Bunny, LiveKit, browser E2E
- PHASE 5: Auth fixes (redirect loop + member blocked), content proof (video + page/post), LiveKit 16/16, final validation



### 2026-07-26 Design-System Phase B — responsive portal navigation

**Implementation**
- Added `src/components/portal/PortalNavigation.tsx` as the client-side navigation boundary while preserving server-side session resolution in the portal layout.
- Replaced the always-expanded eight-link wrapped navigation below the `lg` breakpoint with a compact JPV secondary menu trigger.
- Reused `AccessibleDialog`, which provides modal background isolation, Escape handling, initial focus movement, close behavior, and focus restoration to the trigger.
- All eight member routes remain available. Mobile links close the menu after selection, and active routes use `aria-current="page"`.
- Desktop navigation remains compact and visible at `lg` and above; tablet widths use the mobile disclosure to prevent wrapping.
- Header and main content now share the same `max-w-6xl` container and responsive `px-4 sm:px-6` margins.
- Portal identity truncates safely for long names and the navigation/control touch targets use at least 44px height.
- Updated `MemberLogoutButton` to use the JPV secondary action utility and preserve existing logout behavior.

**Validation**
- Phase B navigation tests: **6/6 passed**.
- Existing Phase A portal token tests: **45/45 passed**.
- Combined focused validation: **51/51 passed**.
- Payload TypeScript: **passed**.
- New navigation/layout/test security scan: **clean**.
- The broad scan additionally identifies the pre-existing same-origin logout `fetch()` call; this is required behavior and was not introduced by Phase B.
- Production build job `validation-c21b3a2a-2098-4216-a7cf-165ba6b63544`: **passed**.

**Responsive proof boundary**
- Repository and build behavior are verified for `390x844`, `768x1024`, and `1280x900` through responsive class contracts and focused tests.
- Live authenticated browser screenshots and keyboard interaction proof remain deferred to the final visual-regression phase after the design-system implementation phases are complete.

**Next design-system task**
- Phase C: consolidate account and billing UX with compact section navigation, standardized form controls, reduced scrolling, and human-readable membership details.



**Phase B release completion**
- The first `test:release` run exposed a stale static ownership check that still expected navigation links inside `portal/layout.tsx` after Phase B moved them into `PortalNavigation.tsx`.
- The contract was repaired to inspect the client navigation component while separately preserving the internal `/portal/programme` preview route.
- Runtime navigation behavior was not changed by this repair.
- Route ownership contract: **passed**.
- Final canonical release job `validation-6d66b417-64e2-483d-af6d-6ce02ecab49b`: **153/153 passed**.
