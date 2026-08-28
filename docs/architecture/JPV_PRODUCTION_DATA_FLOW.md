# JPV Bootcamp Production Data Flow

**Status:** CURRENT A5 DATA-FLOW MAP — WRITE OWNERSHIP PRESERVED

**Date:** 2026-08-28

This document maps the current production-shaped repository flow. It is not
evidence that a provider, database, or deployed runtime is currently healthy;
the A5 packet performs no live writes and no reconciliation.

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
| Authentication and portal actor | Payload session and identity records | `requirePortalAccess`, `requirePortalMember`, `currentMember` | Payload auth/member account services | `portalActor`; unresolved admin bridge risk is recorded in the A5 risk register |
| Admin authorization | Payload administrator account plus explicit linked portal member | `requirePortalAdmin` | No implicit client-side grant | `privilegedPayloadAccess` and audit-aware admin services |
| Courses/modules/lessons | Payload course collections | course member/access services | `courseCommands`, `moduleCommands`, `lessonCommands`, Payload Admin | Payload remains authority; rollback is commit-level until A6 runtime proof |
| Community spaces/posts/comments | Payload community collections | community portal/discussion services | community commands and member/admin transports | Payload counts/read views; moderation and notification services |
| Reactions/bookmarks | Payload engagement rows | `reactions`, `bookmarks`, portal routes | member actor domain services | counts are derived; toggle operations are idempotent at the member/target/type boundary |
| Checkout and onboarding | Stripe checkout/customer/subscription | signed webhook and billing read model | Stripe checkout plus `provisionMemberFromCheckout` | Payload member/account projection and audit; failed provisioning remains reviewable |
| Billing | Stripe customer, subscription, invoice, and payment state | Stripe-backed service/read model | guarded Stripe operator/checkout/webhook services | Payload billing projections and Prisma operational rows; Stripe is commercial truth |
| Stripe reconciliation | Stripe inventory | `stripeMemberIdentityReconciliation`, `stripePayloadReconciliation` | apply-mode mirror only | ambiguous/unmatched identity review queue; dry-run returns a report and cannot checkpoint-write |
| Support | unresolved split between Prisma intake and Payload support projection | support routes/admin read models | named support workflow | A5 unresolved source-of-truth decision blocks A6 |
| Sponsored access | unresolved split between Prisma seat/grant flow and Payload review projections | sponsored routes/admin read models | sponsored seat/grant services and Stripe webhook | A5 unresolved transaction/read-model decision blocks A6 |
| Media | Payload metadata; Bunny/object storage binary | protected media resolvers | guarded media/provider services | Payload metadata references provider asset; missing binary is non-green |
| LiveKit | Payload session metadata; LiveKit room/participant runtime | session/audience services and token route | session lifecycle plus server LiveKit token boundary | Payload stores room name/status metadata; provider room state is runtime truth |
| Email | Resend delivery status plus local outbox | email sender/operator services | domain event -> outbox -> Resend | Payload/Prisma outbox split remains unresolved and must not double-send |
| Partner/affiliate | Payload business records; Prisma click telemetry | partner/reporting services | partner application/delivery services | reporting join boundary remains explicitly split |

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

## A5 boundary

A5 adds enforcement and documentation only. It does not execute the checkout,
Stripe reconciliation, administrator-link backfill, migration, provider
operation, or deployment flow. Those belong to the separately gated A6
controlled integration packet after the unresolved risk rows have owners and
live evidence.
