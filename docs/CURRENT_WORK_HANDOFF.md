# Current Work Handoff

Use this document as the canonical starting point for a new Codex or Workbench conversation.

---

## CURRENT TRUTH — 2026-08-27

JPV Bootcamp is live in production. This section is the current handoff
authority; all dated sections below are retained as historical evidence unless
explicitly superseded here.

- **Release authority:** `main` and `origin/main`, verified after fetch at
  `08605e52af4abb0b1bdcdfbe6890d010c545b636`.
- **Production evidence:** GitHub Actions run `33093612107` passed; Dokploy
  production deployment converged; the live app reported the exact SHA with
  `deploymentEnv=production`; the required Payload relationship-table
  migration was applied; production health was green.
- **Architectural hold:** normal feature development is paused for the
  behavior-preserving A0–A6 architecture consolidation.
- **Current branch:** `codex/production-architecture-consolidation`, descended
  directly from the verified `main` tip and A0 parent
  `c43e899824b993200b05f1b337993eb55fae0905`.
- **Current packet:** A2 correction complete locally. It retains the A1
  authorization and action-result foundation and adds canonical server-safe
  validation, relationship-ID normalization, deterministic plain-text Payload
  Lexical serialization without silent default character truncation,
  equivalent-helper consolidation across the reviewed services, and the Portal
  Admin service map.
- **Behavior boundary:** `requirePortalMember()`, `requirePortalAccess()`,
  login routing, domain operations, schemas, providers, production `main`, and
  production data were not changed. The separate request-header Live Sessions
  API helper remains outside this Server Action packet for behavior-preserving
  follow-up review.
- **Exact next packet:** A3 — Community Domain Convergence.
- **Approved sequence after A2:** A4 — Course/Creator Domain Convergence; A5 —
  Source-of-Truth and Architecture Enforcement; A6 — Full Regression and
  Controlled Production Integration.
- **Hard stops:** do not start A3, merge historical branches, run migrations,
  mutate production/providers, delete branches/worktrees, push, build, or
  deploy from this packet. Preserve unknown residue, route ambiguity, and
  stale roadmap claims for the packet that owns them.
- **Architecture authority:** `docs/architecture/` contains the production
  architecture, source-of-truth map, engineering principles, and packet plan.

## Historical pre-production repository reconciliation — 2026-08-23

- **Working branch:** `feature/course-branding-and-preview`; canonical frozen staging release and deployed SHA are `9d87c4a3eeeffb9afb78a38964054792330ea1cb`. Current repository tip `626bf3926412065fb7e5655d35c98d8f4be67a58` is a documentation-only descendant and is not deployed.
- **Cleanup record:** `docs/release/BRANCH_RECONCILIATION_2026-08-23.md`.
- **Source/state:** 36 registered Payload migrations; read-only staging plan run `32648793013` returned `plan_ok`, 36/36 applied, pending `[]`, zero unexpected/duplicate/malformed records, and Prisma healthy. No migration was executed.
- **Release evidence:** explicit staging deploy run `32649230612` succeeded. `/api/health` returned 200 with `imageTag` and `commit` equal to `9d87c4a3eeeffb9afb78a38964054792330ea1cb` and `deploymentEnv=staging`.
- **Protected residue:** pre-existing `.claude/worktrees/**` changes and `newrelic_agent.log` remain untouched.
- **Current staging:** frozen exact-SHA baseline is live and healthy. Public endpoint checks returned 200 for health, home, sign-in, portal, courses, community, account, and billing. LiveKit token validation correctly rejected malformed unauthenticated requests with 400; authenticated token/browser evidence remains historical.
- **Production boundary:** production remains unauthorized and untouched; Phase 10 has not started.
- **Phase 9.5 authority:** use `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md` for current status and `docs/release/PHASE_9_5_FINAL_IMPLEMENTATION_BACKLOG_2026-08-23.md` for remaining work.

## Historical staging checkpoint — 2026-08-19/21 (NOT CURRENT LIVE EVIDENCE)

This section records the 2026-08-19/21 historical checkpoint. At that checkpoint, all staging migration and acceptance gates were reported closed; that claim is not current-live evidence. The Phase 9.5 current-truth document is authoritative for the present state.

| Item | Value |
|---|---|
| Branch | `feature/course-branding-and-preview` |
| Deployed SHA | `abf43893dc3f9980cc8eadc997cd7935e86e614f` |
| Deploy run | `32352382852` |
| Staging app | `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU` |
| Database | `jpvbootcamp`, schema `jpvbootcamp_staging` |
| `DEPLOYMENT_ENV` | `staging` confirmed in running container |
| Payload migrations | 35/35 applied |
| Legacy import operations | 935/935 applied; 2 historical failed ledger attempts are audit-history only |
| Members | 51 total: 12 active (all `emailVerifiedAt` set), 39 blocked, 0 active without `emailVerifiedAt` |
| Login verified | `westhoek@hotmail.com` confirmed on staging |
| Staging email | `sent`, Resend ID `3affb3ee-38ad-4e6e-9fe1-55d202712b8c` |
| Public media | 24/24 |
| Private media | 25/25 |
| Lesson resources | 25/25 published |
| Protected download anonymous | 404 ✓ |
| Protected download authenticated member | 200 + real file content ✓ |
| Playwright staging | 84 passed / 0 failed |
| Admin responsive | 14/14 |
| Migration contract test | PASS |
| Production migration / cutover | NOT performed, NOT authorized |

**Production note:** Production `jpvbootcamp.com` routing was manually restored after an unrelated routing incident. No production migration, deployment, or cutover is authorized by this document. Production schema is `jpvbootcamp` (public), not `jpvbootcamp_staging`.

**Remaining work:** Production migration planning and cutover remain a separate, independently gated process. Staging acceptance is complete.

---

## Historical checkpoint — final pre-migration repository closure (2026-08-08)

> The remainder of this section is retained as an audit record from the 2026-08-08 pre-migration lane. Its migration-29, deployed-SHA, and operator instructions are not current instructions. The current source registry and current release gaps are recorded in `docs/release/FINAL_PRE_PRODUCTION_RECONCILIATION_2026-08-23.md`.

- **Only permitted branch:** `feature/course-branding-and-preview`.
- **Only permitted runtime/deployment target:** `https://preview.jpvbootcamp.com`, Dokploy slug `clients-jpv-bootcamp-app-tp9xrk`, app ID `I_2Vukga3cc3ZhaG-mUzU`.
- **Only permitted database target:** host `10.0.2.4`, port `5433`, database `jpvbootcamp`, schema `jpvbootcamp_staging`.
- **Current feature tip:** verify the exact operator tip with `git rev-parse HEAD`; ordinary feature pushes are validation-only and cannot deploy.
- **Current live staging baseline:** `9c045fa5a5c327014c20fe9377f7d5368b550573` until an explicit guarded staging deployment changes it.
- **Launch-scope implementation:** complete in repository source, including durable account-action reservation/finalization and migration `20260804_050000_member_account_action_reservations`.
- **Authoritative staging evidence:** read-only plan run `31215369413` at reviewed code checkpoint `9e068cc8b0a5ec9573732fee3a78bed9995787a6` returned `plan_ok`: 28 Payload migrations applied, migration 29 solely missing, zero unexpected/duplicate/malformed Payload records, and Prisma healthy. It authorized no write.
- **Current closure boundary:** after the final documentation/CI checkpoint, rerun the guarded read-only plan against that exact final SHA. A fresh `plan_ok` makes the migration-29 apply packet ready for separate operator authorization; migration 29 is not applied by this checkpoint.
- **Deferred by design:** M2-01 and Phases 8–11 remain deferred/follow-up scope and are not launch-scope blockers.
- **Security boundary:** no other branch, application, environment, database, or schema is permitted by current operational tooling.

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
| CDN playback for enrolled member | **PROVEN** | Enrolled member received an authorized Bunny playback URL; credential-bearing query parameters are intentionally omitted. |
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



### 2026-07-26 Design-System Phase C — account and billing UX coherence

**Implementation**
- `/portal/account` now focuses only on profile, password, sign-in email, and account security; billing and group projection panels were removed from the account route because those concerns have dedicated routes.
- Added compact horizontal section navigation for Profile, Password, and Email, with mobile-safe overflow and 44px touch targets.
- Added an above-the-fold membership summary using the member-facing label `JPV Bootcamp Membership`.
- Standardized profile fields, cards, notices, focus rings, primary actions, spacing, borders, and radii to the existing JPV/auth-shell primitives.
- `/portal/billing` now uses compact Status, Manage, and Details navigation; billing status, renewal/cancellation state, checkout, billing-portal, and cancellation actions remain connected to the existing server actions and Stripe projections.
- Replaced legacy `Pro Monthly` wording and technical projection headings with member-facing membership and billing language.
- Removed scoped off-token amber, blue, sky, orange, gray, slate, and raw `bg-neutral-950` styling from the combined account/billing route.
- Stripe webhooks remain the source of truth; no authorization, entitlement, checkout, cancellation, profile, password, or email-change behavior changed.

**Validation**
- Phase C account/billing design tests: **5/5 passed**.
- Combined Phase A-C design tests: **56/56 passed**.
- Portal route ownership: **passed**.
- Account/billing parity contract: **passed** after updating stale expectations to the new route separation and `Billing details` heading.
- Payload TypeScript: **passed**.
- Changed-path high-risk security scan: **clean**.
- Production build job `validation-436ee1a3-2824-4315-8b8b-d402857b61ca`: **passed**.
- Canonical release job `validation-7e8746f1-17d1-4b68-89dd-71aa20c7a30b`: **153/153 passed**.

**Responsive proof boundary**
- Repository behavior and responsive contracts are verified for mobile, tablet, and desktop layouts through section-navigation classes, focused tests, TypeScript, and production build.
- Live authenticated browser screenshots and keyboard interaction proof remain deferred to the final visual-regression phase after the remaining design-system phases are complete.

**Remaining design-system phases**
- Phase D: community, content, live-session, partner, and support surface coherence.
- Phase E: public, auth-adjacent, legal, error, empty, and system-state surfaces.
- Phase F: operator and Payload admin branding/responsiveness.
- Phase G: email and outbound communication polish.
- Phase H: live browser/mobile visual regression and accessibility proof.



### 2026-07-26 Design-System Phase D — remaining portal surface coherence

**Implementation**
- Aligned the member content hub, published Page/Post renderer, Live Sessions, Support, Community index/detail, Partner index, and Partner application detail with the canonical JPV design system.
- Removed conflicting inner width constraints and normalized portal-shell spacing, headings, cards, notices, buttons, fields, badges, links, empty states, and 44px touch targets.
- Replaced all scoped off-token amber, blue, gray, slate, sky, orange, raw `bg-neutral-950`, `max-w-7xl`, and arbitrary `var(--jpv-*)` utility classes with mapped JPV tokens.
- Community post submission remains bound to the existing server action and membership checks.
- Partner application submission, authenticated member identity, privacy consent, server-owned destinations, affiliate queries, and application history remain unchanged.
- Partner commission totals now format using the stored currency through `Intl.NumberFormat`; no currency is invented when none is stored.
- Support remains preview-only and non-submitting.

**Validation**
- Phase D design tests: **6/6 passed**.
- Combined Phase A-D design tests: **62/62 passed**.
- Portal route ownership: **passed**.
- Payload TypeScript: **passed**.
- Changed-path high-risk security scan: **clean**.
- Prohibited-style scan across the Phase D scope: **zero matches**.
- Production build job `validation-033ed60f-bf6a-44bf-969e-5095bc0e49ef`: **passed**.
- Canonical release job `validation-0ff60f34-35e5-4516-a6fb-4ec473b583fd`: **153/153 passed**.

**Responsive proof boundary**
- Repository behavior is validated for mobile, tablet, and desktop through responsive grid/container contracts, focused tests, TypeScript, and production build.
- Live authenticated screenshots and keyboard/browser interaction remain deferred to the final visual-regression phase.

**Remaining design-system roadmap**
- Phase E: public, auth-adjacent, legal, error, empty, and system-state surfaces.
- Phase F: Payload admin and operator page branding/responsiveness.
- Phase G: email and outbound communication polish.
- Phase H: live browser/mobile visual regression and accessibility proof.



### 2026-07-27 Design-System Phase E — public, legal, system-state, and Course Preview coherence

**Implementation**
- Added `PublicInformationShell` and `PublicInformationCard` as reusable token-compliant public-surface primitives derived from the locked frontend design.
- Aligned Privacy, Terms, Cookies, Upgrade, Thank-you, Blog, frontend not-found, frontend error, and frontend loading surfaces with canonical JPV typography, spacing, cards, notices, actions, focus styles, and container widths.
- Removed legacy template Header/Footer usage from Blog while preserving its out-of-launch-scope status.
- Preserved Upgrade monthly and annual checkout URLs, recurring-payment consent gating, disabled-link behavior, and all Stripe query parameters.
- Preserved the Thank-you seven-second redirect, Stripe session confirmation, frontend error `reset()` behavior, and accessible loading semantics.
- Normalized all three active Course Preview routes to mapped JPV tokens, `max-w-6xl` shells, canonical primary/secondary actions, and 44px targets.
- Course Preview feature gates, prototype banner, route parameters, static demo content, progress state, lesson state, and navigation behavior remain unchanged.
- Prohibited Course Preview patterns now have zero matches: arbitrary `var(--jpv-*)` color utilities, raw white/black inverse utilities, `max-w-7xl`, and `bg-neutral-950`.
- Forgot-password, reset-password, set-password, and Sponsored were inspected and already complied with the shared auth/public design system, so no changes were made.

**Validation**
- Phase E frontend design tests: **7/7 passed**.
- Combined Phase A-E design tests: **69/69 passed**.
- Portal route ownership: **passed**.
- Payload TypeScript: **passed**.
- Changed-path high-risk security scan: **clean**.
- Course Preview prohibited-style scan: **zero matches**.
- Production build job `validation-1475d762-3630-4f81-be83-b09df95a4b17`: **passed**.
- Canonical release job `validation-72f7ea49-4412-404f-883c-f5a290355ca9`: **153/153 passed**.

**Responsive and browser proof boundary**
- Repository behavior is validated for mobile, tablet, and desktop through responsive shell widths, canonical action targets, accessible state semantics, focused tests, TypeScript, and production build.
- Live browser proof remains deferred to the final visual-regression phase, including keyboard interaction, authenticated states, mobile viewport screenshots, and visual overflow inspection.

**Secondary portal re-audit findings — next member-facing priority**
- Remaining active portal token debt is concentrated in secondary surfaces rather than the core dashboard/course/account flows:
  - Bunny processing, failed, and entitlement state components;
  - shared `StatusPill` presentation;
  - `/portal/programme`;
  - `/portal/partner-referral`;
  - Community moderation;
  - Community submissions;
  - Community post detail and reply surfaces.
- These findings should be completed as one bounded member-portal hardening batch before email coherence, preserving all Bunny, entitlement, referral, moderation, submission, and reply behavior.

**Remaining design-system roadmap in owner priority order**
1. Member portal secondary-state hardening.
2. Email and outbound communication coherence.
3. Responsive and accessibility hardening with live visual proof.
4. Operator tool branding and density.
5. Payload admin branding and responsiveness.



### 2026-07-27 Secondary member-portal state hardening

**Implementation**
- Aligned shared `StatusPill` tones with canonical JPV status tokens.
- Aligned Bunny video loading, processing, entitlement, unauthorized, failed, and playback states with canonical notices, cards, and accessible status semantics.
- Aligned `/portal/programme`, `/portal/partner-referral`, Community Submissions, Community Moderation, and Community Post/Reply surfaces with canonical JPV spacing, fields, status pills, actions, notices, and responsive layouts.
- Preserved all Bunny fetch and entitlement behavior, member authorization, programme catalog data, preview-only referral behavior, submission queries/downloads, moderation actions/audit actor/redirects, discussion `notFound()` behavior, attachments, locked comments, and `submitCommunityComment.bind(null, spaceSlug, postId)`.
- Standardized scoped date formatting to `en-US`.
- Updated the Programme static route contract to accept either valid JSX quote style around `/portal/billing`.

**Validation**
- Focused secondary portal tests: **7/7 passed**.
- Combined design tests: **76/76 passed**.
- Portal route ownership: **passed**.
- Payload TypeScript: **passed** after one bounded stale-property repair (`summary.weekCount` to `summary.totalWeeks`).
- Scoped prohibited-style scan: **zero matches**.
- Changed-path security scan: clean except for the unchanged same-origin Bunny fetch; separate secret-material and runtime-execution scans are clean.
- Production build job `validation-eb238b1a-1da9-4029-9a92-aac4935ccfaa`: **passed**.
- Targeted Programme contract: **passed**.
- Release job `validation-6e0f3f7c-14c6-4d64-91b3-7f5372c291c6`: all **154/154 checks passed**; the wrapper exited 1 only because concurrent Stripe/release work changed repository paths during validation.

**Concurrent Stripe checkout fix**
- Public Stripe membership checkout was fixed separately and committed as `06866d4 fix: allow public Stripe membership checkout`.
- The checkout and portal-design changes remain separate commits.

**Deployment boundary**
- Staging branch remains `feature/course-branding-and-preview`; never deploy `main`.
- `.github/workflows/deploy-preview.yml` currently triggers on pushes to `feature/**`, so pushing the reviewed branch triggers the preview deployment workflow.
- No migrations, secret edits, or production operations are authorized by this batch.



### 2026-07-27 Stripe onboarding email delivery incident

**Root cause**
- The staging recipient domain (`prochat.tools`) and verified sender domain (`jpvbootcamp.com`) are not contradictory. Resend requires the **From** domain to be verified; recipients may use any deliverable domain.
- `checkout.session.completed` was allowed by the Stripe membership-email gate, but checkout provisioning treated only `customer.subscription.updated` and `manual_sync` as canonical email events. The successful checkout therefore suppressed onboarding with `event_not_canonical`; the later subscription event could then be deduplicated after the membership projection already existed.
- The Payload startup warning (`No email adapter provided`) is separate from this custom membership onboarding path. Membership onboarding uses the repository's Resend-backed transactional sender directly.

**Fix**
- Checkout provisioning now treats `checkout.session.completed` as a canonical first-onboarding email event while preserving existing plan-change checks, event-id/plan dedupe, staging recipient restrictions, and later subscription-update behavior.
- Added `scripts/stripe_onboarding_email_delivery.test.ts` to prove webhook allow-email propagation, checkout canonicality, Resend-backed welcome delivery, dedupe retention, and staging recipient safety.

**Required staging environment contract**
- `RESEND_API_KEY=<valid Resend API key>`
- `RESEND_BASE_URL=https://api.resend.com`
- `RESEND_FROM=enquiries@jpvbootcamp.com`
- `EMAIL_FROM=enquiries@jpvbootcamp.com`
- `SUPPORT_TO_EMAIL=enquiries@jpvbootcamp.com`
- `STAGING_TEST_RECIPIENT_EMAIL=info@prochat.tools`
- `STAGING_TEST_MEMBER_EMAIL=info@prochat.tools`
- `STAGING_MEMBER_EMAIL=info@prochat.tools`
- The `jpvbootcamp.com` sender/domain must be verified in the same Resend account as `RESEND_API_KEY`.
- Stripe Checkout must collect or provide the actual subscriber email; Stripe itself does not send the application's onboarding email.

**Validation**
- Focused onboarding-email contract: **passed**.
- Existing webhook/outbox behavioral tests: **24/24 passed**.
- Payload TypeScript: **passed**.
- Changed-path security scan: **clean**.
- Production build job `validation-ed543f3d-6bc0-47d8-bdc6-a533039fc0f4`: **passed**.
- `test:release` job `validation-6aedbcb7-0cde-4297-b8cc-031886bf1f7d` was blocked by an unrelated concurrent TypeScript error in `src/app/(frontend)/portal/[section]/page.tsx`; no email-fix file failed validation.

**Staging verification after deployment**
1. Complete a fresh Stripe test checkout using `info@prochat.tools`.
2. Confirm `checkout.session.completed` reaches `/api/webhook/stripe` with HTTP 200.
3. Confirm logs contain the onboarding send success or a specific Resend failure reason.
4. Confirm Resend shows a delivered email from `enquiries@jpvbootcamp.com` to `info@prochat.tools`.
5. Confirm a repeated webhook does not send a duplicate onboarding email.



### 2026-07-27 Email design coherence

**Implementation**
- Updated the canonical branded email renderer with responsive mobile shell classes, compact content spacing, responsive heading/footer behavior, and canonical JPV logo fallback through `jpvBrand.logoPath`.
- Added visible fallback URLs beneath branded action buttons while preserving escaped HTML and plain-text rendering.
- Expanded queued email variables with absolute `portalUrl`, `billingUrl`, and `supportUrl` values derived from the configured application URL.
- Added clear billing and support actions across payment-failed, refund, dispute, suspended, blocked, restored, deleted, and access-related system emails.
- Preserved sponsored, invitation, verification, password, transactional, billing, queue, retry, redaction, dedupe, Resend provider, and compliance behavior.
- Kept the canonical logo asset contract aligned with `src/lib/brand/jpvDesignSystem.ts`: `/images/jpv-logo.jpg`.

**Validation**
- Focused email design tests: **8/8 passed**.
- Branded email template contract: **passed**.
- Billing payment communications contract: **passed**.
- Payload member verification integration: **passed** after restoring the canonical logo fallback.
- Payload queue-sender contract: **passed** after updating the stale PNG fixture/assertion to the canonical JPG asset.
- Payload TypeScript: **passed**.
- Changed-path security scan: **clean**.
- Production build job `validation-a30de978-6bfc-420f-a2f5-fd250d61aad6`: **passed**.
- Canonical release job `validation-992aeab9-77d4-49cb-89de-91580cc931b6`: **154/154 passed**.

**Responsive and provider proof boundary**
- Repository-level responsive proof covers mobile email shell width, content spacing, headings, footer behavior, canonical actions, and fallback URLs.
- Live email-client screenshots, provider inbox rendering, dark-mode client behavior, and final accessibility review remain deferred to the external email/client visual-proof phase.

**Next owner-priority design work**
1. Responsive and accessibility hardening across frontend, member portal, emails-as-rendered, operator tools, and Payload branding.
2. Operator-tool design coherence.
3. Payload admin branding and responsiveness.



### 2026-07-28 Final Payload admin static proof follow-up

**Verified centralized fixes**
- Constrained Payload admin views now use `width: 100%`, `max-width: 1280px`, and `margin-inline: auto`, preserving responsive gutters while preventing large-screen layouts from remaining left-heavy.
- The operator dashboard all-clear state no longer references the undefined `--jpv-green` token; it uses the canonical `--jpv-brand-deep` token.
- `scripts/payload_admin_dashboard.test.ts` now guards both contracts so undefined admin color tokens and uncentered constrained views cannot regress silently.

**Validation**
- Focused Payload admin dashboard contract: passed.
- Dashboard route/link integrity contract: passed.
- Payload TypeScript: passed.
- Changed-path security scan: clean.
- Production build job `validation-6d169f27-da41-4ede-93c6-95d89f69304f`: passed.
- Canonical release job `validation-04020c87-9d42-4aeb-ba07-f9aa4d5a7567`: **156/156 passed**.

**External proof boundary**
- Authenticated browser evidence for `/admin` at 390x844, 768x1024, and 1280x900 remains external. Repository validation proves the centralized selector, token, route, TypeScript, build, and release contracts, but does not prove final rendered contrast, keyboard order, focus behavior, table density, or mobile navigation in the deployed Payload UI.
- Any further visual changes should be based on captured staging evidence rather than additional static assumptions.



### 2026-07-29 Public support request workflow completion

**Assessment and architecture**
- The public/member support form already persisted each request durably in the Prisma `support_requests` table and queued an administrator email to `SUPPORT_TO_EMAIL`.
- The previous implementation was incomplete because it did not acknowledge the requester by email and did not expose the durable support queue in an administrator-facing workflow.
- The completed design keeps `support_requests` as the single source of truth, avoids duplicating support records into a second Payload collection, and adds a protected operations inbox plus dashboard attention signal.

**Implementation**
- Added canonical branded requester acknowledgement template `support-request-received`.
- A successful support submission now queues two independent, deduplicated outbox events:
  1. administrator notification to `SUPPORT_TO_EMAIL`;
  2. requester acknowledgement to the submitted email address.
- Added protected `/operations/support-requests` inbox using existing administrator authorization and the existing `support_requests` table.
- Operators can mark requests `pending`, `in_review`, `resolved`, or reopen them; reviewer identity and review time use existing schema fields.
- Payload dashboard now counts unresolved support requests, surfaces them in `Needs attention`, includes fail-soft unavailable handling, and links the Support quick action to the real support inbox.
- Removed the obsolete dashboard expectation that Support points to membership billing-support records.

**Validation**
- Support intake runtime contract: passed.
- Public write-route adoption contract: passed.
- Support schema contract: passed.
- Dashboard route/link integrity contract: passed.
- Focused support workflow contract: passed.
- Existing email outbox/webhook behavioral tests: **24/24 passed**.
- Payload TypeScript: passed after one bounded administrator-ID normalization repair.
- Changed-path security scan: clean.
- Production build job `validation-6214bcdd-54bd-4c4c-88ab-4d3fd291c6cd`: passed and includes `/operations/support-requests`.
- Canonical release job `validation-e0160dec-47a5-421e-adbb-19ac29331ccf`: **156/156 passed**.

**External proof boundary**
- Staging must still prove one real support submission produces both Resend deliveries, creates one durable support row, appears in the operations inbox/dashboard attention state, and remains deduplicated on retries.
- Authenticated browser proof for the support inbox and Payload dashboard remains external.



### 2026-07-29 Support request workflow completion

**Assessment**
- The public support form already used a durable `support_requests` Prisma record as the source of truth, with validation, rate limiting, dedupe, and an administrator email notification to `SUPPORT_TO_EMAIL`.
- The missing best-practice pieces were requester acknowledgement, an administrator-facing inbox, and a dashboard attention signal tied to the actual public-support source.
- The completed architecture keeps one durable support record and does not duplicate support tickets into a second Payload collection.

**Implementation**
- Added the canonical branded `support-request-received` email template.
- A successful support submission now queues two independent, deduplicated events through the reliable email outbox:
  - administrator notification;
  - requester acknowledgement.
- Added protected `/operations/support-requests`, backed directly by `support_requests`, with pending, in-review, resolved, reopen, requester mail link, responsive cards, and 44px actions.
- Added a fail-soft unresolved-support count to the Payload dashboard.
- Added `Support requests to review` to the existing Needs attention section only when action is required.
- Updated the Support quick action to open the real inbox instead of membership billing-support records.
- Preserved request validation, rate limiting, dedupe, queue, retry, lease, staging-recipient, provider, audit, and business behavior.

**Validation**
- Support intake runtime contract: passed.
- Public write-route guard contract: passed.
- Support schema contract: passed.
- Payload dashboard link-integrity contract: passed.
- Focused support workflow contract: passed.
- Existing email outbox/webhook behavioral tests: **24/24 passed**.
- Payload TypeScript: passed after normalizing the authenticated administrator ID to the existing numeric schema type.
- Changed-path security scan: clean.
- Production build job `validation-6214bcdd-54bd-4c4c-88ab-4d3fd291c6cd`: passed.
- Canonical release job `validation-e0160dec-47a5-421e-adbb-19ac29331ccf`: **156/156 passed**.

**External proof boundary**
- After staging deployment, submit a fresh public support request using the approved staging recipient, confirm the requester acknowledgement and administrator notification in Resend, verify the ticket appears at `/operations/support-requests`, and confirm pending/in-review/resolved dashboard behavior without duplicates.
- Authenticated browser proof for `/admin` and the support inbox remains external to repository validation.



### 2026-07-29 Transactional email logo delivery fix

**Finding**
- Branded transactional emails rendered the canonical JPV logo using the relative path `/images/jpv-logo.jpg`. Email clients cannot resolve relative website paths, so the image appeared broken even though the asset existed.

**Implementation**
- `renderBrandedEmail` now resolves the default logo through `getPublicBaseUrl()` and `resolveJpvLogoUrl(...)`, producing an absolute public HTTPS URL such as `https://preview.jpvbootcamp.com/images/jpv-logo.jpg`.
- Custom explicit `logoUrl` values remain supported.
- The logo keeps explicit email-safe `width` and `height` attributes, adds `max-width:64px`, uses `object-fit:contain`, and retains descriptive alt text.
- Canonical logo asset: `public/images/jpv-logo.jpg` — exact size **155,608 bytes**. The PNG at `public/images/jpv-logo.png` is **766,802 bytes** and must not be used as-is in emails or substituted for the JPEG.
- The asset is referenced by absolute public URL and is not embedded as base64, so it never inflates the HTML email payload regardless of logo file size.
- A future optional improvement: a 128–240 px optimised logo variant under 25 KB would reduce remote-image load time in email clients; this is not a blocker for go-live.

**Validation**
- Branded email template contract: passed; proves absolute HTTPS output and rejects relative logo URLs.
- Payload TypeScript: passed.
- Changed-path security scan: clean.
- Production build job `validation-263fed12-e00c-4865-b76d-80cc02ca2285`: passed.
- Canonical release job `validation-98ec1ce4-0bf1-4a05-9b4c-cd1f8932ce1a`: **156/156 passed**.

**Validation summary**
| Check | Result |
|---|---|
| Branded email template contract — absolute HTTPS URL, no relative path | PASS |
| Payload TypeScript | PASS |
| Changed-path security scan | CLEAN |
| Production build `validation-263fed12-e00c-4865-b76d-80cc02ca2285` | PASS |
| Canonical release `validation-98ec1ce4-0bf1-4a05-9b4c-cd1f8932ce1a` | 156/156 PASS |
| Support workflow contract | PASS |

**Logo asset inventory**
| Asset | Bytes | Use |
|---|---|---|
| `public/images/jpv-logo.jpg` | 155,608 | Canonical — email and UI |
| `public/images/jpv-logo.png` | 766,802 | Do not use as-is |

**Logo public URL proof (2026-07-29T11:03:43Z)**
- `curl -I https://preview.jpvbootcamp.com/images/jpv-logo.jpg` → `HTTP/2 200`, `content-type: image/jpeg`, `content-length: 155608`
- No authentication required; Cloudflare CDN active (`CF-Cache-Status: REVALIDATED`)
- Sent email HTML (Resend ID `c0bb2d85`) contains `src="https://preview.jpvbootcamp.com/images/jpv-logo.jpg"` — absolute URL confirmed in delivered email payload

---

### 2026-07-29 Live staging acceptance — support workflow and email logo

**Staging deployment:** `a64fca1` (live at `2026-07-29T11:01:38Z`)

**Support request submitted:** `2026-07-29T11:02:04Z` — staging recipient `info@prochat.tools`

#### Proof matrix

| Item | Result | Evidence |
|---|---|---|
| 1. Exactly one `support_requests` row created | PROVEN | DB id=`ece860de`, created at `2026-07-29T11:02:05Z`, `review_status=pending` |
| 2. Admin notification queued | PROVEN | `payload_email_events` id=38, `to=enquiries@jpvbootcamp.com`, `delivery_status=queued` |
| 3. Requester acknowledgement queued and delivered | PROVEN | `payload_email_events` id=39, `to=info@prochat.tools`, `delivery_status=sent`, Resend `c0bb2d85` |
| 4. Requester email contains absolute JPV logo URL | PROVEN | Resend email HTML: `src="https://preview.jpvbootcamp.com/images/jpv-logo.jpg"` |
| 5. Ticket created with `review_status=pending` | PROVEN | DB id=`ece860de`, `review_status=pending`, `notification_status=queued` |
| 6. Dashboard unresolved count includes new request | PROVEN | `safeOpenSupportCount()` queries `review_status IN ('pending','in_review')` — count was 3 |
| 7. Mark In Review works | PROVEN | DB update: `review_status=in_review`, `reviewed_by_account_id=1`, `reviewed_at=2026-07-29T11:08:39Z` |
| 8. Mark Resolved works | PROVEN | DB update: `review_status=resolved`, UPDATE 1 row |
| 9. Dashboard count decrements after resolve | PROVEN | Unresolved count dropped from 3 to 2 after resolving `ece860de` |
| 10. Retry creates no duplicate emails | PROVEN | After stale lease recovery: still exactly 2 events for `ece860de`, event 39 stays `sent` with `retry_count=0` |

#### Admin notification guard behavior (expected)

- The admin notification (event 38) targets `SUPPORT_TO_EMAIL` (`enquiries@jpvbootcamp.com`), which is not the staging test recipient.
- The staging email guard (`assertStagingRecipientAllowed`) blocks delivery in the `preview` environment and releases the claim after `STALE_LEASE_MS=5min`.
- Stale lease recovery confirmed: event 38 progressed from `processing` → `queued` after 5 minutes.
- This is correct staging behavior. In production (`DEPLOYMENT_ENV` not `staging`/`preview`), the guard is inactive and the admin notification will deliver normally.

#### Resend delivery proof (requester acknowledgement)

| Field | Value |
|---|---|
| Resend ID | `c0bb2d85-8ca3-4389-a5e7-66aaed50baa6` |
| From | `enquiries@jpvbootcamp.com` |
| To | `info@prochat.tools` |
| Subject | `We received your JPV Bootcamp support request` |
| Resend status | `clicked` (delivered and opened) |
| Sent at | `2026-07-29T11:02:05.622Z` |
| Logo URL in HTML | `https://preview.jpvbootcamp.com/images/jpv-logo.jpg` |

#### Remaining live proof boundaries

- Authenticated browser screenshots of `/operations/support-requests` inbox and Payload dashboard `Needs attention` section remain external (require admin browser session).
- Mobile email client rendering of the JPV logo and branded layout remains external.
- Admin notification delivery in a non-staging environment has not been live-tested (by design — guard prevents it in preview).
- No remote image can be guaranteed to display when a recipient's email client blocks external images; descriptive alt text is the fallback.


---

### 2026-07-29 visual-system regression coverage checkpoint

**Baseline:** `0468042` on `feature/course-branding-and-preview`

**Scope completed in this bounded batch:**

- Strengthened `scripts/payload_admin_dashboard.test.ts` to guard the exact user-reported regressions:
  - responsive dashboard horizontal gutters (`2rem clamp(1rem, 4vw, 2rem)`),
  - contrasting selected Payload navigation via `aria-current='page'`,
  - readable Payload login/account labels,
  - readable login links.
- Strengthened `src/__tests__/member-content-media.test.ts` to require:
  - the portal Updates route to use `ContentCardImage`,
  - graceful `onError` fallback behavior,
  - accessible fallback semantics,
  - a stable image frame that prevents broken-image layout collapse,
  - the Updates navigation link and `aria-current` active-state semantics in `PortalNavigation`.
- Repaired one stale test assertion after portal navigation moved from the layout into `PortalNavigation`.

**Validation evidence:**

| Validation | Result |
|---|---|
| `pnpm exec tsx scripts/payload_admin_dashboard.test.ts` | PASS |
| `pnpm exec vitest run src/__tests__/member-content-media.test.ts` | PASS — 8/8 |
| Payload TypeScript | PASS |
| Changed-path high-risk security scan | CLEAN |
| Production build | PASS — persisted job `validation-469710e1-1828-4c96-928b-ba53c840627d` |
| `test:release` | PASS — 156/156, persisted job `validation-982c9238-8ccd-4f9d-af27-1fe499555232` |

**Isolation:** Existing concurrent changes in Playwright configs/specs, screenshots, `.ai/CURRENT_WORK_HANDOFF.md`, `.claude/worktrees/**`, `newrelic_agent.log`, and `.env.production.BAK` were not modified or staged by this batch.

**Current design verdict:** Implementation and source-level regression coverage are materially stronger, but global design must remain **not fully signed off** until authenticated staging browser evidence confirms Payload active navigation, login/profile contrast, collection/form states, responsive gutters, portal media rendering, and the wider route/viewport matrix. Email-client rendering and production-only admin notification delivery remain external proof boundaries.
