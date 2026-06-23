# Payload CMS Integration Plan

This is the single canonical product, architecture, security, roadmap, and execution plan for the JPV Bootcamp Payload programme. Code changes must follow this plan in order. Update this document before changing the architecture, security model, product boundary, rollout sequence, or production boundary.

## Documentation hierarchy

To keep the repository cohesive and unambiguous, documents have explicit roles:

1. **Canonical plan — this document.** It owns the philosophy, strategy, architecture, security rules, current status, ordered roadmap, acceptance gates, and cutover boundary.
2. **Feature specifications.** These define implementation detail for a roadmap phase but cannot change the canonical architecture or phase order. Current feature specification:
   - `docs/PAYLOAD_PARTNER_AFFILIATE_PLAN.md` — detailed specification for Phase 8.
3. **Visual reference.** `docs/PAYLOAD_COURSE_VISUAL_IMPLEMENTATION_PLAN.md` illustrates screens, collections, and workflows. It is supporting reference material, not a second roadmap. Where it differs from this document, this document wins.
4. **Legacy archive.** `docs/archive/PARTNER_AFFILIATE_LEGACY.md` records retained obsolete behavior for migration and reconciliation. Archive documents never define the target architecture.
5. **Platform invariants and operations.** `docs/PROKIT_OVERVIEW.md`, `docs/PROKIT_INVARIANTS.md`, and infrastructure documents define stable platform and operational contracts. They do not replace this product roadmap.

Do not create another general Payload roadmap. New features must first be added here as a phase or deliverable. Create a separate feature specification only when the detailed schema, workflow, privacy, migration, or acceptance material would make this canonical plan harder to use.

## Philosophy

- Build one coherent application rather than parallel member systems.
- Keep public, administrator, and member surfaces separate and explicit.
- Treat identity, authorization, entitlements, privacy, and auditability as product foundations.
- Preserve proven production flows until their replacements are tested, reconciled, reversible, and approved.
- Prefer small, demonstrable, independently validated phases over a broad migration rewrite.
- Keep Payload as the administrative system of record and Next.js as the controlled member experience.
- Retain legacy systems as migration sources, never as accidental target architecture.

## Strategy

- Establish the administrator boundary and shared identity routing first.
- Build the protected portal and core course experience next.
- Enforce entitlements and protected resource delivery before expanding account or billing workflows.
- Add member account, billing, community, and partner-affiliate capabilities as explicit phases on the same security model.
- Shadow-test and reconcile every replacement before production cutover.
- Make production database and traffic changes only after the corresponding acceptance gate passes.

## Final architecture

JPV Bootcamp has three application surfaces:

| Surface | Route | Audience | Purpose |
|---|---|---|---|
| Public website | `/` | Everyone | Marketing, pricing, public content, and login entry |
| Administrator back office | `/admin` | Verified administrators only | Payload CMS administration |
| Member portal | `/portal` | Verified members only | Courses, community, private groups, account, and billing |

`/login` is the shared authentication entry. After authentication:

- verified administrators redirect to `/admin`;
- verified members redirect to `/portal`;
- unresolved, blocked, or unauthorized identities receive no privileged access.

Payload administrator accounts and member identities are separate security domains, even when one person holds both. Members must never receive Payload admin access, administrator API access, or administrator capabilities.

## Binding security rules

1. Authorization is enforced server-side and fails closed.
2. Hidden navigation is usability only; it is never an authorization control.
3. Every protected route, API operation, Local API call, mutation, and file operation verifies the authenticated identity and required role or entitlement.
4. Course, community, private-group, and billing access requires explicit roles, policies, grants, and effective entitlements.
5. Administrator capabilities are granted explicitly and minimally.
6. Member sessions cannot be accepted as Payload administrator sessions.
7. Password onboarding and recovery use expiring set-password or reset links. Plaintext passwords are never emailed.
8. Secrets, tokens, password-reset codes, Stripe credentials, and private file URLs are never exposed to clients or logs.
9. Stripe webhooks remain signature-verified and idempotent.
10. Access is removed or restricted when the authoritative entitlement state no longer permits it.

## Current implementation baseline

All work happens on `feature/course-branding-and-preview`. `main` remains the production-safe restore branch.

The repository already contains:

- Payload CMS in the existing Next.js application;
- Node 20, pnpm, Next.js 16, React 19, PostgreSQL, and Payload migrations;
- the administrator route at `/admin`;
- Payload collections for administrators, members, courses, modules, lessons, access control, billing mirrors, community, CRM/email, and audit records;
- fail-closed entitlement evaluation and server-side access services;
- Stripe shadow synchronization behind explicit feature boundaries;
- queued email processing with dry-run and apply modes;
- documentation for the target course and member system.

The member portal at `/portal`, shared role-based login routing, final administrator navigation, and production cutover remain implementation work.

## Strategy

- **One repository** — the public site, Payload back office, and member portal remain inside `jpv-bootcamp`.
- **Separate surfaces** — administrators use `/admin`; members use `/portal`.
- **Separate security domains** — administrator and member identities are never treated as interchangeable.
- **Payload for administration** — Payload manages administrative records and workflows; members do not use the Payload admin interface.
- **Custom member experience** — `/portal` is a dedicated Next.js interface for member tasks.
- **Explicit entitlements** — runtime access is derived from authoritative roles, policies, grants, subscription state, and account state.
- **Non-destructive rollout** — existing WordPress, Stripe, email, and production flows remain unchanged until replacement paths pass all gates.
- **Database last** — production schema or data changes occur only after local validation and migration review.
- **Small reversible steps** — each implementation phase has focused validation, an explicit commit, and a rollback point.

## Execution roadmap

### Phase 1 — Finalize the administrator boundary

Deliverables:

- Payload is served only from `/admin`;
- `/admin` and administrator APIs reject non-administrators;
- the Payload login and admin UI use JPV Bootcamp branding;
- logout terminates the administrator session and returns to the login screen;
- the administrator sidebar is concise and grouped by daily tasks;
- operational collections remain available through relationships or direct authorized workflows but are not primary navigation.

Visible administrator navigation:

- **Courses** — Courses, Modules, Lessons
- **Members & Access** — Members, Member Groups, Access Groups
- **Community** — Community Spaces, Community Posts
- **Billing** — Subscriptions, Payments, Billing Accounts
- **Administration** — Administrators

Validation:

- anonymous and member requests to `/admin` fail closed;
- administrator login succeeds and redirects to `/admin`;
- logout does not automatically re-authenticate;
- direct collection URLs enforce the same access rules as navigation;
- Payload import-map generation and TypeScript checks pass under Node 20.

### Phase 2 — Implement shared login routing

Deliverables:

- `/login` authenticates without assuming the destination;
- verified administrators redirect to `/admin`;
- verified members redirect to `/portal`;
- blocked, suspended, unresolved, or conflicting identities receive a safe error state;
- administrator and member sessions remain isolated.

Validation:

- role routing is determined server-side;
- redirect parameters cannot escape approved routes;
- a member account cannot obtain an administrator session;
- an administrator without a member identity does not automatically receive member entitlements;
- logout clears only the intended session and returns to a non-privileged screen.

### Phase 3 — Build the member portal shell

Create:

- `/portal`
- `/portal/courses`
- `/portal/community`
- `/portal/groups`
- `/portal/account`
- `/portal/billing`

Deliverables:

- member-specific navigation;
- responsive authenticated layout;
- account overview;
- empty, loading, unauthorized, blocked, and error states;
- no Payload administrative components or terminology.

Validation:

- anonymous users redirect to `/login`;
- administrators do not receive member access unless they also have a valid member identity;
- all portal data is loaded through server-side authorization boundaries.

### Phase 4 — Enforce course and group access

Deliverables:

- member course listing from effective entitlements;
- course, module, lesson, community, and private-group access checks;
- explicit Free, Pro, VIP, manual, suspended, expired, and revoked states;
- private media and document delivery through authorized server paths;
- administrative grant and revoke workflows with audit records.

Validation:

- every protected resource denies access when no explicit entitlement exists;
- hidden UI cannot be bypassed through direct URLs or APIs;
- entitlement changes take effect predictably;
- reconciliation reports identify inconsistent access states;
- private Bunny or storage assets are never exposed through permanent public URLs.

### Phase 5 — Complete account and password workflows

Deliverables:

- secure member invitation;
- expiring set-password and reset-password links;
- member password change;
- profile update;
- account block and restore;
- administrator audit visibility.

Validation:

- no plaintext passwords are stored, logged, or emailed;
- tokens are single-use, time-limited, and invalidated after success;
- blocked accounts lose portal access;
- sensitive account changes require appropriate re-authentication or verification.

### Phase 6 — Complete billing self-service

Deliverables:

- current plan and billing state in `/portal/billing`;
- Stripe-hosted customer portal or equivalent secure self-service;
- Pro-to-VIP upgrade;
- cancellation and renewal-state visibility;
- webhook-driven billing mirror and entitlement reconciliation.

Validation:

- Stripe remains authoritative for payment state;
- webhook signatures and idempotency are verified;
- client input never directly grants paid access;
- failed, canceled, refunded, disputed, and recovered payments produce defined entitlement states;
- administrators can inspect billing state without exposing secrets.

### Phase 7 — Complete community and announcements

Deliverables:

- member community feed;
- announcements;
- authorized community and private-group publishing;
- text, images, video references, links, and documents;
- Bunny integration through private, authorized delivery paths where required.

Validation:

- publishing permissions are explicit;
- private-group content cannot be fetched by unauthorized members;
- uploads enforce type, size, and ownership rules;
- external media identifiers and signed URLs are handled server-side.

### Phase 8 — Implement partner affiliate applications and reporting

Deliverables:

- Payload-managed partner affiliate directory;
- authenticated member partner-selection and application form;
- member application history in `/portal`;
- administrator application, click, submission, and delivery reporting in `/admin`;
- server-side CSV export with audit records;
- queued email, webhook, redirect, or manual-export delivery modes;
- privacy-safe event tracking for partner views, clicks, submissions, delivery, retries, status changes, and exports;
- dry-run reconciliation against retained Prisma and WordPress partner records.

Validation:

- every application is linked to the authenticated Payload member and selected active partner;
- the application record exists before redirect or external delivery;
- members can read only their own application history;
- administrators can filter and export authorized partner reports;
- client input cannot supply trusted affiliate URLs, webhook endpoints, recipient addresses, member IDs, or delivery status;
- delivery is idempotent and retryable;
- legacy partner sessions, clicks, sponsored applications, and reports remain unchanged until explicit cutover approval.

Implementation details and legacy inventory are defined in:

- `docs/PAYLOAD_PARTNER_AFFILIATE_PLAN.md`;
- `docs/archive/PARTNER_AFFILIATE_LEGACY.md`.

### Phase 9 — Shadow validation and cutover

Before replacing any existing production flow:

1. Run identity, entitlement, billing, email, content, and partner-affiliate reconciliation.
2. Verify reviewed Payload migrations touch only approved `payload_*` objects.
3. Test administrator and member journeys in an isolated environment.
4. Test rollback without deleting production data.
5. Confirm monitoring, audit, support, and recovery procedures.
6. Obtain explicit approval for each cutover boundary.

Only then may an existing WordPress or production responsibility be disabled or redirected.

## Migration and database guardrails

- Payload collection schema changes require generated types and reviewed migration output.
- Stop if a Payload migration touches an unapproved non-`payload_*` table or object.
- Never apply prototype or unreviewed migrations to production.
- Production writes require an explicit apply step; dry-run is the default for reconciliation, email delivery, and migration inspection tools.
- Existing production tables, users, subscriptions, automations, and WordPress flows remain intact until their specific cutover is approved.

## Validation gate for every phase

A phase is complete only when:

- the smallest relevant type check passes;
- focused tests for changed authorization and business rules pass;
- the affected administrator and member journeys are manually verified;
- no secret or private data is exposed;
- migrations are reviewed when schemas change;
- rollback is documented and tested where risk warrants it;
- documentation matches the implemented behavior;
- changes are committed on `feature/course-branding-and-preview` with explicit paths.

## Rollback

- Before production cutover, revert the phase-specific feature-branch commit.
- `main` remains the production-safe code restore branch.
- Feature flags default off for shadow integrations and incomplete replacement paths.
- Do not delete production data as part of rollback.
- Keep inert `payload_*` records when removal would increase recovery risk.
- Re-enable or retain the existing WordPress, Stripe, email, and automation path until the replacement is proven.

## Stop conditions

Stop implementation when:

- administrator and member authorization cannot be proven separate;
- a protected operation relies only on hidden navigation or client-side checks;
- an entitlement decision is ambiguous or fails open;
- a migration affects an unapproved database object;
- Stripe or email processing is not idempotent;
- private assets can be accessed without authorization;
- rollback is unavailable;
- the implementation contradicts this plan or the canonical invariants.
