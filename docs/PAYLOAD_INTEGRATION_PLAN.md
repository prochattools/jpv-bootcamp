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
4. **Client truth document.** `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_5.docx` is the current client go-live plan. Version 3.4 is the prior progress baseline. It supersedes older progress framing and must stay aligned with this internal plan.
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

## Version 3.5 platform direction and terminology

Version 3.4 remains the prior progress baseline, but the current client plan is Version 3.5. The finish line is a phased commercial platform launch with public offer clarity, billing automation, support/pay-it-forward access, public landing-page readiness, representative 8-week course content, partner tracking, community previews, migration rehearsal, and go-live controls.

Canonical product terminology:

- **Free** — non-paid access state for approved support, pay-it-forward recipients, staff/test access, or other administrator-created access. Free may exist in the system and in administrator reporting, but it is not the main public sales offer.
- **Pro** — the single paid JPV Bootcamp subscription. Public copy should describe Pro with two payment options: monthly with a 12-month commitment, and annual upfront with the approved annual discount.
- **Historical tiers** — old paid and non-paid labels are migration inputs only. They must be mapped into Free, Pro, expired, revoked, suspended, or administrator-approved access states before cutover.

The 10 July Version 3.5 codebase audit rebaselines current readiness after separating source presence, static prototypes, operational workflows, and accepted runtime evidence: expanded platform ~68%, core staging/code ~82%, build foundation ~86%, testing/release ~76%, migration ~55%, and live cutover ~20%. The lower figures are a measurement correction, not a code regression. See `docs/client/ROADMAP_PROGRESS_STATUS.md` and `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md` for evidence.

## Final architecture

| Surface | Route | Audience | Purpose |
|---|---|---|---|
| Public website | `/` | Everyone | Marketing, pricing, public content, and member portal entry |
| Administrator back office | `/admin` | Verified administrators | Content, members, access, billing, community, affiliates, audit, operations, and health triage |
| Member/student portal | `/portal` | Verified members and students | The single member-facing entry point for sign-in, Free access, Pro subscription, courses, community, account, billing, and partner activity |
| Compatibility redirects | `/login`, `/register` | Existing links and tests | Preserve older links but direct users toward the simpler `/portal` member flow |

Administrator accounts and member identities are separate security domains, even when one person holds both. Members never receive administrator access merely because they have an active member record. The product rule is intentionally simple: humans see two sign-in doors only — `/admin` for operators and `/portal` for students/members. Supporting routes may exist for compatibility, but new navigation should point members to `/portal`.

### Route and dashboard design rationale

Mature learning platforms separate operator work from learner work. Moodle’s dashboard pattern centers course overview, deadlines, and activity blocks rather than raw navigation lists; Canvas exposes course progress, reports, and analytics for instructors/admins; commercial platforms such as Thinkific/Kajabi separate owner/admin capabilities from learner-facing access and commerce operations. JPV Bootcamp follows the same principle with fewer surfaces: `/admin` should be an operational cockpit, and `/portal` should be the single member/student doorway.

Admin dashboard cards should therefore show decision-oriented signals first: platform errors, failed deliveries, active members, active subscriptions, pending partner applications, affiliate commission exceptions, upcoming course/call items, and recent community moderation needs. The dashboard should not primarily duplicate every collection card already present in the sidebar. Affiliates represent JPV’s tracking and commission side of member acquisition. Partners represent third-party organizations or destinations that receive applications/leads. They can share a navigation group, but their collection names and dashboard descriptions must make this distinction clear.

### Member authentication and Free/Pro access contract

`/admin` is the only administrator login. `/portal` is the canonical member/student entry point and must support sign in, forgot password, resend-verification paths, Free access where approved, and Pro subscription self-service. `/portal?mode=login` renders the member sign-in surface without tripping the portal auth gate. `/register` and `/portal?mode=register` are compatibility routes for Free access creation or support/pay-it-forward intake only where the business rule explicitly allows it; they must not present competing paid tiers. `/login` is the only remaining member-login compatibility route, and it should redirect or link into `/portal?mode=login`.

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

## Current implementation status — 10 July 2026 (Version 3.5 audit)

Current operator branch: `feature/course-branding-and-preview`.
Verify the exact branch tip with `git log --oneline -1` before operator action.
No migrations have been applied.
Do not touch `main`.

### Implemented foundations

- The staging target runs from `feature/course-branding-and-preview`.
- Payload administrator area is available at `/admin`.
- Administrator navigation is grouped by Administration, Courses, Members & Access, Partners & Affiliates, Billing, and Community.
- Administrator and member records are separate.
- Course, lesson, entitlement, progress, community, billing-mirror, affiliate-reporting, partner, and protected-resource foundations exist.
- Protected files are served through guarded server routes.
- Runtime database-schema isolation was repaired for staging migrations.
- Normal application requests no longer auto-run reviewed Payload migrations.

### Implemented security and release foundations

- Shared role decision, same-origin helpers, bounded account-action inputs, and safe redirect rules exist.
- Member portal pages, protected resource delivery, and community file delivery now live under `/portal`.
- Member records and account status exist.
- Affiliate collections and administrator summaries exist.
- JPV administrator branding components exist in source.
- Queued Payload email events, system templates, Resend-compatible delivery, and account-action-token services exist for member account-security mail.
- Member email verification, invitation, set-password, forgot-password, reset-password, password-change confirmation, pending email change, email-change confirmation, blocked-account notice, and restored-account notice are implemented in source and wired to the normal application routes and services.
- Account-action tokens are purpose-bound, digest-only, expiring, single-use, and consumed through the reviewed atomic SQL helpers.
- Release automation separates ordinary branch validation from image publication, migration authorization, provider authorization, deployment authorization, and smoke verification.

### Confirmed incomplete or contradictory surfaces

- `/admin/review/**` is a static operator prototype without an administrator-authentication check and must be protected or removed before public release.
- `/tos` and `/privacy-policy` still contain unrelated starter-product content and are indexed by the sitemap; canonical JPV `/terms` and `/privacy` pages already exist.
- The landing page says subscriptions can be canceled at any time, while the client truth is a monthly 12-month commitment; repository Stripe setup does not yet prove enforcement of that commitment.
- Support/pay-it-forward and partner-referral MVP forms validate in the browser and generate temporary references but do not persist or notify. They must not claim durable submission until wired to existing services.
- `/portal` is the only approved member route tree. Keep the removed legacy member namespace blocked by route ownership tests, browser coverage, and the repository invariant.
- All eight programme weeks and community-preview threads are placeholder data. The static admin review model is not operational evidence.
- Public write/email endpoints have inconsistent body limits, origin controls, rate limiting, redirect validation, and PII logging.
- `pnpm audit --prod` reports 26 production advisories, including three high-severity `undici` findings through Payload.
- The repository contains 96 script-style test files, but static preflight runs a subset and has no browser E2E or coverage gate.
- No migration, provider/email acceptance, complete staging smoke, rollback rehearsal, or final go-live approval exists.

Detailed evidence and task definitions: `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`.

## Hardening-first execution order

No new feature phase starts until the applicable hardening gate passes. Execute one task ID per clean change set and add focused tests in the same task.

| Priority | Task | Deliverable | Gate |
| --- | --- | --- | --- |
| P0 | H0-01 | Protect or remove the unauthenticated `/admin/review` prototype | Anonymous/member denial and administrator acceptance tests |
| P0 | H0-02 | Remove starter legal/template routes and fix sitemap/public copy | No reachable non-JPV copy; route/sitemap regression tests |
| P0 | H0-03 | Enforce the monthly 12-month commitment and align public/legal copy | Written billing decision, automated tests, controlled Stripe smoke |
| P0 | H0-04 | Disable false-success prototype forms, then connect them to durable services | Persist-before-success, idempotency, queue, and failure tests |
| P0 | H0-05 | Harden public write/email endpoints | Bounded input, abuse control, safe origin/redirects, redacted logs |
| P0 | H0-06 | Resolve high production dependency advisories | Clean/accepted audit plus build and Payload-admin smoke |
| P1 | H1-01 | Keep `/portal` as the sole member namespace | One implementation owner per member feature; invariant and route coverage block regressions |
| P1 | H1-02 | Add one complete release test command and browser E2E suite | CI runs critical unit, route, migration, build, and browser journeys |
| P1 | H1-03 | Replace static MVP status with persisted/accepted operational evidence | Course, community, submissions, and admin status use real services |
| P1 | H1-04 | Replace `PAYLOAD_SECRET` bearer reuse with scoped operator auth | Dedicated credential/session and negative tests |
| P1 | H1-05 | Add tested security headers and trim remote image allowlists | Public, portal, API, and admin header/browser checks |
| P2 | H2-01 | Remove unreachable starter/template code | Route/import allowlist proves deletions are safe |
| P2 | H2-02 | Break the community file/moderation import cycle | One-way dependency and unchanged focused behavior |
| P2 | H2-03 | Reduce broad trust-boundary casts and `overrideAccess` use | Narrow interfaces and explicit authorization reasons |

Execution detail, atomic GPT-5.4 mini work packets, file boundaries, dependencies, effort ranges, and acceptance criteria are in `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`. The broad H0/H1 IDs are outcomes; the `M0-*` and `M1-*` packet IDs are the executable change sets.

Schedule rule:

- 10-13 July: close M0-01 through M0-04, obtain the M0-05 billing decision, and complete dependency triage;
- 14-17 July: close M0-06 through M0-09 and M1-01 only if support intake is approved for core go-live;
- 18-20 July: complete the launch-scoped portal/content/release packets and capture approved smoke evidence;
- 21 July: formal go/no-go with zero unresolved P0 blockers.

This is approximately 6-9 reviewed engineering days before external approvals and content. It leaves little contingency but is more achievable than treating all six broad P0 outcomes as a three-day task.

## Execution roadmap

### Phase 1 — Finalize the administrator boundary

**Status:** Payload admin foundation and branding exist. Release blocker H0-01 remains because the separate `/admin/review` prototype is not administrator-protected.

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

**Status:** Canonical member routing now lives under `/portal`, including course, lesson, community, moderation, submission, and protected file ownership. H1-01 remains a hardening guardrail through invariant, route, and browser coverage so the removed namespace does not return.

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

**Status:** Strong service foundation with focused tests. Canonical `/portal` parity, representative content, shared/private storage acceptance, and runtime evidence remain incomplete.

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

**Status:** Account-security communications are implemented and locally validated. Public email/write endpoint hardening, provider acceptance, and broader billing, learning, community, partner, preference, and unsubscribe communications remain incomplete.

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

**Status:** Portal access, subscription/payment projection, checkout, failed-payment communications, access enforcement, refund/dispute handling, and offline billing readiness are implemented. The 12-month monthly commitment is not yet proven by Stripe behavior, public copy conflicts with it, and live verification remains pending; H0-03 is a release blocker.

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

**Status:** Payload-backed community services and tests exist under the older member route tree. Canonical `/portal/community` currently renders a local preview model with placeholder threads. Route consolidation, persisted-data acceptance, mentions, digests, richer editor/upload UX, and live acceptance remain incomplete.

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

**Status:** Partner application, delivery, reporting, and affiliate service foundations exist. The new partner-referral MVP is client-only and does not persist; it must be connected to the existing service before it is called operational. Live provider verification, reconciliation, payouts, and preview acceptance remain pending.

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

## Overall delivery status — 10 July 2026 (Version 3.5 audit)

The roadmap retains the eleven product phases but places the Version 3.5 hardening gate before unfinished feature work. Audited readiness is approximately **68% for the expanded platform**, **82% for core staging/code**, **86% for build foundation**, **76% for testing/release**, **55% for migration**, and **20% for live cutover**. These figures distinguish static prototypes from operational workflows and accepted runtime evidence. See `docs/client/ROADMAP_PROGRESS_STATUS.md` for the current status and `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md` for findings.

- **Carried-forward strong foundations:** Payload administration, shared login, account security, entitlement evaluation, billing projection, protected resources, migration controls, and staging-evidence tooling.
- **Core go-live scope:** public landing page, Free/Pro terminology refit, Pro checkout options, billing automation/recovery, representative 8-week course pilot, support/pay-it-forward access controls, migration rehearsal, rollback, and explicit go-live approval. The public front-end website milestone is 22 July 2026, the handover buffer is 23 July 2026, and the client-requested finished-by date is 24 July 2026.
- **Controlled follow-up releases:** richer partner reporting/delivery, community/private-room refinements, notifications/digests, private messaging if accepted, and later LiveKit group calls.
- **Primary remaining work:** close P0 security/public-copy/billing/submission/dependency blockers; consolidate the member route tree; add complete release and browser tests; complete public copy/content by 15 July; run representative course/storage acceptance; verify partner/community workflows; rehearse migration and rollback; and approve cutover.

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

Close the Version 3.5 P0 hardening gate before production cutover: protect operator surfaces, remove reachable template/legal residue, make Stripe behavior match the 12-month commitment, stop prototype forms from claiming persistence, harden public write endpoints, and resolve high dependency advisories. Then consolidate `/portal`, run the complete release/browser matrix, complete public copy/content by Wednesday 15 July 2026, and obtain evidence. The front-end website milestone is 22 July 2026, the handover buffer is 23 July 2026, and the client-requested finished-by date is 24 July 2026. Those dates do not authorize migration execution. Full platform cutover remains conditional on migration approval, rehearsal, rollback evidence, provider/email verification, staging smoke, and explicit go-live approval.

The next implementation task is M0-01 under H0-01 in `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`. No live operation or migration is authorized by this plan.

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
