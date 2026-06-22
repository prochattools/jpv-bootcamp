# Payload Course System Implementation Plan

## Status and verdict

This document is the executable plan for moving from the current WordPress, FluentCommunity, and FluentCRM course/community stack to a Payload CMS based course system.

The old version of this document was a visual-only prototype plan. That plan was safe, but it was not sufficient for the goal now requested. A full replacement is feasible, but only if it is built in strict phases:

1. Keep the existing WordPress, FluentCommunity, FluentCRM, Stripe, and Resend flows untouched.
2. Finish and validate the isolated Payload visual prototype.
3. Build the target Payload data model with no side effects.
4. Build member identity, entitlement, billing, email, CRM, and group access as a fail-closed application layer.
5. Shadow-test Stripe and migration data before granting real access.
6. Cut over only after reconciliation, rollback, and admin workflows are proven.

Payload can support this target system through documented collections, auth collections, access control, hooks, Local API, relationship fields, jobs queue, and Postgres migrations. It is not an LMS plugin by itself. The FluentCommunity-like behavior must be implemented as custom Payload collections and Next.js application services.

## Current implementation status

As of `20260621_194424_course_system_phase1` on `feature/course-branding-and-preview`:

- Staging is database `jpvbootcamp`, schema `jpvbootcamp_staging`.
- The branch contains Payload collection scaffolding for members, course runtime, access control, billing mirror, CRM/email, community, and audit.
- `src/lib/entitlements/evaluateAccess.ts` contains a pure fail-closed entitlement evaluator with focused tests in `scripts/payload_entitlement_evaluator.test.ts`.
- `src/lib/payloadCourse/accessService.ts` contains Local API service functions that load Payload course/lesson, member, billing, policy, grant, group, and progress records, then call the pure evaluator. These services intentionally use server-side Local API reads and treat `evaluateAccess` as the runtime authorization boundary.
- `src/lib/payloadCourse/adminGrants.ts` contains admin/system grant and revoke services for `payload_access_grants`. These services write audit events, entitlement events, and queued email-event records; they do not send email directly.
- `src/lib/members/accountStatus.ts`, `src/lib/members/blockMember.ts`, and `src/lib/members/restoreMember.ts` contain account block/restore services. These services write member security events, audit events, and queued email-event records; they do not send email directly.
- `src/lib/payloadCourse/reconcileEntitlements.ts` and `scripts/payload/reconcile-entitlements.mts` contain a read-only entitlement reconciliation dry-run. It compares members, published courses, policies, active grants, subscriptions, effective access decisions, and published lesson-resource storage safety.
- `src/lib/payloadCourse/stripeShadowSync.ts` contains the Stripe-to-Payload billing mirror service. It is wired into the verified Stripe webhook handler behind `PAYLOAD_BILLING_SHADOW_SYNC_ENABLED`; when disabled, the current WordPress/FluentCRM provisioning path is unchanged.
- `scripts/payload_course_stripe_shadow_sync.test.ts` covers active subscription mirroring, duplicate Stripe event idempotency, cancellation blocking, payment failure blocking, payment recovery restore, and preserving manually suspended accounts.
- `src/lib/payloadCourse/emailSender.ts` contains the queued Payload email sender. It consumes `payload_email_events`, renders active `payload_email_templates`, sends through Resend with an idempotency key, and updates delivery state. It is not scheduled or auto-enabled.
- `scripts/payload/send-queued-emails.mts` is the operator command for queued Payload emails. It defaults to dry-run without delivery-state writes; `--apply` is required before any Resend send or send-failure write happens.
- `src/lib/members/currentMember.ts` reads the current Payload member session from the HTTP-only Payload auth cookie and rejects admin-user sessions for learner routes.
- `src/lib/payloadCourse/memberPortal.ts` builds the member dashboard/account/course/lesson projections. It evaluates course access before fetching module and lesson outlines, and lesson access before rendering lesson details or writing progress.
- `payload_private_media` stores protected course files outside `public/`; `payload_lesson_resources.protectedFile` is the preferred file relationship for paid/private lesson resources.
- `src/lib/payloadCourse/lessonResources.ts` lists and resolves published lesson resources only after server-side lesson access passes, including previous-lesson enforcement. It prefers `protectedFile` and treats the original public `file` field as a non-confidential fallback.
- `/learn/login`, `/learn`, and `/learn/account` are dynamic Node routes backed by `payload_members`. Public self-signup remains disabled; accounts still come from admin, Stripe shadow sync, or migration flows.
- `/learn/[courseSlug]` and `/learn/[courseSlug]/[lessonSlug]` are dynamic Node routes with server-side access checks and mark-complete support.
- `/learn/resources/[resourceId]` is the only learner-facing lesson-resource URL. It requires a Payload member session, rechecks lesson access, serves private files from `private/payload-course-media`, and returns the file with `private, no-store` headers.
- `scripts/payload/seed-course-admin-data.mts` contains an idempotent seed runner for access groups, prototype/admin courses, modules, lessons, email templates, community spaces, and access policies. It defaults to dry-run and writes only with `--apply`.
- `src/migrations/20260621_194424_course_system_phase1.ts` creates the course-system Payload tables and has been applied to staging.
- Staging now has 56 `payload_*` tables and records both Payload migrations in `payload_migrations`.
- Staging seed data has been applied through the seed runner: 3 courses, 5 lessons, 4 access groups, 3 spaces, 7 email templates, and 6 access policies.
- Staging entitlement reconciliation dry-run currently reports 0 members, 3 courses, 6 policies, 0 subscriptions, 0 active grants, 0 decisions, and 0 issues.
- `scripts/db/deploy-prod.sh` normalizes schema object ownership to the tenant user before reviewed Payload migrations are applied with `pnpm payload migrate`.
- `/course-preview` routes are still static demonstration pages and are guarded by `PAYLOAD_COURSE_PROTOTYPE_ENABLED`.

This is scaffolding and groundwork plus tested read-side, admin mutation, reconciliation, Stripe shadow-sync, queued-email sender, member learner-page services, private lesson-resource storage, and guarded lesson-resource download URLs. It does not yet make Payload the live runtime source for Stripe provisioning, public signup, scheduled Resend sends, rich lesson rendering, comments, migration, or community posting. Stripe shadow sync remains a feature-flagged mirror until staging replay and reconciliation pass. Private course files are no longer stored under `public/`, but production cutover still requires a persistent volume or Payload-supported storage adapter for `private/payload-course-media`.

Staging currently records three Payload migrations: `20260620_213328`, `20260621_194424_course_system_phase1`, and `20260622_093852_course_private_media`. In this Dokploy standalone deployment, the new private-media migration did not apply on container startup; it was applied explicitly with `pnpm payload migrate` against `jpvbootcamp_staging`. Treat explicit reviewed Payload migration execution plus verification in `payload_migrations` as the required operational step for future schema changes.

## Critical findings from review

- The current visual prototype plan cannot deliver the full requested system because it explicitly excludes auth, billing, entitlements, CRM, email, groups, chat, progress, and migration.
- The repository already contains course prototype collections in `src/collections/PayloadCoursePrototype.ts` and registers them in `src/payload.config.ts`.
- The initial Payload migration `src/migrations/20260620_213328.ts` does not create course tables; `src/migrations/20260621_194424_course_system_phase1.ts` now covers prototype and course-system scaffolding. Future collection changes still require reviewed Payload migrations.
- The existing docs correctly treat `payload_users` as CMS admin users only. Do not convert `payload_users` into student/member accounts. Use a separate member auth collection.
- The existing Stripe and WordPress provisioning system already works. The new Payload system must first shadow it, then replace it only at an explicit cutover.
- FluentCommunity content and membership data cannot be treated as a simple WordPress REST export. Courses, spaces, members, progress, discussions, files, and CRM tag access need a source audit and mapping before import.

## Required reading

Read these local docs before implementation:

- `docs/ARCHITECTURE.md`
- `docs/PAYLOAD_CMS.md`
- `docs/PAYLOAD_MIGRATION.md`
- `docs/STRIPE_MEMBERSHIP_FLOW.md`
- `docs/STRIPE_WP_PROVISIONING.md`
- `docs/PROKIT_DATABASE.md`
- `docs/PROKIT_INVARIANTS.md`
- `docs/PROKIT_INFRASTRUCTURE.md`

Read these official docs when implementing the relevant phase:

- Payload collections: `https://payloadcms.com/docs/configuration/collections`
- Payload access control: `https://payloadcms.com/docs/access-control/overview`
- Payload auth: `https://payloadcms.com/docs/authentication/overview`
- Payload auth email: `https://payloadcms.com/docs/authentication/email`
- Payload hooks: `https://payloadcms.com/docs/hooks/collections`
- Payload Local API: `https://payloadcms.com/docs/local-api/overview`
- Payload relationship fields: `https://payloadcms.com/docs/fields/relationship`
- Payload Postgres adapter: `https://payloadcms.com/docs/database/postgres`
- Payload migrations: `https://payloadcms.com/docs/database/migrations`
- Payload jobs queue: `https://payloadcms.com/docs/jobs-queue/overview`
- Stripe subscription webhooks: `https://docs.stripe.com/billing/subscriptions/webhooks`
- Stripe subscription statuses: `https://docs.stripe.com/api/subscriptions/object`
- Resend email idempotency: `https://resend.com/docs/api-reference/emails/send-email`
- FluentCommunity course management: `https://fluentcommunity.co/docs/creating-and-managing-course/`
- FluentCommunity course privacy: `https://fluentcommunity.co/docs/course-privacy/`
- FluentCommunity space privacy: `https://fluentcommunity.co/docs/managing-privacy-of-spaces/`
- FluentCommunity space member management: `https://fluentcommunity.co/docs/manage-members-of-space/`

## Product principles to preserve

FluentCommunity's useful patterns are:

- Spaces and courses are first-class community areas.
- Spaces and courses have privacy states: public, private, and secret.
- Private content has lock screens or redirects instead of leaking content.
- Admins can add, approve, invite, import, remove, and role-change members.
- Course content is structured as course -> sections/modules -> lessons.
- Courses support draft/published status, thumbnails, details, layouts, preview lessons, comments, files, video embeds, and ordered lesson navigation.
- Courses can be self-paced, structured/dripped, or scheduled.
- Lesson order enforcement can lock the next lesson until the previous lesson is complete.
- Spaces can include discussion posts, comments, files, group chat, and member roles.
- CRM tags can drive group/course access.

The Payload replacement should keep the principles, not copy WordPress implementation details.

## Non-negotiable guardrails

### Current production remains authoritative until cutover

These remain untouched until an approved cutover phase:

- WordPress at `portal.jpvbootcamp.com`
- FluentCommunity
- FluentCRM
- current Stripe checkout routes
- current Stripe billing portal routes
- current Stripe webhook handler
- current WordPress provisioning endpoint
- current FluentCRM tag sync
- current Resend membership email behavior
- current sponsored-seat and partner flows
- current Prisma-managed application tables

No implementation task may change production behavior unless its phase explicitly says so.

### Payload documentation compliance

Every Payload change must use documented Payload features:

- Collections for recurring data.
- Separate auth collection for student/member accounts.
- Access control functions for API/admin permissions.
- Hooks only for narrow lifecycle side effects.
- Jobs queue for durable email, sync, or delayed work.
- Local API for server-side scripts and server components.
- Relationship fields or join fields for content/member relationships.
- Payload migrations for every production schema change.

Stop if a task requires undocumented Payload internals or direct edits to generated Payload tables.

### Database ownership

- All new course, member, CRM, email, and group tables must be Payload-owned and use `payload_` prefixed collection `dbName` values.
- Prisma tables remain Prisma-owned.
- WordPress MySQL tables remain WordPress-owned.
- Payload hooks must not mutate Prisma tables.
- Prisma code must not mutate Payload tables directly.
- Migration scripts must use Payload Local API or documented source APIs, not ad hoc writes to Payload tables.

### Fail-closed access

The system must deny paid/private access unless a current valid grant is proven.

Deny wins over allow. A member is blocked from paid/private content when any of these is true:

- account status is `blocked`, `suspended`, `deleted`, or `unverified` where verification is required;
- billing status is `billing_hold`, `past_due`, `unpaid`, `canceled`, `incomplete`, `incomplete_expired`, or `paused`;
- subscription cancellation policy says access is revoked;
- an access grant is revoked, expired, or not yet active;
- required group membership is missing;
- lesson order enforcement blocks the requested lesson;
- the course, module, lesson, group, or space is not published.

Preview lessons and public spaces are the only exceptions, and they must be explicitly marked as preview/public.

### Idempotency and audit

Every external event must be idempotent:

- Stripe events keyed by Stripe event ID.
- Resend emails keyed by deterministic idempotency keys.
- Migration imports keyed by source system and source ID.
- Admin manual grants keyed by a created audit event.

Every permission-changing action must write an audit event:

- grant access;
- revoke access;
- payment received;
- payment failed;
- subscription created;
- subscription canceled;
- account blocked;
- account restored;
- group membership added or removed;
- admin override.

## Target capability map

### Learner capabilities

- Create an account.
- Verify email if required.
- Reset/change password.
- See enrolled/available/locked courses.
- Resume lessons.
- View public preview lessons.
- Access paid/private courses only with valid entitlements.
- See why content is locked.
- Join public groups when allowed.
- Request or receive access to private/secret groups.
- Participate in course discussions and group chat when authorized.
- Download lesson or group files when authorized.

### Admin capabilities in Payload

- See all members.
- See member account status, billing status, subscriptions, payments, access groups, course enrollments, group memberships, and email history.
- Grant or revoke course/group access manually.
- Block or restore accounts.
- Assign members to access groups.
- Manage courses, modules, lessons, files, preview lessons, drip/schedule rules, and lesson order enforcement.
- Manage public, private, and secret groups/spaces.
- See Stripe webhook processing status and errors.
- See Resend email delivery attempts and dedupe keys.
- Run migration dry-runs and reconciliation reports.

### Billing and entitlement capabilities

- Stripe remains payment processor.
- Payload stores a billing projection for admin visibility and access decisions.
- Stripe webhook processing is idempotent.
- Active paid access is derived from Stripe subscription state plus manual grants.
- Failed payment blocks paid/private entitlements automatically.
- Subscription cancellation blocks paid/private entitlements according to the chosen business policy.
- Payment recovery restores access automatically after verified Stripe recovery.

### CRM and email capabilities

- Payload stores contacts, tags, segments, lifecycle events, notes, and email logs.
- Resend sends transactional emails.
- Email templates are versioned and reviewed.
- Student and admin notifications are separate.
- Marketing/broadcast automation is a later phase unless explicitly approved.

### Community capabilities

- Groups/spaces can be public, private, or secret.
- Spaces can contain posts, comments, files, and chat/discussion areas.
- Roles are scoped per space: member, moderator, admin.
- Access can come from subscription plan, manual grant, member group, CRM tag, or migration import.

## Proposed Payload collection model

Do not create all collections in one change. Create them in the phase order below.

### Existing collections

| Collection | Keep or change | Notes |
|---|---|---|
| `payload_users` | Keep | CMS admin/editor users only. Not students. |
| `payload_media` | Keep | Shared upload/media collection. |
| `payload_pages` | Keep | CMS pages. |
| `payload_posts` | Keep | Blog/articles. |
| `payload_categories` | Keep | Existing taxonomy. |
| `payload_courses` | Prototype now, later promote or replace | Must not enforce access until redesigned. |
| `payload_course_modules` | Prototype now, later promote or replace | Module/section records. |
| `payload_lessons` | Prototype now, later promote or replace | Lesson records. |
| `payload_course_access_preview` | Remove or archive before production entitlement work | Visual-only collection. Not an authorization system. |

### Member identity

| Collection | Purpose |
|---|---|
| `payload_members` | Student/client auth collection. Separate from CMS admin users. |
| `payload_member_profiles` | Display name, avatar, timezone, consent flags, optional phone/company fields. |
| `payload_member_security_events` | Password reset, password change, login failure, verification, block/restore audit. |

### Course content

| Collection | Purpose |
|---|---|
| `payload_courses` | Course title, slug, status, privacy, layout, thumbnail, description, enrollment type, drip/schedule policy, access policy relationship. |
| `payload_course_modules` | Ordered sections belonging to one course. |
| `payload_lessons` | Ordered lesson content, media embeds, resources, preview flag, comments flag, duration, required previous lesson. |
| `payload_private_media` | Protected course resource files stored outside the public static directory. |
| `payload_lesson_resources` | Downloadable files scoped to lesson/course access. Use `protectedFile` for private resources; public `file` is only for non-confidential fallback assets. |
| `payload_course_enrollments` | Member enrollment in a course, enrollment source, enrollment date, status. |
| `payload_lesson_progress` | Per-member lesson progress and completion timestamps. |

### Groups, spaces, and chat

| Collection | Purpose |
|---|---|
| `payload_member_groups` | Admin-managed cohorts such as Free, Pro, VIP, Sponsor, Client, Staff. |
| `payload_spaces` | Public/private/secret community spaces or chat groups. |
| `payload_space_memberships` | Member role and status within a space. |
| `payload_space_posts` | Discussion posts scoped to a space. |
| `payload_space_comments` | Comments/replies scoped to posts and space access. |
| `payload_space_files` | Files/documents scoped to authorized space members. |
| `payload_chat_threads` | Chat rooms or group chat threads. |
| `payload_chat_messages` | Chat messages. POC may start as async messages; real-time delivery is a later implementation detail. |

### Access and entitlements

| Collection | Purpose |
|---|---|
| `payload_access_groups` | Named access bundles, e.g. Pro Courses, VIP Mastermind, Private Client Group. |
| `payload_access_policies` | Defines which subscriptions, manual grants, groups, tags, or users can access a course/space. |
| `payload_access_grants` | Explicit grant to member or group for course, lesson, space, or access group. |
| `payload_entitlement_events` | Append-only events generated from Stripe/admin/migration decisions. |
| `payload_audit_events` | Admin and system audit trail for access-affecting actions. |

### Billing

| Collection | Purpose |
|---|---|
| `payload_billing_accounts` | Member to Stripe customer mapping. |
| `payload_subscriptions` | Stripe subscription projection: plan, status, current period, cancellation flags. |
| `payload_payments` | Invoice/payment projection for admin visibility. |
| `payload_stripe_events` | Idempotent Stripe event log for Payload-era processing. |
| `payload_billing_actions` | Admin-visible actions such as retry link sent, portal opened, manual sync. |

### CRM and email

| Collection | Purpose |
|---|---|
| `payload_contacts` | CRM contact record tied to member where applicable. |
| `payload_crm_tags` | Tags equivalent to FluentCRM tags. |
| `payload_contact_tags` | Contact/tag relationship and source. |
| `payload_contact_notes` | Admin notes. |
| `payload_email_templates` | Reviewed transactional templates. |
| `payload_email_events` | Email send log, template key, recipient, status, idempotency key. |
| `payload_admin_notifications` | Admin-facing notifications and follow-up tasks. |

## Access model

### Grant sources

Access may come from:

- active Stripe subscription plan;
- explicit manual grant;
- membership in a member group;
- CRM tag mapping;
- migration import;
- public/preview content setting.

### Access decision order

Every learner-facing request must evaluate access in this order:

1. Load member account and account status.
2. Deny if account is blocked, suspended, deleted, or unverified where verification is required.
3. Load billing projection and current subscription status.
4. Deny paid/private content if billing is in a deny state.
5. Load content status and privacy.
6. Allow public published content.
7. Allow preview lessons only when `previewLesson=true`.
8. Load active grants, access groups, CRM tag mappings, and space memberships.
9. Deny if no active grant matches.
10. Apply lesson-order/drip/schedule rules.
11. Return allow with the matched grant and reason.

Never infer access from a badge, label, role name, email domain, or UI state.

### Stripe status mapping

| Stripe status/event | Default Payload access result |
|---|---|
| `active` | Allow paid access for matching plan. |
| `trialing` | Allow only if trial access is explicitly enabled for the plan. |
| `past_due` | Block paid/private access unless a documented grace-period policy is approved. |
| `unpaid` | Block paid/private access. |
| `canceled` | Block paid/private access. |
| `incomplete` | Block paid/private access. |
| `incomplete_expired` | Block paid/private access. |
| `paused` | Block paid/private access. |
| `invoice.payment_failed` | Set `billing_hold` and block paid/private access. |
| `invoice.paid` | Recompute subscription and restore only if subscription is now allowed. |
| `customer.subscription.deleted` | Revoke subscription-derived access. |

Business policy decision: if a customer cancels but remains paid through the current period, the user's requested default is immediate blocking on cancellation. The Payload course access service therefore treats `cancelAtPeriodEnd` and `canceledAt` as denied billing state even when the Stripe subscription status is still `active`.

## Email contract

All emails must be logged in `payload_email_events` before or during send.

Use deterministic Resend idempotency keys:

```text
account-created:{memberId}
password-reset:{memberId}:{resetTokenHash}
password-changed:{memberId}:{securityEventId}
payment-succeeded:{stripeInvoiceId}
subscription-started:{stripeSubscriptionId}
subscription-canceled:{stripeSubscriptionId}:{eventId}
payment-failed:{stripeInvoiceId}:{eventId}
access-blocked:{memberId}:{reason}:{eventId}
access-restored:{memberId}:{reason}:{eventId}
admin-notification:{eventType}:{eventId}
```

### Required student emails

- Account created / verify email.
- Password reset.
- Password changed.
- Payment succeeded.
- Subscription started.
- Subscription canceled or access ending.
- Payment failed and access blocked.
- Payment recovered and access restored.
- Manual access granted or revoked.

### Required admin emails

- New account created.
- Payment succeeded.
- Payment failed.
- Subscription started.
- Subscription canceled.
- Account blocked.
- Access manually granted or revoked.
- Migration import errors.
- Stripe webhook processing errors.

Email side effects must run through a durable task or queue after the state change is recorded. Do not send email first and write state second.

## Implementation sequence

Each step must be small enough to review independently. Do not skip phases.

### Phase 0 - Documentation and repository alignment

#### Task 0.1 - Confirm branch and dirty state

Read:

- `git status --short`
- `git branch --show-current`
- `src/payload.config.ts`
- `src/collections/PayloadCoursePrototype.ts`
- `src/migrations/index.ts`
- `src/migrations/20260620_213328.ts`

Done when:

- The branch name is recorded.
- Unrelated user changes are identified and not touched.
- Registered Payload collections and existing migrations are compared.

#### Task 0.2 - Fix documentation inventory

Update docs to identify:

- baseline Payload tables;
- registered prototype course collections;
- completed course-system Payload migration;
- visual-only access collection limitations.

Done when:

- `docs/PAYLOAD_CMS.md` distinguishes the baseline migration from `20260621_194424_course_system_phase1`.
- `docs/PAYLOAD_MIGRATION.md` points full course/community replacement work to this plan.

#### Task 0.3 - Decide identity boundary

Decision:

- `payload_users` remains admin/editor only.
- `payload_members` is the student/client auth collection.

Done when:

- The decision is written in this plan and referenced in the implementation PR.

### Phase 1 - Safe visual prototype completion

Purpose: client-visible proof of the course UX, still no real auth, payments, permissions, emails, CRM, chat, or migration.

#### Task 1.1 - Generate and inspect course-system Payload migration

Run the documented Payload migration workflow for the already-registered prototype collections.

Done when:

- `src/migrations/20260621_194424_course_system_phase1.ts` exists.
- It creates only `payload_` prefixed course-system tables and required enum/index/relationship tables.
- It does not alter Prisma tables, WordPress data, Stripe routes, or existing production tables.

Stop if:

- The migration drops or renames any existing table.
- The migration touches non-Payload tables.
- The migration would run against production before review.

#### Task 1.2 - Keep prototype behind a feature flag

Use the existing `src/lib/payloadCoursePrototype.ts` boundary.

Done when:

- `/course-preview` is disabled unless explicitly enabled in development or an approved demo environment.
- Every preview page displays a visible prototype banner.

#### Task 1.3 - Connect preview routes to Payload demo records or document static status

The current route files appear to use static demo content. Choose one:

- connect the routes read-only to Payload prototype records; or
- document that this is a static visual mock, not a Payload data demo.

Done when:

- The demo truthfully represents its data source.
- There is no implication that badges or lock states enforce access.

#### Task 1.4 - Client demo validation

Done when:

- Dashboard, course overview, lesson page, mobile layout, empty state, locked state, and published/draft visual states are demoed.
- Client approves terminology, hierarchy, and UX direction before functional work starts.

### Phase 2 - Production data model scaffold

Purpose: create the production Payload schema with no external side effects.

#### Task 2.1 - Create collection files by domain

Create collection modules under clear folders:

```text
src/collections/members/
src/collections/courses/
src/collections/access/
src/collections/billing/
src/collections/crm/
src/collections/community/
src/collections/audit/
```

Done when:

- Collections compile.
- Each collection has explicit `slug`, `dbName`, `labels`, `admin.defaultColumns`, and timestamps where useful.
- Every `dbName` starts with `payload_`.

#### Task 2.2 - Add access functions defaulting to deny

Create shared access helpers:

```text
src/lib/access/
  requirePayloadAdmin.ts
  requireMemberSelf.ts
  denyPublicWrite.ts
  allowPublishedPublicRead.ts
```

Done when:

- Public write is denied everywhere.
- Admin collections require Payload admin access.
- Member self-read/update is scoped to the current member.
- User-facing reads never rely on Local API's default access bypass.

#### Task 2.3 - Generate production schema migration

Done when:

- `pnpm payload migrate:create` produces a reviewed migration.
- The migration only creates new `payload_` tables, enums, indexes, and relationship tables.
- `git diff` of the migration is inspected before any deploy.

### Phase 3 - Member accounts and authentication

Purpose: account creation and password flows without paid access.

#### Task 3.1 - Create `payload_members` auth collection

Fields:

- email;
- account status: `pending`, `active`, `blocked`, `suspended`, `deleted`;
- email verification state;
- display relationship to `payload_member_profiles`;
- billing hold reason summary;
- last login metadata;
- source: `self_signup`, `admin_created`, `stripe_checkout`, `migration`.

Done when:

- A member can be created in a local/staging environment.
- Admin users remain in `payload_users`.
- Students cannot access the Payload admin panel.

#### Task 3.2 - Configure auth emails through Resend

Done when:

- Account creation, verification, reset password, and password changed emails use reviewed templates.
- Every email writes a `payload_email_events` record.
- Resend idempotency keys are used.

#### Task 3.3 - Add account blocking service

Create:

```text
src/lib/members/blockMember.ts
src/lib/members/restoreMember.ts
```

Done when:

- Block/restore writes audit events.
- Blocking immediately denies paid/private course and group access.
- Admin and student emails are queued after the state change is stored.

### Phase 4 - Entitlement engine

Purpose: a single source of truth for course/group access before Stripe writes to it.

#### Task 4.1 - Implement pure access evaluator

Create:

```text
src/lib/entitlements/evaluateAccess.ts
```

Inputs:

- member;
- requested resource;
- subscription projection;
- grants;
- groups;
- course/space privacy;
- lesson progress rules.

Output:

```ts
type AccessDecision = {
  allowed: boolean
  reason: string
  matchedGrantId?: string
  denyCode?: string
}
```

Done when:

- Unit tests cover public, preview, private, secret, manual grant, group grant, expired grant, blocked account, failed payment, canceled subscription, and lesson-order lock.
- Deny wins over allow.

#### Task 4.2 - Add admin grant/revoke workflows

Done when:

- Admin can grant a member or group access to a course, lesson, space, or access group.
- Admin can revoke access.
- Every action writes `payload_audit_events`.
- The member sees the changed access after refresh.

#### Task 4.3 - Add entitlement reconciliation command

Create a script:

```text
scripts/payload/reconcile-entitlements.ts
```

Done when:

- It reports mismatches between subscriptions, grants, groups, and effective access.
- It has dry-run output.
- It does not mutate data unless an explicit `--apply` flag is later added and approved.

### Phase 5 - Stripe shadow billing sync

Purpose: mirror Stripe into Payload without changing current WordPress/FluentCRM behavior.

#### Task 5.1 - Add Payload billing projection collections

Create:

- `payload_billing_accounts`
- `payload_subscriptions`
- `payload_payments`
- `payload_stripe_events`
- `payload_billing_actions`

Done when:

- Admin can see billing projection records in Payload.
- No access is granted from these records yet.

#### Task 5.2 - Shadow-write from Stripe webhook handler

Extend current webhook processing behind a feature flag:

```text
PAYLOAD_BILLING_SHADOW_SYNC_ENABLED=false
```

Done when:

- Stripe events continue to process current WordPress/FluentCRM flow exactly as before.
- When enabled in staging, the handler also writes Payload billing projections.
- Duplicate Stripe events do not duplicate projections, emails, or entitlements.

Implementation status:

- `src/lib/stripe-webhook-handler.ts` calls `shadowSyncStripeEventToPayload(event)` after verified Stripe event handling and before the existing Prisma idempotency mark.
- The shadow call catches and logs Payload mirror failures so it cannot interrupt the current Stripe/WordPress flow.
- `src/lib/payloadCourse/stripeShadowSync.ts` writes `payload_stripe_events`, `payload_billing_accounts`, `payload_subscriptions`, `payload_payments`, `payload_billing_actions`, `payload_members`, `payload_contacts`, audit events, member security events, and queued email events by Payload Local API only.
- `PAYLOAD_BILLING_SHADOW_SYNC_ENABLED` is the activation gate. Leave it unset/false outside an approved staging replay.

#### Task 5.3 - Add billing hold and restore state transitions

Done when:

- `invoice.payment_failed` sets billing hold and blocks paid/private access in staging.
- `invoice.paid` recomputes status and restores access only when allowed.
- `customer.subscription.deleted` revokes subscription-derived access.
- Admin and student emails are queued once per event.

Implementation status:

- Code-level state transitions are implemented and unit-tested.
- Stripe can block or restore billing holds but does not override `suspended` or `deleted` member accounts.
- Actual staging webhook replay and representative member reconciliation remain required before cutover.

#### Task 5.4 - Run shadow comparison

Compare:

- current `customer_provisioning.current_plan`;
- live Stripe subscription;
- Payload `payload_subscriptions`;
- effective Payload access decision.

Done when:

- At least 20 representative members reconcile correctly in staging.
- All mismatches are classified before cutover.

### Phase 6 - Payload CRM and transactional email admin

Purpose: replace the FluentCRM dependency needed for course/member operations.

#### Task 6.1 - Add CRM collections

Create:

- `payload_contacts`
- `payload_crm_tags`
- `payload_contact_tags`
- `payload_contact_notes`
- `payload_email_templates`
- `payload_email_events`
- `payload_admin_notifications`

Done when:

- Admin can view a member/contact profile with tags, notes, email history, subscriptions, and access.

#### Task 6.2 - Map Stripe plans to tags/groups

Done when:

- Pro and VIP subscriptions map to configured CRM tags and member groups.
- Removing a subscription removes or archives derived tags/groups.
- Manual tags are not removed by Stripe automation unless explicitly derived from Stripe.

#### Task 6.3 - Build email template review workflow

Done when:

- Templates are editable only by authorized admins.
- Each template has a key, subject, audience, active flag, and last-reviewed date.
- Sending uses the active reviewed template.

Implementation status:

- `src/lib/payloadCourse/emailSender.ts` sends only queued `payload_email_events` and only with an active matching `payload_email_templates` record.
- Resend sends use the event `dedupeKey` as the SDK `idempotencyKey`, truncated with a SHA-256 suffix if needed to stay within Resend's 256 character limit.
- `scripts/payload/send-queued-emails.mts` defaults to dry-run without delivery-state writes and sends only with `--apply`.
- The sender is not cron-scheduled and is not enabled automatically in staging or production.

### Phase 7 - Learner frontend with real access

Purpose: replace the visual preview with authenticated, gated learner pages.

#### Task 7.1 - Build member dashboard

Route proposal:

```text
/learn
```

Done when:

- Member sees enrolled courses, available public courses, locked courses, and continue-learning state.
- Locked content explains the reason without leaking private lesson content.
- Admin/test users can verify access decisions.

Implementation status:

- `/learn/login` signs in only against the `payload_members` auth collection through Payload's server auth helper.
- `/learn` redirects unauthenticated visitors to `/learn/login?next=/learn`.
- `/learn` reads the current `payload_members` session from the Payload HTTP-only cookie and rejects `payload_users` admin sessions.
- `/learn` shows published courses with access decisions from `src/lib/payloadCourse/memberPortal.ts`.
- Locked courses show only course-level metadata and a lock reason; module and lesson outlines are fetched only after `evaluatePayloadCourseAccess` allows the member.
- `scripts/payload_member_portal.test.ts` covers the dashboard projection, locked-course no-lesson-fetch behavior, account projection, and member-profile self-access scoping.
- Public member registration is intentionally not enabled until email verification, abuse controls, and transactional templates are approved.

#### Task 7.1a - Build member account page

Route:

```text
/learn/account
```

Done when:

- Member sees their Payload account status and verification state.
- Member sees the Payload billing account projection, subscriptions, and active access groups.
- Member can update only their own profile fields.

Implementation status:

- `/learn/account` reads `payload_member_profiles`, `payload_billing_accounts`, `payload_subscriptions`, and active `payload_access_groups` for the current member.
- `payload_member_profiles` self-read/update now uses the `member` relationship instead of comparing the profile document id to the member id.
- Profile writes are handled by a server action scoped to the current Payload member session.

#### Task 7.2 - Build course overview

Route proposal:

```text
/learn/[courseSlug]
```

Done when:

- Course overview shows modules, lessons, preview state, completion state, and locked state.
- Private lessons are not fetched/rendered unless access allows it.

Implementation status:

- `/learn/[courseSlug]` redirects unauthenticated visitors to the member login route.
- The route returns 404 for missing/unpublished courses.
- It evaluates course access before loading modules and lesson outlines.
- Locked courses render course-level metadata and a lock reason only.
- Allowed courses render modules, lessons, preview badges, completion badges, and progress.

#### Task 7.3 - Build lesson page

Route proposal:

```text
/learn/[courseSlug]/[lessonSlug]
```

Done when:

- Lesson content, media, comments, and downloads are gated by the access evaluator.
- Mark-complete writes `payload_lesson_progress`.
- Lesson order enforcement is respected.

Implementation status:

- `/learn/[courseSlug]/[lessonSlug]` redirects unauthenticated visitors to member login.
- The route confirms that the lesson belongs to the requested published course.
- It evaluates lesson access and previous-lesson completion before rendering lesson details.
- Denied lessons render a generic lock view; title, summary, video, downloads, comments, and files are not shown.
- Allowed lessons render a controlled lesson shell and can write idempotent `payload_lesson_progress` completion records through `completeLessonAction`.
- Lesson-resource links are now rendered only for allowed lessons, and each download goes through `/learn/resources/[resourceId]`.
- The download route loads the current `payload_members` session, confirms the resource is published, recomputes lesson access including previous-lesson enforcement, and serves private files from `private/payload-course-media` with private no-store headers.
- Rich text rendering, comments, and media players remain future work and must keep their own server-side access checks.
- Do not upload confidential paid resources to the public `file` field. Production-confidential lesson resources must use `protectedFile` and should be included in migration reconciliation.
- Before cutover, `private/payload-course-media` must be mounted as durable storage or replaced with a Payload-supported storage adapter. Container-local files are acceptable for staging proof-of-concept testing only.

### Phase 8 - Groups, spaces, discussions, and chat

Purpose: FluentCommunity-like community behavior in Payload.

#### Task 8.1 - Build spaces with privacy

Done when:

- Public spaces are visible to permitted audiences.
- Private spaces show lock/request flow.
- Secret spaces are hidden unless the member has a grant or invite.

#### Task 8.2 - Build space memberships and roles

Done when:

- Admin can add/remove members.
- Admin can assign member, moderator, and admin roles.
- Members can request access to private spaces if enabled.
- Role changes write audit events.

#### Task 8.3 - Build discussions and comments

Done when:

- Authorized members can create posts and comments.
- Moderators can hide/delete posts.
- Unauthorized users cannot read private/secret posts.

#### Task 8.4 - Build group chat

POC default:

- Start with async chat messages persisted in Payload.
- Add real-time delivery only after the permission model is stable.

Done when:

- Only authorized members can read/write chat messages.
- Message writes are rate-limited and audited enough for moderation.
- Real-time implementation choice is documented before shipping.

### Phase 9 - Source audit and migration

Purpose: import WordPress, FluentCommunity, and FluentCRM data only after the target model exists.

#### Task 9.1 - Source inventory

Count and sample:

- WordPress users;
- FluentCommunity courses;
- course sections;
- lessons;
- course enrollments;
- progress;
- spaces/groups;
- space memberships;
- posts/comments;
- files/documents;
- FluentCRM contacts/tags;
- Stripe customers/subscriptions.

Done when:

- Counts are recorded.
- Sample records are mapped to target Payload collections.
- Missing fields are listed before import scripts are written.

#### Task 9.2 - Migration mapping document

Create or update:

```text
docs/PAYLOAD_COURSE_MIGRATION_MAPPING.md
```

Done when:

- Every source entity has target collection, target fields, transform rules, and unresolved issues.
- Public/private/secret source states map to Payload privacy states.
- Access source maps to entitlement source.

#### Task 9.3 - Dry-run import scripts

Scripts live under:

```text
scripts/migration/payload-course/
```

Done when:

- Scripts use source APIs, WP CLI export, or reviewed read-only DB exports.
- Scripts use Payload Local API for writes.
- Scripts are idempotent by source system and source ID.
- Dry-run reports create/update/skip/error counts.

#### Task 9.4 - Staging import and reconciliation

Done when:

- Imported course counts match source counts or documented exclusions.
- At least 20 representative members have correct courses, spaces, groups, progress, tags, and billing state.
- Admin can manage imported records in Payload.

### Phase 10 - Cutover

Purpose: move production authority from WordPress/FluentCommunity/FluentCRM to Payload.

Do not start without explicit approval.

#### Task 10.1 - Freeze source writes

Done when:

- WordPress course/community writes are paused or a delta window is documented.
- New Stripe events continue to be captured.
- Rollback window is declared.

#### Task 10.2 - Final delta import

Done when:

- Only changed records since staging import are imported.
- Reconciliation passes.

#### Task 10.3 - Enable Payload access authority

Done when:

- Feature flags point learner routes to Payload.
- Stripe webhook writes Payload entitlements as authoritative.
- WordPress provisioning and FluentCRM sync are disabled only after Payload has proven authority.

#### Task 10.4 - Rollback verification

Done when:

- A rollback can restore WordPress/FluentCommunity authority.
- No irreversible data loss path exists.
- Admins know which system is authoritative at every point.

## Validation gates

### Gate A - Visual prototype

- Existing WordPress portal unchanged.
- Existing Stripe checkout unchanged.
- Existing Stripe webhooks unchanged.
- Existing FluentCRM tags unchanged.
- No production email triggered by prototype.
- Prototype routes clearly marked.
- Prototype data is not real access data.

### Gate B - Schema scaffold

- All new tables are `payload_` prefixed.
- Migrations reviewed before deploy.
- No Prisma table changes.
- No WordPress table changes.
- Payload admin still loads.

### Gate C - Entitlements

- Unit tests cover allow and deny paths.
- Blocked account cannot access private content.
- Failed payment cannot access paid content.
- Canceled subscription cannot access paid content under selected business policy.
- Manual grant can allow access only while active.
- Revoked grant denies access immediately.

### Gate D - Stripe shadow

- Duplicate Stripe events are idempotent.
- Payment failed blocks once and emails once.
- Payment recovered restores once and emails once.
- Subscription canceled blocks once and emails once.
- Existing WordPress/FluentCRM flow still works during shadow mode.

### Gate E - Migration

- Source counts match target counts or documented exclusions.
- At least 20 representative members reconcile.
- No private content is public after import.
- No paid content is accessible without entitlement.
- Admin can grant/revoke imported access.

## Production definition of done

The full course system is production-ready only when:

1. Payload owns course content, modules, lessons, files, progress, groups, memberships, access grants, CRM records, email logs, billing projections, and audit events.
2. `payload_users` remains admin-only and `payload_members` owns student auth.
3. Stripe is the payment processor and Payload holds the authoritative access projection.
4. Failed payments and cancellations automatically block paid/private access.
5. Recovery and manual restore paths are tested.
6. Resend transactional emails are idempotent and logged.
7. Admins can see member, subscription, payment, course, group, and email state from Payload.
8. Admins can grant and revoke access from Payload.
9. Public/private/secret course and group privacy is enforced server-side.
10. Migration is reconciled and rollback is documented.

## Stop conditions

Stop and request an architectural decision if:

- a task requires changing current production Stripe behavior before shadow mode passes;
- a migration touches non-`payload_` tables;
- a user-facing route can fetch private lesson/group content before access is evaluated;
- Local API usage would bypass access control without an explicit service-level access check;
- a side effect sends email before durable state is written;
- a Stripe event cannot be processed idempotently;
- FluentCommunity source data shape is unknown;
- chat requires infrastructure not documented for Dokploy/Next.js;
- a cancellation policy decision is unresolved.

## Next recommended implementation slice

The first scaffolding slice is complete. Do this next:

1. Verify durable storage for `private/payload-course-media` in staging, or choose and configure a Payload storage adapter before production cutover.
2. Add community read routes only after access checks and moderation states are enforced server-side.
3. Add rich text/media rendering only after renderer behavior and sanitization are reviewed.
4. Add a reviewed scheduler/worker for `payload:email:send -- --apply` only after template review and staging replay are approved.

Keep the order: scaffolding and groundwork first, then shadow services, then functional runtime systems, then migration and cutover.
