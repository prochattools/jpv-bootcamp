# Payload CMS Integration Plan

## Current repository reconciliation — 2026-08-23

- **Working branch:** `feature/course-branding-and-preview`; starting committed tip `ae8c886d125200d94a8ee7aec005b6226a1304e0`. The cleanup documented in `docs/release/BRANCH_RECONCILIATION_2026-08-23.md` is currently uncommitted and must be included before a final cutover SHA is pinned.
- **Current source truth:** the feature branch is the authoritative implementation under review. The registry contains 36 migrations, ending with `20260820_000000_live_session_space`; the release-lead verified sanitized staging position is 36/36 applied with pending `[]`, and the current workflow checks that post-apply state read-only.
- **Local evidence:** after cleanup, `pnpm test:release` passed `164/164`, the focused browser set passed `60/60`, and full browser E2E passed `148/148` with 60 declared skips. The initial shared muted-token contrast defect and tracked sponsored-claim backup were corrected.
- **Live evidence boundary:** migration state is reconciled from the release-lead verified sanitized position; exact-SHA staging deployment, provider state, production schema, production deployment, and cutover approval were not reverified or changed by this reconciliation. Historical deployment/acceptance snapshots below remain audit evidence only.
- **Cutover plan:** use `docs/release/FUTURE_BRANCH_CUTOVER_PLAN.md`; do not rename, reset, or force-push `main`.
- **Current release dossier:** `docs/release/FINAL_PRE_PRODUCTION_RECONCILIATION_2026-08-23.md` is the authoritative reconciliation of implementation, documentation, branch, and evidence state. Long-form dated sections below remain design or historical records unless explicitly marked current.
- **Phase 9.5 current truth:** `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md` owns current implementation/release status; `docs/release/PHASE_9_5_FINAL_IMPLEMENTATION_BACKLOG_2026-08-23.md` owns the remaining completion work. This plan remains the architecture and implementation-plan authority.

## Historical staging checkpoint — 2026-08-19 (STAGING MIGRATION COMPLETE)

- **ONLY PERMITTED OPERATIONAL LANE:** branch `feature/course-branding-and-preview`; staging origin `https://preview.jpvbootcamp.com`; Dokploy slug `clients-jpv-bootcamp-app-tp9xrk`; Dokploy app ID `I_2Vukga3cc3ZhaG-mUzU`; PostgreSQL host `10.0.2.4`, port `5433`, database `jpvbootcamp`, schema `jpvbootcamp_staging`. No alternate target is permitted.
- **CURRENT DEPLOYED STAGING BASELINE:** SHA `abf43893dc3f9980cc8eadc997cd7935e86e614f`, deploy run 32352382852, deployed 2026-08-19.
- **IMPLEMENTED / VERIFIED:** all agreed launch-scope repository implementation complete: M0-01 through M0-09, M1-01 through M1-06, UI-01 design/branding, release/browser automation, migration inventory/preflight, email queue/guard, partner/sponsored boundaries, and account-action reservation/finalization. All 35 Payload migrations applied and verified on staging. Release manifest `164/164` gates passed. Legacy import 935/935 complete. Members 51 (12 active, 39 blocked). Staging email operational. Public media 24/24, private 25/25. Lesson resources 25/25 published. Playwright 84/0, admin-responsive 14/14, migration contract PASS. `DEPLOYMENT_ENV=staging` confirmed.
- **HISTORICAL STAGING ACCEPTANCE COMPLETE:** all gates were green at that checkpoint. No further staging work was required in that historical record; current staging still requires fresh exact-SHA verification.
- **PHASE RANKING (2026-08-20):** (1) Phase 8 — Member Portal Operationalization **COMPLETE**; (2) Phase 9 — LiveKit Group Calls (REQUIRED pre-cutover); (3) Phase 10 — production cutover only under separate explicit authorization; (4) Phase 11 — Partner Affiliates deferred post-cutover.
- **PRODUCTION OPERATION:** NOT performed, NOT authorized.
- **DEFERRED BY DESIGN:** M2-01 and Partner Affiliates remain outside the current agreed launch scope unless separately promoted.

This is the single canonical product, architecture, security, roadmap, and execution plan for the JPV Bootcamp Payload programme. Code and operational changes must follow this plan in order. Update this document before changing architecture, security, product boundaries, rollout order, or staging responsibilities.

## Documentation hierarchy

1. **Canonical architecture and implementation plan — this document.** Owns philosophy, architecture, security, roadmap order, validation gates, and cutover boundaries. Current Phase 9.5 status is owned by the linked current-truth document above.
2. **Feature specifications.** Define implementation detail without changing roadmap order:
   - `docs/PAYLOAD_COMMUNICATIONS_PLAN.md` — branded communications, FreeResend delivery, templates, events, preferences, audit, and acceptance criteria for Phase 6.
   - `docs/PAYLOAD_SUPPORT_PAY_IT_FORWARD_PLAN.md` — support funding, voucher-backed access, sponsored access, applicant review, expiry, receipts, and administrator controls for the single-membership model.
   - `docs/JPV_MEMBERSHIP_BILLING_AND_VOUCHER_ARCHITECTURE.md` — binding billing, voucher, pay-it-forward, migration, onboarding, and Bunny-only video architecture for the JPV Bootcamp Membership.
   - `docs/PAYLOAD_PARTNER_AFFILIATE_PLAN.md` — detailed Partner Affiliates specification for Phase 9.
   - `docs/LIVEKIT_PAYLOADCMS_GROUP_CALLS_PLAN.md` — future group-call use cases, LiveKit runtime architecture, PayloadCMS collections and authorization boundary, security, privacy, and acceptance gates for Phase 11.
3. **Visual reference.** `docs/PAYLOAD_COURSE_VISUAL_IMPLEMENTATION_PLAN.md` illustrates screens and workflows but does not replace this plan.
4. **Client truth document.** `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx` is the current client go-live plan. Version 3.4 is the prior progress baseline. It supersedes older progress framing and must stay aligned with this internal plan.
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
- Treat historical data only as reviewed import material that maps into neutral account, membership entitlement, non-paid access source, expired, revoked, suspended, or administrator-review states.
- Keep the public offer simple: one JPV Bootcamp Membership with monthly or annual billing; support, pay-it-forward, staff, test, and administrator-created access are not public product tiers.

## Version 3.7 platform direction and terminology

Version 3.4 remains the prior progress baseline, but the current client plan is Version 3.7. The finish line is a phased commercial platform launch with public offer clarity, billing automation, support/pay-it-forward access, public landing-page readiness, representative 8-week course content, partner tracking, community previews, migration rehearsal, schema-migration packaging, generated-type isolation, and go-live controls.

Canonical product terminology:

- **JPV Bootcamp Membership** — the only public paid product, with monthly no-minimum-commitment and annual-upfront billing options.
- **Non-paid access sources** — support, pay-it-forward, staff, test, administrator-created, and approved migration outcomes grant the same membership entitlement without creating a public product tier.
- **Historical tiers** — old Free/Pro/VIP and other labels are migration inputs only. They must never drive current checkout or entitlement semantics; they map to the current membership entitlement, blocked, expired, revoked, suspended, or administrator-review states.

The 10 July Version 3.5 codebase audit rebaselines readiness after separating source presence, static prototypes, operational workflows, and accepted runtime evidence. The current implementation has since advanced beyond that audit: there is one public JPV Bootcamp Membership with monthly or annual billing, while historical Free/Pro/VIP labels are migration evidence only. See `docs/ARCHITECTURE.md`, `docs/client/ROADMAP_PROGRESS_STATUS.md`, and `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md` for the distinct current and historical evidence layers.

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

### Member authentication and JPV Bootcamp Membership contract

`/admin` is the only administrator login. `/portal` is the canonical member/student entry point and must support sign in, forgot password, resend-verification paths, subscription self-service, and voucher-backed onboarding for both voucher and pay-it-forward recipients. `/portal?mode=login` renders the member sign-in surface without tripping the portal auth gate. Public free self-registration is unavailable. `/register` and `/portal?mode=register` may remain only as compatibility routes into paid Checkout or an explicitly approved voucher/sponsorship flow; they must not create an active free account. `/login` is the only remaining member-login compatibility route and should redirect or link into `/portal?mode=login`.

The only public membership is **JPV Bootcamp Membership**, represented by one Stripe Product with two recurring Prices: GBP 80 monthly with cancellation effective at the end of the current paid month and no minimum commitment, and GBP 800 annually paid upfront for a 12-month service period. Stripe is authoritative for subscription and discount state. Payload projects entitlement, member profile, voucher/sponsorship audit, and reconciliation state. Voucher-backed and pay-it-forward access grant the same membership entitlement; they are not separate public tiers. Registration and Checkout must collect verified email and telephone details, require clear recurring-payment disclosure, and use verified webhook state before granting access. The complete binding design is `docs/JPV_MEMBERSHIP_BILLING_AND_VOUCHER_ARCHITECTURE.md`.

### Partner and affiliate domain language

Affiliates are the internal referral and commission programme: referral codes, referred members, commission rows, payout state, and administrator review. Partner Affiliates are external partner organizations or destinations: partner profile, application mode, recipient emails, trusted destination or webhook, public partner applications, and operations handoff. They share an operations group because the workflows meet at acquisition and reporting, but they are not duplicate collections.

### Staging-only partner schema recovery

The `jpvbootcamp_staging` schema may be repaired, reconciled, or reset for staging validation when explicitly authorized. The true production database, `public` schema, and any non-staging schema remain outside this boundary. Partner schema drift must be corrected by reviewed Payload migrations that derive the active schema from `DATABASE_URL`/runtime configuration and do not hardcode production schema names.

## UI-01 — Launch-critical global design and landing-page refresh

**State:** `IMPLEMENTED / LOCAL RELEASE CANDIDATE GREEN` on 21 July 2026. UI-01A-D are implemented in the feature-branch worktree. The approved landing-page design is locked as an iteration-only system. One typed authority now owns brand identity, semantic colors, typography roles, radii, shadows, and web/email variables; the public site, authentication, member/student portal, course preview, community, supported Payload-admin surfaces, notifications, and transactional email shell consume that authority directly or through its Tailwind aliases. Existing checkout, support, authentication, recipient, provider, migration, and deployment behavior is preserved. The exact cohesive candidate passes 151/151 deterministic release gates and 58/58 isolated local desktop/mobile Chromium journeys, including accessibility and horizontal-overflow checks. A new staging deployment and staging visual acceptance are still required before this candidate replaces the prior deployed baseline. No message, deployment, migration, provider call, or production operation is authorized by UI-01.

### Direction and source hierarchy

Use the supplied Kairos landing page as a structural reference: light editorial presentation, compact top navigation, generous vertical rhythm, a concise hero, horizontal benefit strip, alternating editorial sections, one dark call-to-action band, restrained teacher/testimonial/pricing blocks, and a compact accordion FAQ. Translate those principles into JPV Bootcamp rather than cloning the source. Do not reuse Kairos logos, photographs, course artwork, testimonials, member identities, proprietary copy, or code.

Content precedence is binding:

1. the client-supplied `New Content for JPV Bootcamp 15072026.docx.pdf` overrides the named sections;
2. existing JPV Bootcamp content and working behavior remain where that brief is silent;
3. supplied screenshots/PDF and external reference `DESIGN.md` / `SKILL.md` guide composition only;
4. this plan controls technical boundaries, accessibility, validation, and rollout.

No testimonial, teacher biography, guest-speaker detail, outcome, statistic, or legal/billing claim may be invented. Success Stories, Athina Amadi, Koprinka Aksaray, and Guest Speakers may have structurally reserved sections only when the design remains honest about content being pending; otherwise omit them until approved content exists.

### Layout map and approved content

The public page order is:

1. sticky, compact header with JPV identity; Home, Community, Resources, Success Stories, Partners, and About; Join, Support, and Sign In actions;
2. hero using the supplied purpose/stewardship headline and description, one primary Become a Member action, and the factual GBP 80 monthly / GBP 800 annual choice;
3. horizontally scrollable benefit strip: monthly and annual plans, instant access when joining, live training, hands-on approach, private live events, cancel-anytime wording only where it remains contractually accurate, video curriculum, faith-driven community, and guided support;
4. Who Is JPV Bootcamp For, using the supplied copy in a readable editorial split rather than a generic card grid;
5. How JPV Bootcamp Works as three distinct steps: Learn, Apply at the live event, and Build, retaining the supplied detail and existing How It Works interaction;
6. Community: You Don't Have To Build Alone, using only capabilities that the current application truly supports; aspirational private calls, private messaging, JV video calls, and live prayer must not be presented as operational unless source and staging evidence prove them;
7. simple membership pricing with GBP 80 monthly and GBP 800 annual paid upfront for 12 months, routed through the existing checkout path;
8. About / teachers with approved names only, plus Success Stories only after client content arrives;
9. the existing JPV Bootcamp FAQ unchanged unless separately approved;
10. existing footer, support, legal, and partner destinations preserved unless the brief explicitly changes them.

Join routes to the existing monthly/annual purchase choice. Sign In routes to `/portal?mode=login`. Support reuses the existing approved support/pay-it-forward path and must not introduce a second submission system.

### Shared visual tokens

Create one canonical semantic token layer consumed by public, auth, portal, and supported Payload-admin styling. Prefer CSS variables in `src/assets/styles/globals.scss`, mapped into Tailwind where useful, plus one narrowly scoped Payload admin stylesheet. Do not scatter new literal colors or duplicate component-specific token sets.

| Role | Launch token |
| --- | --- |
| Primary action / brand | JPV green `#2F805B` |
| Brand deep | `#123D2D` |
| Warm highlight | sunshine `#E8C65A` |
| Destructive / urgent only | red `#C94F4F` |
| Canvas | warm off-white `#FFFEFA` |
| Raised surface | soft warm neutral `#F5F3EC` |
| Ink | green-tinted charcoal `#24332B` |
| Muted text | `#687068` |
| Border | `#DEDBD1` |

Green is the default interactive accent. Sunshine is for limited highlights, badges, and section atmosphere. Red is reserved for destructive actions, errors, and genuine urgency, never routine decoration. Validate final contrast in both text and interactive states. Avoid pure black/white, neon glow, gradient text, decorative glass, excessive cards, and generic blue/purple defaults.

Use **Poppins** as the interface family across navigation, forms, portal, administrator, notification, and email body copy. Use **Libre Baskerville** only for approved editorial headings on marketing, authentication, and email surfaces. Both are loaded once through the existing Next font mechanism where supported; email clients use the documented system fallbacks. Body copy is 16px minimum with 1.55-1.7 line height and a 65-75 character measure. Use one spacing scale (`4, 8, 12, 16, 24, 32, 48, 64, 96`), mobile gutters of 20px, desktop gutters of 32px, content shells of 72rem for product surfaces and 80rem for marketing, 8px control/action radii, 10px card radii, 14px panel radii, and subtle tinted shadows only when elevation communicates hierarchy.

### Components and file ownership

Implement in collision-safe slices. Re-open each file before editing and stage only the slice's explicit files.

- **Foundation:** `src/assets/styles/globals.scss`, `tailwind.config.ts`, `src/app/(frontend)/layout.tsx`, and a new narrowly scoped admin theme stylesheet imported by `src/app/(payload)/layout.tsx`.
- **Marketing:** `src/app/(frontend)/page.tsx` plus extracted landing-only components only when extraction makes the page easier to verify. Reuse current checkout, support, modal, and navigation behavior.
- **Authentication:** `src/app/(frontend)/portal/page.tsx`, `src/components/auth/MemberLoginForm.tsx`, and existing password workflow presentation. Do not change authentication decisions, endpoints, redirects, or error semantics.
- **Member portal:** `src/app/(frontend)/portal/layout.tsx` and shared portal presentation primitives, followed by route-level visual alignment. Do not change authorization or data-loading behavior.
- **Administrator:** supported Payload CSS overrides, `src/components/payload/JPVAdminBranding.tsx`, and `src/components/payload/JPVAdminDashboard.tsx`. Keep Payload's functional layout and accessibility intact; do not broadly override internal selectors without browser proof.

Use existing `lucide-react`; add no icon or motion dependency. Motion is limited to purposeful opacity/transform transitions and existing accordion/modal behavior, with `prefers-reduced-motion` fallback. Server components stay server components unless an existing interaction requires a client leaf.

### Fast execution waves

| Wave | Scope | Exit evidence | Estimated focused implementation |
| --- | --- | --- | ---: |
| UI-01A | approve shape brief; freeze tokens, type, spacing, shells, and route/content map | one reviewed token contract; no unresolved content invention | 30-45 min |
| UI-01B | shared token layer, frontend shell, admin theme hook | type check; public, portal, and admin still render | 60-90 min |
| UI-01C | landing composition and supplied content | mobile/desktop screenshots; every CTA and retained interaction works | 2-3 h |
| UI-01D | login/password, portal shell/routes, and admin alignment | authenticated member/admin browser journeys pass | 2-3 h |
| UI-01E | accessibility, responsive, visual, build, and staging regression | all gates below pass at one deployed staging SHA | 1.5-2 h |

These estimates assume no new business logic and no concurrent edits to the owned files. Functionality defects discovered during UI-01 are repaired only when they are regressions caused by this packet; unrelated feature work returns to the existing roadmap owner.

### UI-01 acceptance gates

- No product behavior, authorization, checkout, email, migration, or provider boundary changes.
- Landing content assertions cover the approved navigation, hero, Learn / Apply / Build, community, pricing, and unchanged FAQ.
- Every header/footer link, Join, Support, Sign In, pricing action, modal, form, and accordion is keyboard reachable and functionally verified.
- Login, verification, forgot/reset/set-password, member portal, course/resource/community, billing, logout, admin login, admin dashboard, and representative collection routes retain their success, loading, empty, error, and denied states.
- Responsive browser proof at approximately 390px, 768px, and 1440px shows no clipping or horizontal overflow.
- WCAG AA text/control contrast, visible focus, semantic headings/landmarks, labels, target sizes, reduced motion, and meaningful image alternatives pass.
- Root TypeScript, production build, the release manifest, existing browser E2E, and focused content/design regression tests pass.
- The feature branch is deployed only to staging application `clients-jpv-bootcamp-app-tp9xrk`; the production application remains forbidden and untouched.
- Final acceptance is recorded against one exact branch SHA. UI-01 completion does not authorize data migration or production launch.

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

### Confirmed incomplete or contradictory surfaces in the 10 July audit

The findings below are the historical audit snapshot at `236227c`. Later M0/M1 packets and the programme-content readiness packet closed several of these implementation and testing gaps; current status is maintained in `docs/PREVIEW_RELEASE_READINESS.md` and `docs/client/ROADMAP_PROGRESS_STATUS.md`.

- `/admin/review/**` is a static operator prototype without an administrator-authentication check and must be protected or removed before public release.
- `/tos` and `/privacy-policy` still contain unrelated starter-product content and are indexed by the sitemap; canonical JPV `/terms` and `/privacy` pages already exist.
- The landing page says subscriptions can be canceled at any time, while the client truth is a monthly option with no minimum commitment; repository Stripe setup does not yet prove enforcement of the full billing projection.
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
| P0 | H0-03 | Align public/legal copy with the monthly no-minimum-commitment option | Written billing decision, automated tests, controlled Stripe smoke |
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
- map historical access records into the single JPV Bootcamp Membership model before cutover, preserving Stripe Customers and using individually previewed in-place proration for eligible paid subscriptions while routing non-paid and ambiguous legacy states to explicit review;
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
- Authenticated members can start Pro Stripe Checkout from `/portal/billing`, choosing either the monthly no-minimum-commitment option or the annual upfront option;
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


### Phase 8 — Member Portal Operationalization (COMPLETE)

**Status:** COMPLETE as of 2026-08-20. Auth/access 403 root cause resolved (requirePortalMember was passing wrong user shape). Community portal N+1 queries eliminated. Group post notification fan-out with dry-run staging proof implemented. Comment/reply notification fan-out to post authors implemented. Notification preference framework in place (registry + unsubscribe infrastructure). Courses, community, account, and billing all functional on staging. Direct member-to-member messaging documented outside launch scope — group communication is the launch-required capability.

Delivered:
- portal auth context fix (403 root cause);
- community N+1 parallelization;
- new-post notification fan-out (active+verified+authorized recipients, author excluded, dedupe);
- comment/reply notification to post author (self-comment excluded, eligibility checked);
- communication preference registry with unsubscribe tokens;
- reactions migration (schema in place);
- live staging acceptance: 84/84 Playwright, zero unexpected 403/5xx.

Outside launch scope (documented, not blocking):
- direct member-to-member messaging/inbox;
- @mention notifications (registry defined, implementation deferred);
- community digest emails (registry defined, scheduled delivery deferred);
- richer editor/upload UX iteration.

### Phase 9 — LiveKit Group Calls (COMPLETE)

**Status:** COMPLETE 2026-08-21. Code, migration, staging deployment, backend acceptance, and browser acceptance all green. SHA `9c0debe3bdf0fc5a9c9be99a6697eb6bbff3419d`, deploy run `32462177363`. Migration `20260820_000000_live_session_space` (#36) applied. LiveKit env vars configured (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`). **Backend acceptance (2026-08-21):** anonymous → 401 ✓; host JWT (roomAdmin:true, canPublish:true) ✓; member JWT (canPublish:true, no roomAdmin) ✓; LiveKit cloud room verified (SID RM_Su53GS9G5...) ✓. **Browser acceptance (2026-08-21):** Playwright `portal-calls-acceptance.staging.spec.ts` 5/5 PASS — unauthenticated redirect ✓, calls list renders live session ✓, join call page renders LiveCallRoom ✓, "Join call" button issues valid token ✓, unauthenticated join call redirects ✓. **Remaining human-only validation (non-blocking):** actual WebRTC AV stream and two-participant simultaneous call require real device with camera/microphone. **Deployment hardening gap (non-blocking):** `DEPLOY_SSH_HOST`/`DEPLOY_SSH_USER` not yet in `preview-deploy` GitHub environment; SSH fallback in wait script is skipped (retrigger-at-attempt-10 path still active). See `docs/LIVEKIT_PAYLOADCMS_GROUP_CALLS_PLAN.md` for implementation detail.

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

### Phase 10 — Production cutover (separate authorization only)

**Status:** DEFERRED and NOT part of current roadmap. Distinct from staging migration completion. Requires separate explicit authorization and formal approval process. Read-only Payload snapshot reconciliation, offline rehearsal matrix, and safe evidence validation/export are implemented as references only.

Cutover authorization requirements:

1. Separate explicit go/no-go approval required before any production operation.
2. Apply and verify reviewed migrations only in the approved production environment.
3. Run identity, entitlement, billing, email, content, and partner reconciliation.
4. Test administrator and member journeys in isolation.
5. Test rollback without deleting production data.
6. Confirm monitoring, audit, support, delivery, and recovery procedures.
7. Obtain explicit approval for each cutover boundary.

**Staging migration itself has NO remaining engineering blocker. Production migration and cutover remain separately gated.**

### Phase 11 — Partner Affiliates and Reporting (deferred post-cutover)

**Status:** DEFERRED post-cutover. Partner application, delivery, reporting, and affiliate service foundations exist. The new partner-referral MVP is client-only and does not persist; it must be connected to the existing service. M2-01 remains post-core unless separately promoted. Live provider verification, reconciliation, payouts, and preview acceptance remain pending.

Detailed specification: `docs/PAYLOAD_PARTNER_AFFILIATE_PLAN.md`.

Tasks:

- complete the partner directory;
- add authenticated member application and history;
- record applications before redirect or delivery;
- complete reports, CSV export, delivery modes, retries, and audit;
- add partner and affiliate communications through Phase 6;
- reconcile retained legacy partner records before production cutover.

Validation:

- members read only their own applications;
- trusted destinations are never supplied by the browser;
- delivery is idempotent and retryable where implemented;
- administrators can filter and export authorized reports.

## Overall delivery status — 10 July 2026 (Version 3.5 audit)

The roadmap retains the eleven product phases but places the historical Version 3.5 hardening gate before unfinished feature work. Audited readiness is approximately **68% for the expanded platform**, **82% for core staging/code**, **86% for build foundation**, **76% for testing/release**, **55% for migration**, and **20% for live cutover**. These figures distinguish static prototypes from operational workflows and accepted runtime evidence. See `docs/client/ROADMAP_PROGRESS_STATUS.md` for the current status and `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md` for findings.

- **Carried-forward strong foundations:** Payload administration, shared login, account security, entitlement evaluation, billing projection, protected resources, migration controls, and staging-evidence tooling.
- **Revised core go-live scope:** public landing page, one-membership terminology and entitlement refactor, GBP 80 monthly and GBP 800 annual Stripe Checkout, mandatory email/telephone/payment-method onboarding, voucher and pay-it-forward subscription flows, billing automation/recovery, representative 8-week course pilot, Bunny Stream protected playback, Payload administrator operations, migration rehearsal, rollback, and explicit go-live approval. The public front-end website milestone remains 22 July 2026, the handover buffer remains 23 July 2026, and the client-requested finished-by date remains 24 July 2026. Delivery is high-risk and conditional; non-essential enhancements must not displace billing, onboarding, access control, course usability, provider verification, and migration rehearsal.
- **Controlled follow-up releases:** richer partner reporting/delivery, community/private-room refinements, notifications/digests, private messaging if accepted, and later LiveKit group calls.
- **Primary remaining work:** close P0 security/public-copy/billing/submission/dependency blockers; consolidate the member route tree; add complete release and browser tests; complete public copy/content by 15 July; run representative course/storage acceptance; verify partner/community workflows; rehearse migration and rollback; and approve cutover.

## Current milestone verification — 14 July 2026

The current validated repository baseline is `d55229f test: enforce programme content readiness`. The current branch-tip checkpoint is `8927df9 docs: checkpoint membership implementation readiness`. M0-01 through M0-09 and M1-01 through M1-06 are implemented; M1-06 remains in state B, with `/portal/programme` explicitly preview-only and community interaction still deferred. The follow-up programme-content acceptance and release-candidate packet is complete at repository level, and the membership-support schema-migration plan plus generated-type isolation strategy are now documented separately.

The repository is **READY TO ACCEPT PROGRAMME CONTENT**, not ready to publish it. The canonical contract, client intake template, non-publishable example fixture, validation command, acceptance report, import plan, approval record, release-manifest coverage, focused tests, and preview-only browser guard are present. No client programme content was invented or approved.

Verified local evidence at this baseline:

- `pnpm test:release` passed `121/121`;
- `pnpm test:e2e` passed `58/58` across desktop and mobile Chromium projects;
- `pnpm test:release:full` and `pnpm staging:static-preflight` remain required repeatable gates at the exact operator tip;
- TypeScript, production build, both Prisma schema validations, and the production high-severity audit gate passed;
- no migration, deployment, provider, or push action occurred.

The next controlled work is to keep the client truth, roadmap, implementation plan, and schema-migration plan synchronized, then execute the approved administrator persistence/schema migration packet and generated-type regeneration only after explicit authorization. M2-01 remains post-core unless explicitly promoted.

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

The M0/M1 hardening, canonical portal alignment, release/browser matrix, programme-content acceptance packet, schema-migration plan, generated-type isolation strategy, legacy migration reconciliation, and disposable local rehearsal are complete at repository level. All repository implementation for the launch scope is complete. The roadmap is now reconciled in `docs/CURRENT_WORK_HANDOFF.md` with a task-by-task implementation plan for every remaining gate. The front-end website milestone is 22 July 2026, the handover buffer is 23 July 2026, and the client-requested finished-by date is 24 July 2026.

The next controlled tasks are (in order): (1) re-run `pnpm test:e2e` at current HEAD to re-confirm 58/58 before PR; (2) operator authorizes and applies staging migrations with backup and rollback confirmation; (3) operator executes migrated-user invitation/reset for the 21-member cohort; (4) live provider verification; (5) staging smoke acceptance; (6) scope-decision queries for the five next-domain migration sources; (7) formal go/no-go. Full platform cutover remains conditional on all those gates. No live operation or migration is authorized by this plan.

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
