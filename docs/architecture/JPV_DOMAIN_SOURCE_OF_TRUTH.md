# JPV Bootcamp Domain Source of Truth

**Status:** CURRENT A0 OWNERSHIP MAP — REVIEW INPUT FOR A1–A4

**Date:** 2026-08-27

This map records what the current repository proves about each domain. “Source
of truth” means the system that owns the business fact; a read model, cache,
audit row, or provider mirror is not a second authority. **Split/ambiguous**
means the repository currently has more than one operational surface and the
packet named in the row must resolve the boundary before behavior is changed.

Direct access is a server-side rule. React pages and browser code do not gain
permission to write merely because a datastore is listed as authoritative.

## Domain map

| Domain | Authoritative datastore/provider | Read path | Write path | Projection/cache | Owning service/module | Direct Payload/Prisma access |
| --- | --- | --- | --- | --- | --- | --- |
| Courses | Payload `payload_courses` | Portal course/member readers and course routes | Payload Admin; portal creator actions where exposed | None established as a second authority | `src/lib/payloadCourse/memberPortal.ts`, `src/lib/portalAdmin/courseAdminActions.ts` | Payload SDK through service boundary; direct Prisma no |
| Modules | Payload `payload_course_modules` | Course/member portal readers | Payload Admin and course admin operations | None established | Course portal/admin modules | Payload SDK through service boundary; direct Prisma no |
| Lessons | Payload `payload_lessons` | Lesson routes and course portal readers | Payload Admin and course admin operations | None established | Course portal/admin modules; lesson resource services | Payload SDK through service boundary; direct Prisma no |
| Resources | Payload metadata (`payload_lesson_resources`, private media records) plus Bunny/object storage for binaries | `lessonResources.ts`, `lessonResourceDelivery.ts`, protected media readers | Admin/creator content operations; provider upload/update through guarded service | Payload metadata points to provider asset | `src/lib/payloadCourse/lessonResources.ts`, `bunnyProtectedMedia.ts` | Payload metadata only through service; provider credentials never in UI/Prisma |
| Community spaces | Payload `payload_member_groups`, `payload_spaces`, `payload_space_memberships` | `communityPortal.ts`, `spaceMemberships.ts`, community routes | `communityAdminActions.ts` and Payload Admin | No independent space authority identified | Community portal/admin modules | Payload SDK through service boundary; direct Prisma no |
| Community posts/comments | Payload `payload_space_posts`, `payload_space_comments`; lesson discussions use `payload_lesson_comments` | `communityDiscussion.ts`, `lessonDiscussion.ts`, post/lesson routes | `communityPosting.ts`, `lessonDiscussion.ts`, moderation/admin services | Visibility and counts are computed from Payload records | Community posting/discussion/moderation modules | Payload SDK through service boundary; direct Prisma no |
| Reactions/bookmarks | Payload `payload_space_reactions` and `payload_engagement_reactions` | `reactions.ts`, `bookmarks.ts`, portal reaction/bookmark routes | Domain reaction service and portal routes; Payload member collection writes are not the public contract | Counts are derived from Payload reaction rows | `src/lib/payloadCourse/reactions.ts`, `bookmarks.ts` | Payload SDK through service boundary; direct Prisma no |
| Members | Payload `payload_members` | `memberPortal.ts`, `memberDirectory.ts`, auth/session readers | Registration, checkout provisioning, invitations, admin operations | Billing/access may project onto member state | `src/lib/members/*`, `payloadCourse/memberPortal.ts` | Payload SDK through service boundary; direct Prisma no |
| Member profiles | Payload `payload_member_profiles` | `memberPortal.ts`, `memberDirectory.ts`, profile/account routes | Profile/account services and Payload Admin | Profile is linked to a member; it is not a separate identity | `updateMemberProfile.ts`, member portal modules | Payload SDK through service boundary; direct Prisma no |
| Administrator identity links | Payload `payload_users` plus explicit `portalMember` relationship | Admin auth and membership read model | Guarded administrator-link/backfill operation and Payload Admin | Linked member profile is an explicit projection/link, never a synthetic subscription | `membershipReadModel.ts`, identity reconciliation modules | Payload SDK only in guarded service; no direct Prisma identity writes |
| Enrollments and access | Payload enrollment/access collections (`payload_course_enrollments`, access groups/policies/grants, entitlement events) | `accessService.ts`, course/live/community readers | `adminGrants.ts`, `spaceMemberships.ts`, guarded admin/domain operations | Access evaluation is a read computation over Payload records and membership lifecycle | `src/lib/payloadCourse/accessService.ts` | Payload SDK through domain service; direct Prisma no |
| Lesson progress | Payload `payload_lesson_progress` | Lesson/course portal progress readers | Lesson completion/progress service and authorized portal action | Dashboard/course progress is a derived view | Portal lesson/member modules | Payload SDK through service boundary; direct Prisma no |
| Portal settings/navigation/pages | Payload globals `PortalSettings`, `PayItForwardSettings`; `payload_portal_nav_items`, `payload_pages`, `payload_posts` | `portalSettings.ts`, `portal-navigation.ts`, `payloadContent/*` | Payload Admin today; content-specific Creator Mode writes are an A5 consolidation target | Navigation has a 60-second Next cache tagged `portal-nav`; invalidation contract must be preserved | Portal settings/navigation/content modules | Payload SDK through service boundary; direct Prisma no |
| LiveKit session metadata | Payload `live_sessions` | `liveSessions/memberSessions.ts`, live-session routes/pages | `sessionLifecycle.ts`, portal admin live-session actions, or Payload Admin | LiveKit room/participant state is provider runtime, not Payload truth | `src/lib/liveSessions/*`, `src/app/api/livekit/*` | Payload via session service; LiveKit API only server-side |
| LiveKit room state | LiveKit provider | Token route and LiveKit client runtime | Server token/room operations through LiveKit SDK | Payload stores session metadata and room name | `livekit-config.ts`, `livekit-jwt.ts`, session lifecycle | No browser/provider credential or Prisma direct access |
| Billing accounts | Stripe customer/account is commercial authority; Payload billing account is local projection | Billing portal/read model and `billingStatusHelper.ts` | Stripe checkout/webhook/operator service; projection via shadow sync | Payload `payload_billing_accounts`; Prisma `customer_provisioning` also exists | Billing modules, `stripeShadowSync.ts`, `membershipReadModel.ts` | No direct Payload projection edits; Prisma only in named operational services |
| Subscriptions | Stripe subscription is provider truth | Stripe-backed billing/read-model routes and reconciliation | Stripe checkout/operator actions/webhook; local projection sync | Payload `payload_subscriptions`; Prisma legacy/operational records also exist | `stripePayloadReconciliation.ts`, `membershipLifecycle.ts`, `commitmentProjection.ts` | Stripe mutations only through guarded service; local projection writes not from UI |
| Payments/invoices | Stripe payment/invoice objects | Billing status/portal and reconciliation readers | Stripe checkout/webhook/operator service | Payload `payload_payments` and any operational records are projections/audit | Billing reconciliation and operator action modules | Stripe provider API through service; direct Prisma no |
| Stripe provider state | Stripe | Stripe SDK calls and signed webhook route | Stripe API through explicit checkout/operator actions; signed `/api/webhook/stripe` | Payload Stripe event/shadow collections and Prisma `stripe_webhook_events` record delivery/processing | `src/app/api/webhook/stripe/route.ts`, `stripeShadowSync.ts` | Never treat local rows as provider truth; no page-level Stripe calls |
| Support | **Split/ambiguous:** Prisma `support_requests` is the frontend intake record; Payload membership-support records/read models also exist | Support APIs and membership-support admin read models | Frontend support route writes Prisma; operator workflows may write Payload support/audit records | Review/notification statuses exist in both operational paths | `membership-support/*`, support API, `adminReadModel.ts` | Direct access only in named support services; A1/A4 must choose the canonical review record |
| Sponsored seats/applications | **Split/ambiguous:** Prisma `sponsored_seats`, `sponsored_applications`, `sponsored_grants` hold the operational grant flow; Payload membership-support collections hold funding/review/audit projections | Sponsored pages/APIs plus Payload operations/cockpit | Sponsored services, Stripe webhook, guarded admin grant flow | Availability/counts and admin review projections | `sponsored-seats.ts`, `sponsored-grants.ts`, `membership-support/*` | No ad hoc cross-store writes; A4 must define transaction and reconciliation ownership |
| Partner/affiliate operations | **Split/ambiguous:** Payload affiliate/partner collections own business records; Prisma `partner_sessions`/`partner_clicks` own hashed click/session telemetry | Partner portal/reporting and admin readers | Partner delivery/application/reporting services | Reporting derives from both records and telemetry | `partnerAffiliateReporting.ts`, `payloadCourse/partner*`, affiliate modules | Named service access only; A4 must define reporting join boundary |
| Email/outbox | Resend is delivery provider; local outbox is **split/ambiguous** between Payload `payload_email_events` and Prisma `email_events` in `prisma/system.prisma` | `email.ts`, `emailSender.ts`, CRM/email operator actions | Domain event producers enqueue; worker sends through Resend and records delivery | Payload email events expose delivery/audit; Prisma email events are operational legacy/current state depending on workflow | `src/lib/email.ts`, `payloadCourse/emailSender.ts`, `email/emailOperatorActions.ts` | No direct provider calls from pages; A3/A4 must prevent duplicate outboxes |
| Bunny/media | Bunny/object storage is binary/provider authority; Payload `payload_media`, `bunny_videos`, and file/resource rows own application metadata | Protected delivery/media resolver APIs | Guarded upload/import/provider service plus Payload metadata write | Payload records are metadata and entitlement references | `payload-media-storage.ts`, `bunnyProtectedMedia.ts`, `memberMedia.ts` | Provider access server-side only; no direct Prisma media authority |

## Rules for unresolved ownership

1. A split row is not permission to synchronize both sides opportunistically.
2. Provider truth, local projection, operational ledger, and audit record must
   be named separately in any A1–A6 change proposal.
3. A reconciliation must be idempotent, scoped to one environment, and produce
   a review list for ambiguous identities or failed joins.
4. No migration or backfill may infer ownership from an email address when an
   explicit stable identifier is available or when the email match is not
   unique.
5. Until the named packet closes the ambiguity, the safe behavior is a truthful
   unknown/review state rather than a guessed assignment.

## Evidence and limits

This is a source-repository map produced during A0. It is not a live database
dump, Stripe inventory, provider audit, or deployed-runtime proof. Runtime and
data counts must be reverified against the exact production environment before
any A1–A4 implementation or migration authorization.
