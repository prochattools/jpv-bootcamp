# JPV Bootcamp Production Data Flow

**Status:** CURRENT A5.1 DATA-FLOW MAP — OWNERSHIP CLOSED; E1 GATE A BLOCKED

**Date:** 2026-08-28

This document maps the current production-shaped repository flow. It is not
evidence that a provider, database, or deployed runtime is currently healthy;
the A5 packet performs no live writes and no reconciliation.

## E1 environment boundary

Production is the root application at `https://jpvbootcamp.com` with database
`jpvbootcamp` / schema `jpvbootcamp`. Legacy is isolated at
`https://legacy.jpvbootcamp.com` with database `jpvbootcamp_legacy` / schema
`jpvbootcamp`. The current non-production runtime still serves
`https://preview.jpvbootcamp.com` from the transitional
`jpvbootcamp_preview` / `jpvbootcamp_staging` pair, while the intended
`https://staging.jpvbootcamp.com` origin returns 404. Its migration evidence is
not aligned with the repository registry.

The repository now centralizes non-secret environment identities in
`src/lib/environmentTopology.ts`; active staging checks use the staging origin
and approved source-ref pattern. Existing preview names in old packet evidence,
workflow filenames, host-managed routing paths, and external secret/volume
identifiers are retained as classified historical or immutable references. No
E1 code change mutates the live data flow. See
`JPV_ENVIRONMENT_TOPOLOGY_V1.md` and
`JPV_PREVIEW_TO_STAGING_INVENTORY.md`.

## Global boundary

```text
Browser / Payload UI
        |
        v
Next route or Server Action ---- actor gate ---- bounded domain service
        |                                  |
        |                                  +--> Payload authoritative records
        |                                  +--> Prisma operational records
        |                                  +--> provider API (server only)
        |                                  +--> email outbox/provider
        v
safe result + targeted revalidation + notification/read-model refresh
```

Browser code is presentation and transport only. Server-only provider clients,
Payload privileged access, direct Prisma access, and cross-store orchestration
remain behind named services.

## Flow register

| Flow | Authoritative fact | Read path | Write path | Projection / recovery owner |
| --- | --- | --- | --- | --- |
| Authentication and portal actor | Payload session and identity records | `requirePortalAccess`, `requirePortalMember`, `currentMember` | Payload auth/member account services | `portalActor`; administrator resolution is read-only and explicit linking is a separate provisioning path |
| Admin authorization | Payload administrator account plus explicit linked portal member | `requirePortalAdmin` | No implicit client-side grant | `privilegedPayloadAccess` and audit-aware admin services |
| Courses/modules/lessons | Payload course collections | course member/access services | `courseCommands`, `moduleCommands`, `lessonCommands`, Payload Admin | Payload remains authority; rollback is commit-level until A6 runtime proof |
| Community spaces/posts/comments | Payload community collections | community portal/discussion services | community commands and member/admin transports | Payload counts/read views; moderation and notification services |
| Reactions/bookmarks | Payload engagement rows | `reactions`, `bookmarks`, portal routes | member actor domain services | counts are derived; toggle operations are idempotent at the member/target/type boundary |
| Checkout and onboarding | Stripe checkout/customer/subscription | signed webhook and billing read model | Stripe checkout plus `provisionMemberFromCheckout` | Payload member/account projection and audit; failed provisioning remains reviewable |
| Billing | Stripe customer, subscription, invoice, and payment state | Payload billing projection/read model for portal/admin display; named Prisma compatibility services only for operational enrichment | guarded Stripe operator/checkout/webhook services, then one-way `stripeShadowSync` projection | Payload billing collections are canonical local projection; Prisma `customer_provisioning` is an operational checkpoint/legacy fallback; Stripe wins conflicts |
| Stripe reconciliation | Stripe inventory | `stripeMemberIdentityReconciliation`, `stripePayloadReconciliation` | apply-mode mirror only | ambiguous/unmatched identity review queue; dry-run returns a report and cannot checkpoint-write |
| Support | Prisma `support_requests` intake/review ledger | support routes and operations inbox | `src/lib/support/persistence.ts`; one-way Payload membership-support projection where required | Prisma owns review status; existing dedupe/notification semantics remain the retry contract |
| Sponsored access | Prisma seat/application/grant ledger and Stripe recipient billing | sponsored routes/admin read models | named sponsored seat/claim/grant services and guarded admin actions | Prisma owns reservation/claim/grant transaction; Payload owns review projection; token/application/seat identity is explicit and idempotent |
| Media | Payload metadata; Bunny/object storage binary | protected media resolvers | guarded media/provider services | Payload metadata references provider asset; missing binary is non-green |
| LiveKit | Payload session metadata; LiveKit room/participant runtime | session/audience services and token route | session lifecycle plus server LiveKit token boundary | Payload stores room name/status metadata; provider room state is runtime truth |
| Email | Resend delivery status | Payload `payload_email_events` sender/operator services | domain event -> Payload outbox -> Resend | Payload event `dedupeKey` owns current retry/idempotency; Prisma `email_events` is isolated legacy compatibility/history and must not double-send |
| Partner/affiliate | Payload business records; Prisma hashed click telemetry | partner/reporting services | partner application/delivery services | explicit partner/application/account joins; telemetry is non-authoritative and retention/recovery cannot change business state |

## Ownership rules

1. Stripe is authoritative for commercial billing. Payload and Prisma billing
   records are projections, operational state, or audit records and must be
   labelled as such.
2. Payload is authoritative for courses, community business records, members,
   profiles, access, and progress.
3. A linked administrator receives a member-facing profile only through an
   explicit identity link. The link does not fabricate a Stripe subscription.
4. Cross-store writes require an actor, an idempotency key, an ordering rule,
   an audit record, and a failure/retry/review outcome.
5. An email address is a fallback identity key only when normalized and unique;
   stable provider/customer IDs always take precedence.
6. Unknown, stale, unmatched, or ambiguous joins remain visible as review
   state. They do not become active access through a guessed assignment.

## A5.1 boundary

A5.1 closes the architecture and moves the reviewed support and sponsored
route/page persistence behind named server-only services. It does not execute
checkout, Stripe reconciliation, administrator-link backfill, migration,
provider operation, or deployment. A6 is separately gated for exact
environment identity, read-only production inventory, deployed-SHA health,
provider configuration/delivery proof, and any explicitly authorized apply
operation.
