# JPV Privileged Access Register

**Status:** CURRENT A5.1 REGISTER — ARCHITECTURE ENFORCEMENT

**Date:** 2026-08-28

**Evidence checkout:** `jpv-bootcamp-main`, branch
`codex/production-architecture-consolidation`, A4 parent
`c1fa6a0bdaf908013ed2a215e00ccd5200bf192d` before the A5 changes; A5.1
adds the named support and sponsored persistence boundaries.

This is the allowlist for exceptional Payload access in the repository. A
literal `overrideAccess: true` is not an authorization mechanism. It is a
server-side implementation detail that is permitted only where the named
route or service has already established the actor, operation, and reason.
The exact occurrence inventory is enforced by
`scripts/architecture_boundaries.test.ts`; adding, removing, or moving an
occurrence requires an intentional register update and review.

The local checkout is authoritative for this inventory. Workbench reported a
stale index for this branch (`indexStatus=pending`, `stale_revision`), so that
index is not evidence of the current file contents.

## Canonical boundary

`src/lib/payload/privilegedAccess.ts` is the only named constructor for the
typed privileged access object. It requires an already-authorized
administrator actor and a non-empty reason. The framework bootstrap and
collection configuration entries below are separately registered because they
are not portal actor-policy calls.

## Registered application occurrences

Counts are literal `overrideAccess: true` occurrences in the A5 baseline. The
domain and purpose describe why the occurrence exists; they do not authorize a
new caller.

### Portal reads, routes, and provider adapters

| Path | Count | Domain / purpose | Access | Prior authorization |
| --- | ---: | --- | --- | --- |
| `src/app/(frontend)/portal/[section]/page.tsx` | 1 | Portal section read | R | `requirePortalAccess` |
| `src/app/(frontend)/portal/community/[spaceSlug]/calls/[sessionId]/page.tsx` | 1 | Community call read | R | `requirePortalAccess` |
| `src/app/(frontend)/portal/community/[spaceSlug]/page.tsx` | 3 | Community space read | R | portal member/access gate |
| `src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx` | 5 | Post and discussion read | R | portal member/access gate |
| `src/app/(frontend)/portal/community/actions.ts` | 4 | Member community transport | W | actor policy and domain command |
| `src/app/(frontend)/portal/community/page.tsx` | 1 | Community index read | R | `requirePortalAccess` |
| `src/app/(frontend)/portal/content/page.tsx` | 1 | Member content read | R | `requirePortalAccess` |
| `src/app/(frontend)/portal/live-sessions/[sessionId]/page.tsx` | 2 | Live session read | R | portal access/session policy |
| `src/app/(frontend)/portal/live-sessions/page.tsx` | 2 | Live session index | R | portal access/session policy |
| `src/app/(frontend)/portal/notifications/page.tsx` | 2 | Notification read | R | `requirePortalAccess` |
| `src/app/api/bunny/video/route.ts` | 6 | Protected Bunny media resolver | R/W | member/admin access and provider boundary |
| `src/app/api/community/files/route.ts` | 2 | Community file delivery | R/W | community actor policy |
| `src/app/api/livekit/token/route.ts` | 5 | LiveKit token/session access | R | portal access and session policy |
| `src/app/api/portal/announcements/media/route.ts` | 1 | Announcement media upload | W | portal admin/content policy |
| `src/app/api/portal/announcements/route.ts` | 1 | Announcement transport | W | portal admin/content policy |
| `src/app/api/portal/bookmarks/route.ts` | 4 | Member bookmarks | R/W | member actor policy |
| `src/app/api/portal/community/comments/route.ts` | 1 | Comment transport | W | member actor policy |
| `src/app/api/portal/community/posts/delete/route.ts` | 3 | Member post deletion | W | ownership policy |
| `src/app/api/portal/live-sessions/[id]/route.ts` | 1 | Live session member access | R | session audience policy |
| `src/app/api/portal/live-sessions/route.ts` | 3 | Live session transport | R/W | portal admin/session policy |
| `src/app/api/portal/notifications/route.ts` | 6 | Notification state | R/W | portal member/access gate |
| `src/app/api/sponsored-applications/decision/route.ts` | 1 | Sponsored decision transport | W | token/admin policy |
| `src/app/api/webhook/bunny/route.ts` | 5 | Bunny webhook projection | W | signed/provider boundary |
| `src/app/api/admin/community-smoke-check/route.ts` | 4 | Admin verification route | R | `requirePortalAdmin` |
| `src/app/api/admin/operator-actions/route.ts` | 4 | Guarded operator actions | W | `requirePortalAdmin` and action policy |
| `src/app/api/admin/pay-it-forward/queue/route.ts` | 1 | Sponsored queue read | R | `requirePortalAdmin` |
| `src/app/api/admin/queued-emails/route.ts` | 5 | Email operations | R/W | `requirePortalAdmin` and email policy |
| `src/app/api/admin/sessions/[id]/route.ts` | 1 | Admin session lifecycle | W | `requirePortalAdmin` |
| `src/app/api/admin/sessions/route.ts` | 2 | Admin session creation/read | R/W | `requirePortalAdmin` |
| `src/app/api/admin/sponsored-applications/[id]/approve/route.ts` | 1 | Sponsored approval | W | `requirePortalAdmin` and grant policy |
| `src/collections/PayloadLiveSession.ts` | 2 | Collection relationship/configuration | R/W | Payload collection boundary |
| `src/collections/members/Members.ts` | 1 | Member collection hook/access | R/W | Payload collection boundary |

### Billing, identity, member, and content services

| Path | Count | Domain / purpose | Access | Prior authorization |
| --- | ---: | --- | --- | --- |
| `src/components/payload/JPVAdminDashboard.tsx` | 1 | Server-side admin dashboard read | R | Payload/admin boundary |
| `src/components/payload/JPVBillingOverview.tsx` | 4 | Server-side billing projection read | R | Payload/admin boundary |
| `src/lib/actions/openBillingPortal.ts` | 1 | Server action billing portal | R/W | authenticated member action |
| `src/lib/auth/adminMemberIdentity.ts` | 7 | Admin-to-member bridge and explicit provisioning path | R/W | read-only resolver during login; explicit provisioning/backfill path |
| `src/lib/auth/payloadMemberAccountActions.ts` | 2 | Member account operations | R/W | member actor policy |
| `src/lib/auth/payloadMemberEmailVerification.ts` | 7 | Email verification lifecycle | R/W | member/auth policy |
| `src/lib/auth/requirePortalAccess.ts` | 1 | Portal actor resolution | R | Payload session boundary |
| `src/lib/auth/requirePortalMember.ts` | 1 | Member actor resolution | R | member session boundary |
| `src/lib/billing/delinquencySweep.ts` | 2 | Billing status projection | R/W | guarded billing worker |
| `src/lib/billing/membershipReadModel.ts` | 1 | Shared membership read model | R | admin/read-model boundary |
| `src/lib/billing/stripeMemberIdentityReconciliation.ts` | 1 | Stripe identity inventory | R/W in apply mode | explicit operator gate; not run in A5 |
| `src/lib/billing/stripeOperatorActions.ts` | 5 | Guarded Stripe operations | W | admin/operator policy |
| `src/lib/billing/stripePayloadReconciliation.ts` | 5 | Stripe projection reconciliation | R/W in apply mode | explicit apply mode; dry-run is write-incapable |
| `src/lib/community/persistence.ts` | 2 | Community Payload persistence | R/W | shared community command policy |
| `src/lib/email/emailOperatorActions.ts` | 2 | Email queue operations | R/W | admin/operator policy |
| `src/lib/liveSessions/audience.ts` | 5 | Live audience projection | R | session audience policy |
| `src/lib/liveSessions/memberSessions.ts` | 4 | Member live-session read | R | member/session policy |
| `src/lib/liveSessions/sessionLifecycle.ts` | 3 | Live session lifecycle | R/W | admin/session command policy |
| `src/lib/members/accountStatus.ts` | 3 | Member status lifecycle | R/W | member/billing policy |
| `src/lib/members/changeMemberEmail.ts` | 9 | Email change workflow | R/W | member action and verification policy |
| `src/lib/members/changeMemberPassword.ts` | 3 | Password change workflow | R/W | authenticated member policy |
| `src/lib/members/cleanupSensitiveEmailEvents.ts` | 2 | Sensitive email cleanup | W | guarded member security workflow |
| `src/lib/members/completeMemberSetup.ts` | 6 | Account setup | R/W | setup token/member policy |
| `src/lib/members/completePasswordReset.ts` | 5 | Password reset completion | R/W | reset token policy |
| `src/lib/members/currentMember.ts` | 1 | Current member read | R | member session boundary |
| `src/lib/members/deleteMemberStripeCustomer.ts` | 1 | Member billing cleanup | W | guarded deletion policy |
| `src/lib/members/inviteMember.ts` | 5 | Member invitation | R/W | admin/member invitation policy |
| `src/lib/members/memberCoverImage.ts` | 7 | Member media metadata | R/W | member media policy |
| `src/lib/members/provisionMemberFromCheckout.ts` | 4 | Checkout account provisioning | R/W | signed Stripe/webhook boundary |
| `src/lib/members/redactDeliveredResetLink.ts` | 2 | Reset-link redaction | W | member security workflow |
| `src/lib/members/registerFreeMember.ts` | 6 | Free member registration | R/W | registration policy |
| `src/lib/members/requestPasswordReset.ts` | 3 | Reset request | R/W | public reset policy |
| `src/lib/members/updateMemberProfile.ts` | 5 | Member profile update | R/W | member actor policy |
| `src/lib/membership-support/webhookReconciliation.ts` | 5 | Support projection/reconciliation | R/W | signed event/operator boundary |
| `src/lib/partnerAffiliateReporting.ts` | 1 | Partner reporting read | R | partner reporting policy |
| `src/lib/payload/privilegedAccess.ts` | 2 | Canonical privileged-access definition | R/W object construction | A1 administrator gate and explicit reason |
| `src/lib/payloadContent/announcements.ts` | 3 | Announcement persistence | R/W | content/admin policy |
| `src/lib/payloadContent/memberContent.ts` | 2 | Member content read | R | portal access boundary |
| `src/lib/payloadContent/memberMedia.ts` | 2 | Member media read/write | R/W | content/media policy |
| `src/lib/portal/portalSettings.ts` | 1 | Portal settings read | R | admin/settings boundary |
| `src/lib/portalAdmin/adminPortal.ts` | 1 | Admin portal read model | R | `requirePortalAdmin` |
| `src/lib/shadowValidationReport.ts` | 2 | Shadow validation read/write | R/W | operator validation boundary |
| `src/lib/sponsored/claimSponsoredSeat.ts` | 1 | Sponsored claim read/transaction boundary | R/W | verified claim token/application/seat; idempotent claim transaction |
| `src/lib/sponsored-admin-grant.ts` | 2 | Sponsored grant action | R/W | admin/grant policy |
| `src/lib/sponsored-recipient.ts` | 7 | Sponsored recipient flow | R/W | token/admin grant policy |
| `src/lib/sponsored-seat-notifications.ts` | 3 | Sponsored notifications | R/W | grant/email policy |
| `src/lib/staging-auto-provision.ts` | 10 | Staging-only provisioning | R/W | explicit staging guard |
| `src/lib/support/persistence.ts` | 1 | Support intake/review persistence | R/W | support route/admin actor policy |

### Course and community domain services

| Path | Count | Domain / purpose | Access | Prior authorization |
| --- | ---: | --- | --- | --- |
| `src/lib/payloadCourse/accessService.ts` | 11 | Entitlement/access evaluation | R/W | course access service |
| `src/lib/payloadCourse/adminGrants.ts` | 5 | Admin course grants | R/W | `requirePortalAdmin` and grant policy |
| `src/lib/payloadCourse/affiliateReporting.ts` | 4 | Course partner reporting | R | reporting service |
| `src/lib/payloadCourse/bookmarks.ts` | 1 | Bookmark persistence | R/W | member actor policy |
| `src/lib/payloadCourse/communityDiscussion.ts` | 3 | Community discussion | R/W | community actor policy |
| `src/lib/payloadCourse/communityFiles.ts` | 5 | Community files | R/W | file/actor policy |
| `src/lib/payloadCourse/communityModeration.ts` | 2 | Moderation | R/W | admin/moderation policy |
| `src/lib/payloadCourse/communityModerationNotifications.ts` | 2 | Moderation notifications | W | notification service |
| `src/lib/payloadCourse/communityPortal.ts` | 5 | Community portal reads | R | portal access policy |
| `src/lib/payloadCourse/communityPostNotifications.ts` | 10 | Post notifications | W | notification service |
| `src/lib/payloadCourse/communityPosting.ts` | 7 | Community posting | R/W | member actor/rate-limit policy |
| `src/lib/payloadCourse/emailSender.ts` | 7 | Course email delivery | R/W | email service |
| `src/lib/payloadCourse/events.ts` | 4 | Course audit/events | W | domain event service |
| `src/lib/payloadCourse/leaderboard.ts` | 5 | Leaderboard read | R | member/course access policy |
| `src/lib/payloadCourse/lessonDiscussion.ts` | 10 | Lesson discussion | R/W | member actor policy |
| `src/lib/payloadCourse/lessonResources.ts` | 2 | Lesson resource metadata | R | course access policy |
| `src/lib/payloadCourse/memberBillingPortal.ts` | 1 | Member billing read | R | member billing policy |
| `src/lib/payloadCourse/memberDirectory.ts` | 3 | Member directory read | R | portal directory policy |
| `src/lib/payloadCourse/memberNotifications.ts` | 2 | Member notifications | R/W | notification policy |
| `src/lib/payloadCourse/memberPortal.ts` | 4 | Member portal read model | R | member access policy |
| `src/lib/payloadCourse/partnerApplications.ts` | 7 | Partner applications | R/W | partner policy |
| `src/lib/payloadCourse/partnerDelivery.ts` | 4 | Partner delivery | R/W | partner/operator policy |
| `src/lib/payloadCourse/reactions.ts` | 13 | Reactions | R/W | member actor policy |
| `src/lib/payloadCourse/reconcileEntitlements.ts` | 1 | Entitlement reconciliation | R/W | explicit operator/apply policy |
| `src/lib/payloadCourse/spaceMemberships.ts` | 7 | Community memberships | R/W | actor and admin policy |
| `src/lib/payloadCourse/stripeShadowSync.ts` | 9 | Stripe local projection | R/W | signed/operator billing boundary |

## Test fixtures

These occurrences are test fixtures and are registered so tests cannot quietly
drift into an unreviewed privileged contract:

| Path | Count |
| --- | ---: |
| `src/__tests__/checkout-and-livekit-regressions.test.ts` | 2 |
| `src/__tests__/email-operator-actions.test.ts` | 1 |
| `src/__tests__/operator-actions-route.test.ts` | 3 |
| `src/__tests__/portal-admin-foundation.test.ts` | 2 |

## Enforcement rules

- New page or component persistence is prohibited. A5.1 removed the reviewed
  support and sponsored route/page Prisma writes; persistence now belongs to
  named server-only services.
- New direct Prisma imports must update the inventory and identify the domain
  owner; `src/libs/prisma.ts` is the shared client implementation, not an
  application data authority.
- Browser modules may import only the explicitly allowed Server Actions from
  server-only modules. They may not import Stripe, Bunny, LiveKit, email,
  Payload, or identity services directly.
- `jpvDesignSystem.ts` is the design-token authority. Portal dark-mode CSS and
  Payload variable mapping are the only registered declaration overrides.
- A dry-run reconciliation must not invoke a persistence-capable checkpoint
  callback. Checkpoint persistence is apply-mode-only.
- Privileged access allowlists are path-aware as well as count-aware. A new
  occurrence requires both an intentional register entry and a valid owning
  service/path; moving an occurrence without updating the register fails the
  guard.
