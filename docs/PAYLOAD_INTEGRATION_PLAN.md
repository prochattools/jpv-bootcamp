# Payload CMS Integration Plan

This is the single canonical product, architecture, security, roadmap, and execution plan for the JPV Bootcamp Payload programme. Code and operational changes must follow this plan in order. Update this document before changing architecture, security, product boundaries, rollout order, or production responsibilities.

## Documentation hierarchy

1. **Canonical plan — this document.** Owns philosophy, architecture, security, current status, roadmap order, validation gates, and cutover boundaries.
2. **Feature specifications.** Define implementation detail without changing roadmap order:
   - `docs/PAYLOAD_COMMUNICATIONS_PLAN.md` — branded communications, FreeResend delivery, templates, events, preferences, audit, and acceptance criteria for Phase 6.
   - `docs/PAYLOAD_PARTNER_AFFILIATE_PLAN.md` — detailed Partner Affiliates specification for Phase 9.
3. **Visual reference.** `docs/PAYLOAD_COURSE_VISUAL_IMPLEMENTATION_PLAN.md` illustrates screens and workflows but does not replace this plan.
4. **Client progress document.** `docs/client/JPV_Minimal_Payload_Course_Plan_v2_2.docx` communicates progress and remaining work in concise, non-technical language. It must remain aligned with this plan and the feature specifications.
5. **Legacy archive.** `docs/archive/PARTNER_AFFILIATE_LEGACY.md` records retained obsolete behavior for migration and reconciliation.
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
- Preserve proven production flows until replacements are tested, reconciled, reversible, and approved.
- Prefer small, demonstrable phases over broad rewrites.
- Keep Payload as the administrative system of record and Next.js as the controlled member experience.
- Retain legacy systems as migration sources, never as accidental target architecture.

## Final architecture

| Surface | Route | Audience | Purpose |
|---|---|---|---|
| Public website | `/` | Everyone | Marketing, pricing, public content, and login entry |
| Shared login | `/login` | Administrators and members | Direct each verified identity to the correct area |
| Administrator back office | `/admin` | Verified administrators | Content, members, access, billing, community, affiliates, audit, and operations |
| Member portal | `/portal` | Verified members | Courses, community, groups, account, billing, and partner activity |

Administrator accounts and member identities are separate security domains, even when one person holds both. Members never receive administrator access merely because they have an active member record.

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

## Current implementation status — 30 June 2026

### Implemented and manually demonstrated

- Preview deployment runs from `feature/course-branding-and-preview`.
- Payload administrator area is available at `/admin`.
- Administrator navigation is grouped by Administration, Courses, Members & Access, Partners & Affiliates, Billing, and Community.
- Administrator and member records are separate.
- Course, lesson, entitlement, progress, community-read, billing-mirror, affiliate-reporting, and protected-resource foundations exist.
- Protected files are served through guarded server routes.
- Runtime database-schema isolation was repaired for staging migrations.
- Normal application requests no longer auto-run reviewed Payload migrations.

### Implemented foundation but not complete

- Shared role decision and safe redirect rules exist.
- Member portal pages exist at `/portal` and related routes.
- Member records and account status exist.
- Affiliate collections and administrator summaries exist.
- JPV administrator branding components exist in source.
- Queued email and FreeResend-related application capability exists outside Payload.

### Incomplete validation or user journey

- Ordinary members cannot yet complete a usable credential login flow.
- The current Payload login screen still shows Payload branding instead of the JPV Bootcamp logo.
- Payload is not yet connected to the existing FreeResend delivery path.
- Invitation, verification, set-password, reset-password, password-change, and profile-change emails are incomplete.
- Member logout, blocked/suspended states, and recovery journeys need end-to-end validation.
- The affiliate Payload migration still requires explicit staging application and verification.
- Billing self-service, community publishing, partner application delivery, and cutover remain pending.

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

**Status:** Server-side routing foundation exists; credential journey incomplete.

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
- preserve Free, Pro, VIP, manual, suspended, expired, and revoked states;
- finish grant/revoke administration and reconciliation;
- move private storage to production-suitable shared or object storage before cutover.

Validation:

- direct URLs and APIs cannot bypass access checks;
- entitlement changes take effect predictably;
- private assets never expose permanent public URLs.

### Phase 5 — Complete account and password workflows

**Status:** Planned; required before wider member rollout.

Tasks:

- secure member invitation;
- email verification;
- expiring set-password and reset-password links;
- member password change;
- profile and email-address update;
- account block, suspend, restore, and deletion workflows;
- administrator audit visibility.

Validation:

- no plaintext password is stored, logged, or emailed;
- tokens are single-use and time-limited;
- blocked accounts lose portal access;
- sensitive changes require re-authentication or verification.

### Phase 6 — Complete branded communications and FreeResend delivery

**Status:** Approved and documented; implementation pending.

Detailed specification: `docs/PAYLOAD_COMMUNICATIONS_PLAN.md`.

Tasks:

- connect Payload to the existing FreeResend service;
- use one JPV Bootcamp HTML and plain-text template system;
- add delivery records, verified provider events, bounded retries, and administrator visibility;
- implement account, verification, invitation, password, profile, and security messages;
- implement purchase, subscription, payment, retry, cancellation, refund, invoice, billing-hold, and access-restored messages;
- implement enrollment, release, progress, completion, certificate, community, group, and moderation notifications;
- implement partner application, referral, commission, payout, delivery, and operational alerts;
- separate transactional, notification, and broadcast communication;
- add preference and unsubscribe handling for optional messages.

Validation:

- Payload sends through FreeResend in staging;
- authentication and password journeys work end to end;
- every approved template has HTML and plain-text output;
- security links are server-generated, time-limited, and environment-correct;
- optional messages respect preferences;
- provider events are verified and idempotent;
- no client-facing message contains Payload branding.

### Phase 7 — Complete billing self-service

**Status:** Planned; billing mirror foundation exists.

Tasks:

- show current plan and billing state in `/portal/billing`;
- provide Stripe-hosted customer self-service;
- support upgrades, cancellation, renewal, failed-payment recovery, refunds, and billing holds;
- reconcile webhook-driven billing state with entitlements;
- connect billing events to Phase 6 communications.

Validation:

- Stripe remains authoritative;
- client input cannot grant paid access;
- failed, canceled, refunded, disputed, and recovered payments produce defined access and email outcomes.

### Phase 8 — Complete community publishing and notifications

**Status:** Read-only foundation exists.

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
- optional notifications respect preferences.

### Phase 9 — Complete partner affiliates and reporting

**Status:** Administrator collection and reporting foundation implemented; member and delivery journeys pending.

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
- delivery is idempotent and retryable;
- administrators can filter and export authorized reports.

### Phase 10 — Shadow validation and cutover

**Status:** Pending.

Before replacing any existing production flow:

1. Apply and verify reviewed migrations only in the approved environment.
2. Run identity, entitlement, billing, email, content, and partner reconciliation.
3. Test administrator and member journeys in isolation.
4. Test rollback without deleting production data.
5. Confirm monitoring, audit, support, delivery, and recovery procedures.
6. Obtain explicit approval for each cutover boundary.

Only then may an existing production responsibility be disabled or redirected.

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

Complete member authentication, account security, JPV login branding, and the FreeResend communications foundation. Then continue with billing self-service, community publishing, partner delivery, and the representative pilot.

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
