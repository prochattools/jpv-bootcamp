# Payload CMS Integration Plan

This is the single canonical product, architecture, security, roadmap, and execution plan for the JPV Bootcamp Payload programme. Code and operational changes must follow this plan in order. Update this document before changing architecture, security, product boundaries, rollout order, or production responsibilities.

## Documentation hierarchy

1. **Canonical plan — this document.** Owns philosophy, architecture, security, current status, roadmap order, validation gates, and cutover boundaries.
2. **Feature specifications.** Define implementation detail without changing roadmap order:
   - `docs/PAYLOAD_COMMUNICATIONS_PLAN.md` — branded communications, FreeResend delivery, templates, events, preferences, audit, and acceptance criteria for Phase 6.
   - `docs/PAYLOAD_SUPPORT_PAY_IT_FORWARD_PLAN.md` — support credits, sponsored access, applicant review, expiry, receipts, and administrator controls for the Free/Pro access model.
   - `docs/PAYLOAD_PARTNER_AFFILIATE_PLAN.md` — detailed Partner Affiliates specification for Phase 9.
   - `docs/LIVEKIT_PAYLOADCMS_GROUP_CALLS_PLAN.md` — future group-call use cases, LiveKit runtime architecture, PayloadCMS collections and authorization boundary, security, privacy, and acceptance gates for Phase 11.
3. **Visual reference.** `docs/PAYLOAD_COURSE_VISUAL_IMPLEMENTATION_PLAN.md` illustrates screens and workflows but does not replace this plan.
4. **Client truth document.** `docs/client/JPV_BOOTCAMP_GO_LIVE_PLAN_V3_4_SUMMARY.md` is the current client-plan progress summary. Version 3.3 remains the prior baseline. It supersedes the older Version 2.40 progress framing and must stay aligned with this internal plan.
5. **Client document inventory.** `docs/client/README.md` records which client-facing document is current and which older documents are historical.
6. **Platform invariants and operations.** `docs/PROKIT_OVERVIEW.md`, `docs/PROKIT_INVARIANTS.md`, and infrastructure documents define stable operational contracts.

Do not create another general Payload roadmap. New work must first be added here as a phase or deliverable. Create a feature specification only when the detailed workflow, privacy, migration, or acceptance material would make this canonical plan harder to use.

## Public naming and white-label contract

- The public product name is **JPV Bootcamp**.
- The administrator back office is **JPV Bootcamp Portal**.
- Students, clients, and other external users must not see **Payload**, **Payload CMS**, internal collection names, or service internals in pages, help text, emails, or client-facing documentation.
- Payload may remain in source code, internal technical documentation, migrations, and operations notes.
- Administrator branding uses supported `admin.meta` and `admin.components.graphics` configuration.
- Client-facing email uses one JPV Bootcamp white-label design delivered through the existing FreeResend service.

## Philosophy

- Build one coherent application rather than parallel member systems.
- Keep public, administrator, and member surfaces separate.
- Treat identity, authorization, entitlements, privacy, communication, and auditability as product foundations.
- Keep this feature branch Payload-only; removed external community, CRM, and portal integrations must not remain as active code, transition wiring, rollback docs, or archive material here.
- Prefer small, demonstrable phases over broad rewrites.
- Keep Payload as the administrative system of record and Next.js as the controlled member experience.
- Treat historical data only as reviewed import material that maps into neutral account, Free access, Pro subscription, expired, revoked, suspended, or administrator-review states.
- Keep the public offer simple: Free for approved non-paid access and Pro for the single paid subscription.

## Version 3.4 platform direction and terminology

Version 3.3 remains the historical baseline, but the current client-plan update is Version 3.4. The finish line is no longer only a minimal course-area replacement. It is a phased commercial platform launch with public offer clarity, billing automation, support/pay-it-forward access, public landing-page readiness, representative 8-week course content, partner tracking, community previews, migration rehearsal, and go-live controls.

Canonical product terminology:

- **Free** — non-paid access state for approved support, pay-it-forward recipients, staff/test access, or other administrator-created access. Free may exist in the system and in administrator reporting, but it is not the main public sales offer.
- **Pro** — the single paid JPV Bootcamp subscription. Public copy should describe Pro with two payment options: monthly with a 12-month commitment, and annual upfront with the approved annual discount.
- **Historical tiers** — old paid and non-paid labels are migration inputs only. They must be mapped into Free, Pro, expired, revoked, suspended, or administrator-approved access states before cutover.

The v3.3 readiness baseline (set at start of branch): expanded-platform readiness was about 58% overall, first core go-live readiness about 62%, carried-forward build foundation readiness about 78%, and expanded launch readiness about 52%. After the Payload-only Free/Pro refit and status-documentation hardening completed on 8 July 2026, current estimates are: expanded-platform ~73%, core staging readiness ~97%, build foundation ~89%, testing/release readiness ~94%, migration readiness ~55%, live cutover readiness ~20%. See `docs/client/ROADMAP_PROGRESS_STATUS.md` for full delta evidence. Older v2.40 progress numbers may be cited only as historical context for the narrower scope.

## Final architecture

| Surface | Route | Audience | Purpose |
|---|---|---|---|
| Public website | `/` | Everyone | Marketing, pricing, public content, and member portal entry |
| Administrator back office | `/admin` | Verified administrators | Content, members, access, billing, community, affiliates, audit, operations, and health triage |
| Member/student portal | `/portal` | Verified members and students | The single member-facing entry point for sign-in, Free access, Pro subscription, courses, community, account, billing, and partner activity |
| Compatibility redirects | `/login`, `/learn/login`, `/register` | Existing links and tests | Preserve older links but direct users toward the simpler `/portal` member flow |

Administrator accounts and member identities are separate security domains, even when one person holds both. Members never receive administrator access merely because they have an active member record. The product rule is intentionally simple: humans see two sign-in doors only — `/admin` for operators and `/portal` for students/members. Supporting routes may exist for compatibility, but new navigation should point members to `/portal`.

### Route and dashboard design rationale

Mature learning platforms separate operator work from learner work. Moodle’s dashboard pattern centers course overview, deadlines, and activity blocks rather than raw navigation lists; Canvas exposes course progress, reports, and analytics for instructors/admins; commercial platforms such as Thinkific/Kajabi separate owner/admin capabilities from learner-facing access and commerce operations. JPV Bootcamp follows the same principle with fewer surfaces: `/admin` should be an operational cockpit, and `/portal` should be the single member/student doorway.

Admin dashboard cards should therefore show decision-oriented signals first: platform errors, failed deliveries, active members, active subscriptions, pending partner applications, affiliate commission exceptions, upcoming course/call items, and recent community moderation needs. The dashboard should not primarily duplicate every collection card already present in the sidebar. Affiliates represent JPV’s tracking and commission side of member acquisition. Partners represent third-party organizations or destinations that receive applications/leads. They can share a navigation group, but their collection names and dashboard descriptions must make this distinction clear.

### Member authentication and Free/Pro access contract

`/admin` is the only administrator login. `/portal` is the canonical member/student entry point and must support sign in, forgot password, resend-verification paths, Free access where approved, and Pro subscription self-service. `/portal?mode=login` renders the member sign-in surface without tripping the portal auth gate. `/register` and `/portal?mode=register` are compatibility routes for Free access creation or support/pay-it-forward intake only where the business rule explicitly allows it; they must not present competing paid tiers. `/login` and `/learn/login` are transitional shared/member routes only; preferred behavior is to redirect or link into `/portal?mode=login`.

Public paid access is **Pro** only. Pro must have two payment options: monthly with a 12-month commitment, and annual upfront with the approved annual discount. Free remains a controlled access state for approved support, pay-it-forward, staff/test, or administrator-created access. Registration or support intake creates a pending member and requires email verification before sign-in. Successful copy must clearly state whether the account is pending Free access, awaiting support review, or ready to upgrade to Pro. Duplicate-account copy must guide the user to sign in or resend verification without ambiguous eligible-account language.

### Partner and affiliate domain language

Affiliates are the internal referral and commission programme: referral codes, referred members, commission rows, payout state, and administrator review. Partner Affiliates are external partner organizations or destinations: partner profile, application mode, recipient emails, trusted destination or webhook, public partner applications, and operations handoff. They share an operations group because the workflows meet at acquisition and reporting, but they are not duplicate collections.

### Staging-only partner schema recovery

The `jpvbootcamp_staging` schema may be repaired, reconciled, or reset for staging validation when explicitly authorized. The true production database, `public` schema, and any non-staging schema remain outside this boundary. Partner schema drift must be corrected by reviewed Payload migrations that derive the active schema from `DATABASE_URL`/runtime configuration and do not hardcode production schema names.

## Binding security rules

1. Authorization is enforced server-side and fails closed.
2. Hidden navigation is usability only, never authorization.
3. Every protected route, API operation, mutation, and file request verifies identity and required access.
4. Member sessions cannot be accepted as administrator sessions.
5. Password onboarding and recovery use expiring links. Plaintext passwords are never emailed.
6. Secrets, tokens, reset codes, payment credentials, and private file URLs are never exposed to clients or logs.
7. Stripe remains authoritative for payment state; verified webhooks are idempotent.
8. FreeResend delivery events are verified before changing message delivery state.
9. Production schema and traffic changes require explicit approval.

## Current implementation status — 8 July 2026 (Version 3.4 update)

Current operator branch: `feature/course-branding-and-preview`.
Verify the exact branch tip with `git log --oneline -1` before operator action.
No migrations have been applied.
Do not touch `main`.

### Implemented and manually demonstrated

- Preview deployment runs from `feature/course-branding-and-preview`.
- Payload administrator area is available at `/admin`.
- Administrator navigation is grouped by Administration, Courses, Members & Access, Partners & Affiliates, Billing, and Community.
- Administrator and member records are separate.
- Course, lesson, entitlement, progress, community-read, billing-mirror, affiliate-reporting, and protected-resource foundations exist.
- Protected files are served through guarded server routes.
- Runtime database-schema isolation was repaired for staging migrations.
- Normal application requests no longer auto-run reviewed Payload migrations.

### Implemented account-security foundation

- Shared role decision and safe redirect rules exist.
- Member portal pages exist at `/portal` and related routes.
- Member records and account status exist.
- Affiliate collections and administrator summaries exist.
- JPV administrator branding components exist in source.
- Queued Payload email events, system templates, Resend-compatible delivery, and account-action-token services exist for member account-security mail.
- Member email verification, invitation, set-password, forgot-password, reset-password, password-change confirmation, pending email change, email-change confirmation, blocked-account notice, and restored-account notice are implemented in source and wired to the normal application routes and services.
- Account-action tokens are purpose-bound, digest-only, expiring, single-use, and consumed through the reviewed atomic SQL helpers.
- Preview release automation separates ordinary branch validation from image publication, migration authorization, provider authorization, deployment authorization, and smoke verification.

### Remaining validation or rollout boundaries

- Ordinary member credential flows now use JPV-branded login, set-password, forgot-password, reset-password, account, and email-change surfaces.
- Invitation, verification, set-password, reset-password, password-change confirmation, email-change confirmation, email-changed notices, blocked notices, and restored notices queue through `payload_email_events`.
- Member logout, blocked/suspended states, recovery journeys, queued delivery, account-security audit, route safety, migration source, sender behavior, type-check, and production build have automated local validation.
- Preview runtime verification is still pending until the target preview environment is confirmed, a recoverable preview database backup or snapshot is verified, the required Payload migrations are applied, the feature-branch commit or immutable image is deployed, and one controlled real-provider verification email/token flow succeeds.
- Required Payload migrations must be applied in this exact order:
  1. `20260701_201500_member_email_verification`
  2. `20260702_001500_member_account_action_purposes`
- Real-provider acceptance remains pending until preview provider credentials, sender identity, controlled test recipient, deployment access, and preview database ownership/backup evidence are available to the approved operator.
- 2 July 2026 Codex stop point: Phase 6 account-security email implementation, local validation, branch push, and feature-branch GitHub validation completed. Preview migration, deployment, and real-provider verification remain blocked.
- 3 July 2026 Haiku stop point — Phase 7, Phases 2-4 completed:
  - Billing portal identity now server-derived (security hardened);
  - Sensitive logs removed (member IDs, customer IDs, session IDs);
  - Subscription projection fields added to schema (not executed);
  - Subscription sync now persists state to CustomerProvisioning;
  - Billing summary UI added (shows plan, status, renewal date, cancellation);
  - Type-check and build validated;
  - Next slice: billing communications, payment failure handling, cutover validation.
- The reviewed Payload migration inventory is now unified in code and release policy; the eleven reviewed migrations are ordered canonically, with partner schema reconciliation last. The staging schema `jpvbootcamp_staging` has been explicitly verified with all ten prior reviewed Payload migrations marked ran (the two new 20260707 migrations are pending application).
- Partner/Affiliate staging schema drift was reconciled by `20260704_090000_partner_schema_reconciliation`; the missing Partner Affiliate recipient-email array table and Partner Application snapshot columns are present in staging.
- Duplicate admin login branding, portal-native member login mode, free-registration copy, operational admin dashboard cards, and clearer Affiliates vs Partner Affiliates admin descriptions are implemented in source and await deployment to staging.
- 4 July 2026 Haiku live acceptance pass — Phase 6 email acceptance preparation completed:
  - Phase 5 staging verification: free account registration creates pending member, queues email verification event;
  - Email readiness booleans added to `/api/health/deployment` for operator clarity;
  - Dokploy staging `DISABLE_NON_WEBHOOK_EMAILS` env var disabled (false) to enable provider email delivery;
  - Staged image redeploy confirms `readyForApply: true` in health endpoint;
  - Queued email sender enhanced with `--event-id` targeting and bulk-apply safety guard;
  - All focused tests pass (registration, auth, email verification, routes, deployment health);
  - Type-check and build clean, no legacy CMS references;
  - Email provider accept ready for next phase: one controlled verification-email send per operator authorization;
  - Login routing: all redirects working (`/login` and `/learn/login` → `/portal?mode=login`);
  - Admin branding: JPV Bootcamp Portal login verified;
  - Admin dashboard: operational cards present and linked;
  - Browser-based registration and verification link flow remains for manual operator test (same-origin security check on registration endpoint).
- Static preflight automation is available via `pnpm staging:static-preflight`; it is local-only and does not apply migrations, run live network checks, or prove operator approval.
- 5 July 2026 account recovery staging pass:
  - Controlled member row for `i***@yeshua.academy` exists exactly once, remains active and verified, and no longer has a lock timestamp blocking login;
  - Login failure was traced to account lockout/unknown password rather than verification, session, or portal routing;
  - Reset request and queued-email blockers were fixed in application code: email-event queue writes no longer rely on a non-unique conflict target, active account-action replacement uses the reviewed partial unique index safely, reset completion clears lockout state best-effort, and queued email send status now persists through the collection update path;
  - Staging preview health remains `application-only`/Docker with ten reviewed Payload migrations in inventory and email readiness `readyForApply: true`;
  - One controlled password-reset email was sent for the member account with event, recipient, provider ID, and action URL redacted from logs and reports;
  - Operator completed the newest reset flow on the preview domain, using the JSON reset API route and the Payload auth reset flow;
  - The custom reset action was consumed only after the password update path completed, the account stayed active and verified, login attempts remained below threshold, lockout no longer blocked login, and active reset actions were absent after completion;
  - Login with the newly set password was accepted and the member portal loaded without visible error text;
  - Visible portal evidence included the Member Portal dashboard, Dashboard/Courses/Community/Partners/Groups/Account/Billing navigation, the "Welcome back" dashboard, the JPV Bootcamp Foundations course card, and the sign-out control;
  - Non-blocking hardening follow-ups remain: `lastLoginAt` was not confirmed as set, the password-changed security event was not recorded, and the password-changed confirmation email was not queued/sent. These side effects do not block account recovery, login, or portal acceptance.
- 6 July 2026 account-security side-effect hardening:
  - Source fixes were committed in `8cd4f95161bfb418e6a37057d4f1a281ca3ba7bf` and deployed to the existing Dokploy staging app image `ghcr.io/prochattools/jpv-bootcamp:feature-course-branding-and-preview`;
  - Successful member session acceptance now records `lastLoginAt` best-effort after the shared login decision allows a member portal destination;
  - Successful password reset now records the `password_changed` security event after the Payload auth reset flow and lockout cleanup complete, then queues the password-changed confirmation email independently so audit or queue failures do not roll back the reset;
  - Local focused validation, feature-branch preview validation, and preview image publication passed for the hardening commit;
  - Staging health after redeploy returned 200 JSON with Docker/application-only runtime, ten reviewed Payload migrations in inventory, and email readiness `readyForApply: true`;
  - Live side-effect acceptance remains pending: a normal operator login is required to confirm `lastLoginAt` on staging, and another password-reset email/reset cycle requires separate explicit authorization before confirming the password-changed security event and confirmation email in staging.
- 6 July 2026 administrator logout boundary acceptance:
  - The existing Dokploy staging app was redeployed from `feature/course-branding-and-preview` after commits `742d7b2d18b3cda3b07820b0a20484418bfae138` and `3473e25fbe512963aae97fd9d505048d15a41c89`;
  - `/api/health/deployment` returned HTTP 200 with Docker/application-only runtime, ten reviewed Payload migrations in inventory, and email readiness `readyForApply: true`;
  - A member reaching `/admin` sees the unauthorized boundary and can use logout without looping back to the unauthorized page;
  - `/admin/logout` clears Payload-prefixed member auth cookies and redirects to the public preview admin login URL using the HTTPS preview origin;
  - The prior internal-host redirect regression is fixed: logout no longer sends operators to `http://0.0.0.0:3000`;
  - Operator acceptance confirms admin login works after logout, with no reported regression to member portal login;
  - Sanitized read-only metadata for `i***@yeshua.academy` still shows `lastLoginAt` not accepted after the hardening deployment, so that Phase 6 side-effect remains pending until one fresh successful member login is followed by sanitized inspection.
- 6 July 2026 member last-login live acceptance:
  - Source commit `e6e59eebae42f8269726f28501db88bea7932cc7` hardened the focused last-login metadata path by using the Payload database `updateOne` adapter after member eligibility is accepted, avoiding auth-collection update access as a blocker;
  - The existing Dokploy staging app was redeployed from `feature/course-branding-and-preview`, and `/api/health/deployment` returned HTTP 200 with Docker/application-only runtime, ten reviewed Payload migrations in inventory, and email readiness `readyForApply: true`;
  - Operator acceptance confirms a fresh member login for `i***@yeshua.academy` succeeded after the `e6e59ee` deployment, the portal loaded, and no visible error text was reported;
  - Sanitized read-only staging metadata confirms exactly one controlled member row, active status, verified email state, login attempts below threshold, no blocking lockout, and `lastLoginAt` set after the `e6e59ee` deployment;
  - Phase 6 `lastLoginAt` live acceptance is complete, with no reported regression to account recovery, member portal loading, the administrator unauthorized boundary, administrator logout, or administrator login.
- 7–8 July 2026 Payload-only Free/Pro refit and staging hardening (commit `80012b7`):
  - Active legacy integration paths removed: deleted plugin files, removed external-integration API routes/helpers, removed legacy upgrade route/helper/test, removed old smoke portal script;
  - Checkout refitted to Pro-only membership with monthly/annual billing; `plan=pro` is the only accepted public checkout plan;
  - Stripe config and readiness checks require Pro monthly and Pro annual identifiers only;
  - Payload access, billing, course, and generated type surfaces use Free and Pro labels only;
  - Support and pay-it-forward now grant controlled Free access; sponsored tier semantics corrected from Pro to Free;
  - Annual Pro Stripe shadow sync fixed; sponsored access provisioning fixed;
  - Preview migration inventory updated from 10 to 11 migrations (added `20260707_120000_rename_account_identity_columns` and `20260707_130000_remove_table_plan_from_payload_enums`);
  - Staging branch safety docs hardened; Dokploy API key literal removed from docs;
  - Validation: `git diff --check`, `tsc --noEmit`, `prisma validate` (both schemas), 68 focused tests pass, 0 fail;
  - Grep audit: zero active residue; allowed exceptions only (account-column rename DDL, negative old-price assertion, pnpm-lock.yaml libvips hashes);
  - No migrations applied; table-plan-to-Free mapping requires explicit target-environment approval before execution;
  - Remaining risks: `startMemberCheckout` swallows errors without logging the error object; `STRIPE_SUCCESS_URL` has no same-origin guard; checkout rejection coverage is static regex, not runtime route tests;
  - Roadmap progress status: `docs/client/ROADMAP_PROGRESS_STATUS.md`.

## Execution roadmap

### Phase 1 — Finalize the administrator boundary

**Status:** Implemented foundation; branding validation remains.

Tasks:

- serve administration only from `/admin`;
- reject non-administrators from administrator routes and APIs;
- group navigation by daily work;
- keep operational records available without dominating navigation;
- replace the Payload login logo and titles with JPV Bootcamp Portal branding;
- verify administrator login and logout.

Validation:

- administrator login succeeds;
- member and anonymous requests fail closed;
- direct collection URLs enforce access rules;
- the login screen shows JPV Bootcamp branding only.

### Phase 2 — Complete shared login and member authentication

**Status:** Source-complete; runtime rollout remains gated by the independent release approvals.

Tasks:

- provide a branded member login form at `/login`;
- authenticate members against the member auth collection;
- redirect administrators to `/admin` and members to `/portal`;
- keep administrator and member sessions isolated;
- complete member and administrator logout;
- handle blocked, suspended, unresolved, and conflicting identities safely.

Validation:

- an active member can sign in and reach `/portal`;
- a member cannot obtain an administrator session;
- blocked and suspended members receive no privileged access;
- redirect parameters cannot escape approved routes.

### Phase 3 — Complete the member portal shell

**Status:** Implemented foundation.

Tasks:

- finish `/portal`, courses, community, groups, account, and billing navigation;
- complete responsive, loading, empty, unauthorized, and error states;
- remove all Payload terminology from member pages;
- finish member-owned account summaries.

Validation:

- anonymous users redirect to `/login`;
- all portal data loads through server-side authorization;
- representative mobile and desktop journeys pass.

### Phase 4 — Complete course, group, and protected-resource access

**Status:** Implemented and validated foundation.

Tasks:

- finish course, module, lesson, community, and group checks;
- preserve Free, Pro, support/pay-it-forward, manual, suspended, expired, and revoked states;
- map historical access records into the new Free/Pro access model before cutover;
- finish grant/revoke administration and reconciliation;
- move private storage to production-suitable shared or object storage before cutover.

Validation:

- direct URLs and APIs cannot bypass access checks;
- entitlement changes take effect predictably;
- private assets never expose permanent public URLs.

### Phase 5 — Complete account and password workflows

**Status:** Implemented and locally validated; controlled preview account-recovery reset, login, and portal acceptance passed for the approved member account. Broader rollout remains gated by the independent release approvals and follow-up hardening noted below.

Implemented source tasks:

- secure member invitation;
- email verification;
- expiring set-password and reset-password links;
- member password change;
- profile and email-address update;
- account block, suspend, restore, and deletion workflows;
- administrator audit visibility.

Validation coverage:

- no plaintext password is stored, logged, or emailed;
- tokens are single-use and time-limited;
- blocked accounts lose portal access;
- sensitive changes require re-authentication or verification.
- focused route, account-action, email-verification, invitation, email-change, migration-source, sender, type-check, and production-build validation completed locally;
- preview activation requires Payload migrations in order: `20260701_201500_member_email_verification`, then `20260702_001500_member_account_action_purposes`;
- real-provider closure requires one controlled preview member email-verification delivery and accepted token flow; password-reset delivery may be checked only with an approved safe test account.
- controlled preview account recovery now has accepted evidence: reset completed on the preview domain, the consumed custom reset action indicates the Payload password update path completed first, login with the new password succeeded, and the portal dashboard loaded.
- non-blocking hardening remains for post-reset `lastLoginAt`, password-changed security-event recording, and password-changed confirmation email queueing.

### Phase 6 — Complete branded communications and FreeResend delivery

**Status:** Account-security communications are implemented and locally validated; broader billing, learning, community, partner, broadcast, preference, and unsubscribe communications remain planned.

Detailed specification: `docs/PAYLOAD_COMMUNICATIONS_PLAN.md`.

Communication foundation work now includes a typed registry, member preference defaults and sanitization helpers, and a signed unsubscribe-token validator for optional categories. Those pieces are intentionally pure and offline-only; Payload-backed member preference persistence, the member settings UI, mention resolution, notification queue wiring, digest planning, and admin queue visibility remain pending.

Tasks:

- connect Payload to the existing FreeResend service for account-security messages;
- use one JPV Bootcamp HTML and plain-text template system for account-security messages;
- add delivery records, bounded retries, safe provider-error handling, and administrator visibility for queued account-security delivery;
- implement account, verification, invitation, password, profile, and security messages;
- preserve provider execution as a separately authorized preview operation until real-provider acceptance is completed;
- implement purchase, subscription, payment, retry, cancellation, refund, invoice, billing-hold, and access-restored messages;
- implement enrollment, release, progress, completion, certificate, community, group, and moderation notifications;
- implement partner application, referral, commission, payout, delivery, and operational alerts;
- separate transactional, notification, and broadcast communication;
- add preference and unsubscribe handling for optional messages.

Validation:

- account-security Payload email events queue through the existing sender abstraction in local validation;
- authentication and password journeys have focused route/service validation;
- every account-security template has HTML and plain-text output;
- security links are server-generated, time-limited, purpose-bound, and environment-configured;
- optional messages respect preferences;
- provider events are verified and idempotent where the existing delivery pipeline applies;
- no client-facing message contains Payload branding.

### Phase 7 — Complete billing self-service

**Status:** Portal access, subscription/payment projection, checkout, failed-payment communications, access enforcement, refund/dispute handling, plan-change refinement, and offline billing readiness implemented; billing live verification remains pending.

Completed in this slice:

**Billing Portal Security (Phase 2):**
- Server-side authentication: server action `openBillingPortal` now derives member identity via `requirePortalMember` instead of trusting client input;
- Removed sensitive logging: member IDs, Stripe customer IDs, session IDs no longer logged;
- Client cannot provide member identity or return URL — both server-controlled;
- Safe error messages (categorized by type, not exposed to logs);
- BillingPortalButton component updated to call with no arguments;
- Portal page updated to pass no props.

**Subscription Projection (Phase 3):**
- Added 5 fields to CustomerProvisioning schema:
  - `stripePriceId` (Stripe price ID from subscription items)
  - `subscriptionStatus` (exact Stripe subscription status)
  - `subscriptionCurrentPeriodEnd` (current period end date)
  - `subscriptionCancelAtPeriodEnd` (cancellation flag)
  - `subscriptionUpdatedAt` (sync timestamp)
- Migration source created but not executed: `prisma/migrations/20260703_120000_add_subscription_projection/migration.sql`

**Subscription Sync (Phase 4):**
- `syncFromSubscription` now persists subscription state to CustomerProvisioning;
- All 4 upsert paths (skip, invalid plan, dry run, final) now store subscription data;
- Plan resolution and ACTIVE_STATUSES logic preserved;
- No email sending added to sync path (email remains separate);
- No additional Stripe retrievals (reuses subscription object).

**Billing Summary UI (Phase 4):**
- New helper: `src/lib/billing/billingStatusHelper.ts`;
- Reads member subscription state from CustomerProvisioning (no Stripe calls);
- Returns plan label, subscription status, period end date, cancellation flag, and active-subscription state;
- Portal `/portal/billing` now displays:
  - Current plan (human-readable label);
  - Subscription status (active, trialing, past_due, etc.);
  - Renewal or cancellation date;
  - Cancellation notice if scheduled;
  - Checkout options when no active subscription exists;
  - Manage billing when a billing account exists.

**Member Checkout (Phase 5):**
- Authenticated members can start Pro Stripe Checkout from `/portal/billing`, choosing either the monthly 12-month commitment option or the annual upfront option;
- Member identity, email, customer ownership, success URL, and cancel URL are derived server-side;
- Existing active, trialing, past-due, or unpaid subscriptions cannot create a duplicate checkout;
- Existing Stripe customers are reused; otherwise the authenticated member email is passed to Stripe;
- No database migration, Stripe request, deployment, or provider operation was executed during implementation.

**Failed-payment state and communications (Phase 6):**
- Verified `invoice.payment_failed` and `invoice.paid` events update a local CustomerProvisioning payment projection;
- Added payment status, failed/recovered timestamps, update timestamp, and last event/invoice identifiers;
- Additive migration source created but not executed: `prisma/migrations/20260703_130000_add_payment_state_projection/migration.sql`;
- `/portal/billing` shows a safe payment-needs-attention warning from local data only;
- One branded member failed-payment notice and one recovery notice are queued through `payload_email_events`;
- Dedupe keys are stable per invoice, so Stripe retries do not create duplicate notices or security events;
- Billing payment failure and recovery are recorded in `payload_member_security_events`.

**Subscription access enforcement (Phase 7):**
- Active and trialing subscriptions retain access and restore only Stripe-managed billing holds;
- `past_due`, `unpaid`, `billing_hold`, and canceled subscriptions place active members on a billing hold;
- Successful invoice recovery restores only members blocked for a known Stripe billing reason;
- Pending members are not automatically activated by Stripe;
- Manually blocked members keep their manual reason, and suspended or deleted members are never restored by Stripe;
- Hold and restoration transitions use the existing account-status service, audit records, security events, and queued access notices;
- Repeated events are idempotent: no duplicate hold or restoration action occurs when member state is already aligned;
- `/portal/billing` displays a safe local access state: available, on billing hold, inactive, or pending billing status.

**Refund and dispute state (Phase 7 slice):**
- Verified `charge.refunded`, `charge.dispute.created`, and `charge.dispute.closed` events update the local CustomerProvisioning payment projection;
- Added refund/dispute timestamps, dispute status, and last charge/payment-intent identifiers;
- Additive migration source created but not executed: `prisma/migrations/20260703_140000_add_refund_dispute_projection/migration.sql`;
- Payload payment records store refunded, disputed, and dispute-resolved states;
- One branded refund notice and one dispute-open notice are queued with stable charge/dispute dedupe keys;
- Refund, dispute-open, and dispute-resolution events are recorded in billing actions and member security events;
- Refunds and disputes do not block, restore, revoke, or grant access by themselves; subscription status remains authoritative;
- `/portal/billing` shows safe refund and open-dispute notices from local data only.

Remaining Phase 7 tasks:

- perform controlled preview verification for billing portal, webhook, checkout, and provider behavior;
- deferred billing work remains limited to preview-safe validation and any Stripe-side configuration checks discovered during that verification;
- billing live verification remains pending;
- email feature remains:
  - Code and automated validation complete;
  - Real email preview/provider acceptance still pending;
  - Payload migrations pending: `20260701_201500_member_email_verification`, `20260702_001500_member_account_action_purposes`.

Validation:

- Type-check: pnpm type-check:payload — passed;
- Build: pnpm run build — passed;
- Stripe remains authoritative (stored copy for UI only);
- client input cannot grant paid access (auth server-side);
- server-side identity derivation prevents spoofing;
- failed, unpaid, canceled, and recovered subscription states have defined, idempotent access outcomes; refunded and disputed payments are projected and communicated without changing access by themselves.

### Phase 8 — Complete community publishing and notifications

**Status:** Partial raw implementation complete; member community publishing is visibly functional end to end, while mentions, digest scheduling, richer editor/upload UX, and live preview acceptance remain deferred.

Tasks:

- member community feed and announcements;
- authorized publishing for community and private groups;
- text, images, video references, links, and documents;
- moderation and reporting;
- mentions, replies, announcements, group changes, digests, and preferences through Phase 6.

Validation:

- publishing permissions are explicit;
- private-group content cannot be fetched by unauthorized members;
- uploads enforce type, size, and ownership rules;
- optional notifications respect preferences;
- live preview acceptance and richer editor/upload UX remain deferred.

### Phase 9 — Complete partner affiliates and reporting

**Status:** Partial raw implementation complete; member application, delivery foundation, admin reporting, and affiliate summary journeys are now functional, while live provider verification, reconciliation, payouts, and preview acceptance remain pending.

Detailed specification: `docs/PAYLOAD_PARTNER_AFFILIATE_PLAN.md`.

Tasks:

- complete the partner directory;
- add authenticated member application and history;
- record applications before redirect or delivery;
- complete reports, CSV export, delivery modes, retries, and audit;
- add partner and affiliate communications through Phase 6;
- reconcile retained legacy partner records before cutover.

Validation:

- members read only their own applications;
- trusted destinations are never supplied by the browser;
- delivery is idempotent and retryable where implemented;
- administrators can filter and export authorized reports; live provider verification remains pending.

### Phase 10 — Shadow validation and cutover

**Status:** Read-only Payload snapshot reconciliation, the offline rehearsal matrix, and safe evidence validation/export are implemented; live migration, deployment, provider, reconciliation, preview acceptance, rollback rehearsal, and cutover approvals remain pending. Phase 10 is still incomplete until live staging evidence exists.

Before replacing any existing production flow:

1. Apply and verify reviewed migrations only in the approved environment.
2. Run identity, entitlement, billing, email, content, and partner reconciliation.
3. Test administrator and member journeys in isolation.
4. Test rollback without deleting production data.
5. Confirm monitoring, audit, support, delivery, and recovery procedures.
6. Obtain explicit approval for each cutover boundary.

Only then may an existing production responsibility be disabled or redirected.

### Phase 11 — Future community group calls with LiveKit

**Status:** Future feature; research and architecture defined, implementation intentionally deferred.

Detailed research and specification: `docs/LIVEKIT_PAYLOADCMS_GROUP_CALLS_PLAN.md`.

Product scope:

- scheduled audio/video calls linked to authorized community groups;
- server-derived room membership and host/moderator/attendee roles;
- LiveKit for real-time rooms, media, screen sharing, participant state, and lifecycle webhooks;
- PayloadCMS manages editable call-page content, scheduling, group relationships, attendance summaries, moderation state, and audit;
- Payload/member authorization remains authoritative for identity, group access, call records, attendance, moderation, and audit;
- recording, replay, captions, transcripts, and livestreaming require separate privacy and operational approval.

Validation:

- unauthorized members cannot discover or join private or secret group calls;
- LiveKit JWTs are short-lived, least privilege, and generated only by the backend;
- browser input cannot choose trusted participant identity, room, group, or role;
- webhook events are signature-verified and idempotent;
- no LiveKit secret, participant token, or private recording URL is stored in member-readable PayloadCMS fields or exposed in logs;
- representative desktop/mobile, accessibility, privacy, support, cost, monitoring, and rollback gates pass before rollout.

## Overall delivery status — 8 July 2026 (Version 3.4 update)

The roadmap now contains the original eleven technical phases plus the Version 3.4 client-plan update. Expanded-platform readiness is approximately **73% complete** overall (up from ~58% at the v3.3 baseline), with about **97% core staging readiness** for the feature branch (up from ~68%). The older v2.40 percentage remains historical evidence for the narrower course/staging scope only. See `docs/client/ROADMAP_PROGRESS_STATUS.md` for the full progress table and per-area delta evidence.

- **Carried-forward strong foundations:** administrator boundary, shared login, account security, member portal shell, course/access foundations, billing projection, community foundations, partner foundations, and staging evidence.
- **Core go-live scope:** public landing page, Free/Pro terminology refit, Pro checkout options, billing automation/recovery, representative 8-week course pilot, support/pay-it-forward access controls, migration rehearsal, rollback, and explicit go-live approval. The public front-end website milestone is 22 July 2026, the handover buffer is 23 July 2026, and the client-requested finished-by date is 24 July 2026.
- **Controlled follow-up releases:** richer partner reporting/delivery, community/private-room refinements, notifications/digests, private messaging if accepted, and later LiveKit group calls.
- **Primary remaining work:** refit old tier assumptions into Free/Pro, verify Stripe/payment paths, complete public copy/content by the 15 July 2026 client-input deadline, run representative course and storage acceptance, reconcile migration mapping, preview community/private-room behavior, verify partner links/forms/reports, rehearse rollback, and approve cutover.

## Communication scope summary

The approved communication system distinguishes:

- **Transactional:** account, security, billing, enrollment, access, and required operational messages.
- **Notification:** learning reminders, community activity, progress, and announcements.
- **Broadcast:** newsletters, promotions, events, and administrator-selected group messages.
- **Administrator:** invitations, role changes, reports, delivery failures, payment/webhook failures, security, and operations.
- **Member:** account, learning, billing, group, community, and partner activity.

The complete event inventory, recipient rules, content, action buttons, preferences, audit, retries, and delivery states are defined in `docs/PAYLOAD_COMMUNICATIONS_PLAN.md`.

## Migration and database guardrails

- Payload schema changes require generated types and reviewed migration output.
- Migrations must resolve the intended runtime schema and fail closed on invalid configuration.
- Normal application requests must not auto-apply reviewed migrations.
- Production writes require an explicit approved apply step.
- Existing production users, subscriptions, automations, content, and legacy flows remain intact until their cutover is approved.

## Validation gate for every phase

A phase is complete only when:

- the smallest relevant type check passes;
- focused authorization and business-rule tests pass;
- affected administrator and member journeys are manually verified;
- documentation and client progress status are updated;
- no secret or private data is exposed;
- migrations and provider events are reviewed where relevant;
- rollback or recovery is understood;
- explicit approval is recorded for production boundary changes.

## Immediate milestone

Align the current implementation with the Version 3.4 commercial-launch scope before production cutover: refit all public and billing language to Free/Pro, keep Pro as the only paid subscription, validate Pro monthly/annual checkout behavior, confirm support/pay-it-forward rules, prepare representative 8-week course content, confirm public landing-page copy, and rehearse migration from historical access states into the new Free/Pro access model. The front-end website go-live milestone is 22 July 2026, the internal handover buffer is 23 July 2026, the client-requested finished-by date is 24 July 2026, and the client content/input due date is Wednesday 15 July 2026. This milestone does not authorize migration execution. The first core go-live candidate remains the public landing page, Pro subscription, secure member portal, billing automation, account flows, course access, administrator controls, migration rehearsal, rollback, and explicit approval. Community/private-room previews and partner links/forms/reports should be included where accepted; private messaging, advanced notifications, payouts/webhooks, and LiveKit calls remain post-core unless explicitly marked launch-critical.

This slice hardens the repository-only candidate gate: rollback and packet drafts are generated from explicit local inputs, placeholder approvals are rejected, packet validation is bound to exact branch/HEAD/repository state, rehearsal checks come from the real smoke matrix, and no live operation has been authorized yet. The next required live step after this commit is branch push authorization.

## Definition of done

- Administrator and member areas are visibly and technically separate.
- Shared login sends every verified identity to the correct area.
- Members can learn, download allowed resources, and track progress.
- Account invitation, verification, setup, reset, profile, and security workflows are complete.
- All approved client-facing communication uses the JPV Bootcamp design and FreeResend delivery.
- Billing status, recovery, and payment communication are available to the correct member.
- Community publishing and notifications follow explicit permissions and preferences.
- Members can apply to approved partners and see their own history.
- Administrators can manage partners, inspect delivery, and export reports.
- A representative pilot passes the acceptance plan.
- Migration, reconciliation, rollback, and cutover are demonstrated and approved.
