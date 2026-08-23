# JPV Bootcamp Architecture

This document describes the current Payload-only Version 3.7 system on `feature/course-branding-and-preview`. Current implementation status and hardening order are tracked in `docs/PAYLOAD_INTEGRATION_PLAN.md`; static preview routes do not count as operational architecture until their persistence, authorization, failure handling, and tests pass.

> **Infrastructure & networking:** See `docs/INFRASTRUCTURE_NETWORKING.md` for the canonical reference on how the app container reaches the database, Tailscale subnet routing, firewall layers, and incident history.

## Canonical Access Model

- JPV Bootcamp has one public paid product: **JPV Bootcamp Membership**.
- The membership has two billing options: monthly with no minimum commitment, and annual upfront.
- Voucher, pay-it-forward, staff, test, administrator-created, and approved migration outcomes are access sources or funding paths, not separate public tiers.
- Historical Free/Pro/Table Plan labels are migration inputs only and must not reappear in public checkout or entitlement semantics.

## Core Surfaces

| Surface | Owner | Purpose |
| --- | --- | --- |
| Public site | Next.js | Landing page, registration, checkout entry, course preview |
| Member portal | Next.js + Payload | Canonical `/portal` account, course, community, partner, support, and billing experience |
| Admin CMS | Payload | Course, member, access, community, and operational content |
| Billing | Stripe + Next.js routes | Membership checkout, subscription webhooks, billing portal sessions |
| Email | Resend | Membership, support, sponsored-access, and admin notifications |
| Database | Supabase/Postgres | Prisma operational tables and Payload collections |

## Billing Flow

1. Public and portal calls start membership checkout through app-owned routes.
2. Checkout supports `plan=membership` with `billing=monthly` or `billing=annual`.
3. Stripe webhooks verify signatures, record idempotency, project membership state locally, and send configured emails.
4. Billing portal handoff remains separate from checkout and returns to the app-owned portal billing page.
5. The public membership page may remain at `/upgrade`, but member billing ownership stays under `/portal/billing` and no legacy paid-plan aliases may return.

## Access Projection

Stripe events and admin actions project into Payload/member access records:

- active membership subscription grants the JPV Bootcamp Membership entitlement;
- controlled support, pay-it-forward, staff, test, and admin-created cases grant the same entitlement through a non-paid access source;
- expired, revoked, suspended, unpaid, or canceled states fail closed until reviewed or recovered.

Payload access policy evaluation is the source for member portal course, community, and private-room visibility.

## Support And Pay-It-Forward

Pay-it-forward purchases create a sponsored access seat. Admin approval or claim flow converts that seat into controlled Free access. The flow must not create a third product tier or a second paid subscription.

## Partner Tracking

Partner links, sessions, clicks, forms, and reports are app-owned. First release requires click/session tracking and admin-visible reporting; payout automation and advanced webhooks remain post-core unless explicitly approved for launch.

## Course And Community

The first core launch includes a representative 8-week course, private-room/community preview behavior, content access checks, media/storage acceptance, member account flows, and admin operations. Private messaging, advanced notifications, live calls, and payout automation remain post-core unless promoted by go-live approval.

## Cutover Gates

Go-live requires:

- public landing page approved;
- Membership monthly and annual checkout verified;
- billing automation and portal return verified;
- representative course and access rules accepted;
- partner first-release tracking accepted;
- community/private-room preview accepted;
- migration rehearsal and rollback path documented;
- explicit client approval.

Post-core work must stay separate from first core go-live.
