# JPV Bootcamp Domain Source of Truth

**Status:** CURRENT A5.1 OWNERSHIP MAP — ARCHITECTURE CLOSED; A6 LIVE EVIDENCE GATED

**Date:** 2026-08-28

This map records what the current repository proves about each domain. “Source
of truth” means the system that owns the business fact; a read model, cache,
audit row, or provider mirror is not a second authority. **Split/ambiguous**
means the repository currently has more than one operational surface and the
packet named in the row must resolve the boundary before behavior is changed.

Direct access is a server-side rule. React pages and browser code do not gain
permission to write merely because a datastore is listed as authoritative.

## A2 boundary clarifications

A2 did not change domain ownership, stored data, routes, provider authority, or
the split rows below. It established the shared pure primitives used at those
boundaries and the complete portal administrator service map in
`JPV_PORTAL_ADMIN_SERVICE_MAP.md`:

- `src/lib/domain/validation.ts` owns slug, title, bounded-text, and scalar
  record-ID validation.
- `src/lib/domain/relationships.ts` owns extraction and Payload-write
  normalization for direct and populated relationship IDs.
- `src/lib/content/plainTextToLexical.ts` owns deterministic plain-text
  Payload Lexical serialization. The existing
  `src/lib/payloadCourse/plainTextRichText.ts` export remains a compatibility
  facade.
- `src/lib/normalize-email.ts#normalizeEmail` and
  `src/lib/payloadCourse/events.ts#createAuditEvent` remain the canonical email
  and audit primitives; no duplicates were introduced.

These helpers are transport-safe and do not authorize access. Authorization,
provider truth, cross-store ownership, and split-domain reconciliation remain
the responsibility of the named services and later packets.

## A4 course / Creator boundary clarifications

A4 preserves Payload as the authority for course, module, and lesson business
records. It changes only the in-repository service boundary: the public
administrator Server Actions remain in
`src/lib/portalAdmin/courseAdminActions.ts`, while bounded domain commands and
Payload persistence now live in `src/lib/courseAdmin/`:

- `courseCommands.ts` owns course normalization, slug conflicts,
  dependency-safe deletion, and course audit orchestration.
- `moduleCommands.ts` owns module validation, course relationships, complete
  reorder validation, rollback-aware persistence, and module audit
  orchestration.
- `lessonCommands.ts` owns lesson validation, module/course relationships,
  rich-text and media preservation, dependency-safe deletion, reorder
  validation, and lesson audit orchestration.
- `persistence.ts` owns Payload reads/writes and relationship traversal behind
  the named privileged access object; it is not an actor-policy or provider
  boundary.
- `policy.ts` owns explicit delete confirmation, exact reorder permutations,
  and duplicate-write classification.

The A4 refactor does not establish a second course authority, add a schema or
provider, alter member learning readers, or change Creator UI behavior. A5.1
closes the identity, projection, cross-store, and outbox ownership decisions
below. Runtime inventory, reconciliation, and provider proof remain A6
evidence requirements; they are not implied by this source map.

## A5.1 ownership closure — 2026-08-28

The A5.1 inventory and boundary changes confirm the following ownership
decisions in the current repository. This is source evidence, not live
production proof. The exact production database/schema, deployed runtime, and
provider state must still be verified by A6 before any apply operation.

| Domain | Current authority | Local writes | Projection / read model | A5 state |
| --- | --- | --- | --- | --- |
| Administrator identity | Payload `payload_users` | Read-only resolver during login; explicit `ensureAdministratorMemberIdentity`/guarded backfill for provisioning | `portalMember` link and member-facing profile | **RESOLVED — architecture closed:** admin identity remains distinct; linking never creates subscription entitlement |
| Member identity/profile | Payload `payload_members` and `payload_member_profiles` | named member account/profile services and checkout provisioning | shared membership read model and portal directory | **RESOLVED — architecture closed:** provider identities are matched stable-ID-first; unmatched/duplicate rows remain review-required |
| Courses/modules/lessons | Payload collections | A4 course/module/lesson commands and Payload Admin | member course/access readers | Confirmed Payload authority; A4 boundary preserved |
| Community/engagement | Payload community and engagement collections | community commands, member transports, moderation services | derived counts, notifications, portal views | Confirmed Payload authority; privileged occurrences registered |
| Billing/customer/subscription/payment | Stripe | Stripe checkout, webhook, and guarded operator services | Payload billing collections are the canonical local projection/read model; Prisma `customer_provisioning` is an operational checkpoint and legacy compatibility surface | **RESOLVED — architecture closed:** Stripe wins conflicts; projection direction is Stripe → Payload; exact-ID-first matching and review-required unknowns/duplicates are mandatory |
| Support | Prisma `support_requests` | support intake and operator-review service | Payload membership-support records are a one-way membership/billing projection, not the intake authority | **RESOLVED — architecture closed:** Prisma owns intake/review status; writes use the named support persistence service and are idempotent at request/dedupe level |
| Sponsored access | Prisma `sponsored_seats`, `sponsored_applications`, `sponsored_grants` | named sponsored seat/claim/grant services and guarded admin actions | Payload membership-support/funding/review records are administrative projections; Stripe remains recipient billing truth | **RESOLVED — architecture closed:** Prisma owns seat/grant transactions; an approved application reserves/claims one seat exactly once; review state is projected to Payload |
| Partner/affiliate | Payload partner/affiliate business records; Prisma hashed session/click telemetry | named partner/application/delivery/reporting services | reports join by explicit Payload partner/application identifiers and optional internal account ID; telemetry never establishes membership or partner state | **RESOLVED — architecture closed:** Payload owns business facts; telemetry is non-authoritative, time-bounded, and reconstructable from source events where retained |
| Email | Resend provider delivery status | Payload `payload_email_events` enqueue/dedupe/retry path and `emailSender` | Prisma `email_events` is legacy compatibility/history for old workflows; it is not a second sender for new domain events | **RESOLVED — architecture closed:** Payload event `dedupeKey` owns current idempotency; Resend owns provider delivery status; legacy Prisma queue remains directional and must not double-send |
| Bunny media | Bunny/object storage for binaries; Payload for metadata | guarded provider/media services | protected media metadata and delivery resolver | Provider/Payload split is intentional; live delivery proof belongs to A6 |
| LiveKit | LiveKit for room/participant runtime; Payload for session metadata | session lifecycle and server token route | audience/session metadata | Provider/Payload split is intentional; multi-client proof belongs to A6 |

Identity matching is stable-ID-first: Stripe customer ID, then normalized email
only when the result is unambiguous. Unmatched and duplicate identities remain
review items; they are never silently assigned. Administrator links create no
synthetic subscription and do not inflate subscribed-member counts.

## Domain map

| Domain | Authoritative datastore/provider | Read path | Write path | Projection/cache | Owning service/module | Direct Payload/Prisma access |
| --- | --- | --- | --- | --- | --- | --- |
| Courses | Payload `payload_courses` | Portal course/member readers and course routes | Payload Admin; portal creator actions where exposed | None established as a second authority | `src/lib/payloadCourse/memberPortal.ts`, `src/lib/courseAdmin/courseCommands.ts`, `src/lib/courseAdmin/persistence.ts` | Payload SDK through service boundary; direct Prisma no |
| Modules | Payload `payload_course_modules` | Course/member portal readers | Payload Admin and course Creator commands | None established | `src/lib/courseAdmin/moduleCommands.ts`, `src/lib/courseAdmin/persistence.ts` | Payload SDK through service boundary; direct Prisma no |
| Lessons | Payload `payload_lessons` | Lesson routes and course portal readers | Payload Admin and course Creator commands | None established | `src/lib/courseAdmin/lessonCommands.ts`, `src/lib/courseAdmin/persistence.ts`, lesson resource services | Payload SDK through service boundary; direct Prisma no |
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
| Billing accounts | Stripe customer/account is commercial authority; Payload billing account is the canonical local projection | Member billing overview and admin billing read models; Prisma helper is operational enrichment only | Stripe checkout/webhook/operator service; one-way projection via shadow sync | Payload `payload_billing_accounts`; Prisma `customer_provisioning` is an operational checkpoint/legacy fallback | Billing modules, `stripeShadowSync.ts`, `membershipReadModel.ts` | No direct Payload projection edits; Prisma only in named operational services |
| Subscriptions | Stripe subscription is provider truth | Payload subscription projection for portal/admin display, with explicit operational compatibility fallback | Stripe checkout/operator actions/webhook; one-way local projection sync | Payload `payload_subscriptions` is the canonical local subscription projection; Prisma records are not a competing authority | `stripePayloadReconciliation.ts`, `membershipLifecycle.ts`, `commitmentProjection.ts` | Stripe mutations only through guarded service; local projection writes not from UI |
| Payments/invoices | Stripe payment/invoice objects | Billing status/portal and reconciliation readers | Stripe checkout/webhook/operator service | Payload `payload_payments` and any operational records are projections/audit | Billing reconciliation and operator action modules | Stripe provider API through service; direct Prisma no |
| Stripe provider state | Stripe | Stripe SDK calls and signed webhook route | Stripe API through explicit checkout/operator actions; signed `/api/webhook/stripe` | Payload Stripe event/shadow collections and Prisma `stripe_webhook_events` record delivery/processing | `src/app/api/webhook/stripe/route.ts`, `stripeShadowSync.ts` | Never treat local rows as provider truth; no page-level Stripe calls |
| Support | Prisma `support_requests` is the canonical frontend intake and operator-review ledger; Payload membership-support records are projections for membership/billing workflows | Support APIs and operations inbox | Support persistence service writes Prisma; projections/audit may flow to Payload through named workflows | Review/notification statuses are authoritative in Prisma for support intake | `support/persistence.ts`, `membership-support/*`, support API, `adminReadModel.ts` | Direct access only in named support services; no ad hoc cross-store writes |
| Sponsored seats/applications | Prisma `sponsored_seats`, `sponsored_applications`, `sponsored_grants` own inventory, application, reservation, claim, and grant transactions; Payload membership-support collections are review/funding projections | Sponsored pages/APIs plus Payload operations/cockpit | Sponsored services and guarded admin grant flow; Stripe remains recipient billing truth | Availability/counts are derived from the Prisma seat ledger; admin review is projected to Payload | `sponsored/claimSponsoredSeat.ts`, `sponsored-seats.ts`, `sponsored-grants.ts`, `membership-support/*` | No ad hoc cross-store writes; claim is idempotent and token-bound |
| Partner/affiliate operations | Payload affiliate/partner collections own business records; Prisma `partner_sessions`/`partner_clicks` own hashed click/session telemetry | Partner portal/reporting and admin readers | Partner delivery/application/reporting services | Reporting joins explicit partner/application identifiers and optional account IDs; telemetry is non-authoritative | `partnerAffiliateReporting.ts`, `payloadCourse/partner*`, affiliate modules | Named service access only; telemetry retention/recovery cannot change business membership state |
| Email/outbox | Resend is delivery provider; Payload `payload_email_events` is the canonical current outbox/delivery ledger; Prisma `email_events` is legacy compatibility/history | `payloadCourse/events.ts`, `emailSender.ts`, email operator actions | Domain event producers enqueue Payload events; worker sends through Resend and records delivery | Payload events own current dedupe/retry state; old Prisma workflows remain isolated and must not duplicate current sends | `payloadCourse/events.ts`, `payloadCourse/emailSender.ts`, `email/emailOperatorActions.ts`, legacy `email.ts` | No direct provider calls from pages; legacy Prisma queue is not a second current outbox |
| Bunny/media | Bunny/object storage is binary/provider authority; Payload `payload_media`, `bunny_videos`, and file/resource rows own application metadata | Protected delivery/media resolver APIs | Guarded upload/import/provider service plus Payload metadata write | Payload records are metadata and entitlement references | `payload-media-storage.ts`, `bunnyProtectedMedia.ts`, `memberMedia.ts` | Provider access server-side only; no direct Prisma media authority |

## Rules after A5.1 closure

1. A split row is not permission to synchronize both sides opportunistically.
2. Provider truth, local projection, operational ledger, and audit record must
   be named separately in any A1–A6 change proposal.
3. A reconciliation must be idempotent, scoped to one environment, and produce
   a review list for ambiguous identities or failed joins.
4. No migration or backfill may infer ownership from an email address when an
   explicit stable identifier is available or when the email match is not
   unique.
5. After A5.1, architecture is closed but runtime proof is still required:
   unknown, stale, unmatched, or ambiguous state remains a truthful
   review-required result rather than a guessed assignment.

## Evidence and limits

This is a source-repository map produced during A5.1. It is not a live database
dump, Stripe inventory, provider audit, or deployed-runtime proof. Runtime and
data counts must be reverified against the exact production environment before
any A6 reconciliation, migration, backfill, or provider authorization.
