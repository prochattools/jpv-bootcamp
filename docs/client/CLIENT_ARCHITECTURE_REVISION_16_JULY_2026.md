# JPV Bootcamp Architecture Revision — 16 July 2026

## Executive decision

JPV Bootcamp is moving from the previous Free/Pro model to one paid membership:

- **JPV Bootcamp Membership**
- **Monthly:** GBP 80 per month, no minimum commitment, cancel effective at the end of the current paid month
- **Annual:** GBP 800 per year, paid upfront and automatically renewed unless cancelled before renewal
- **Free self-registration:** removed

Every learner uses one Stripe subscription onboarding flow. Paying learners pay immediately. Voucher and pay-it-forward learners use a personal 100% Stripe promotion code for one month or one year, add a valid payment method, and automatically continue on the normal recurring Price after the funded period unless cancelled.

## Confirmed commercial rules

- One Stripe Product with two recurring Prices.
- Email and telephone are required during onboarding.
- A valid payment method is mandatory for every learner, including voucher and pay-it-forward recipients.
- Monthly-to-annual and annual-to-monthly changes take effect only at the end of the current billing period.
- Existing Stripe Customers should be retained.
- Existing eligible paid subscriptions retain their Stripe Customer and are migrated in place on the approved migration date using Stripe-calculated proration, so unused value on the old Price is credited and remaining time on the new Price is charged.
- Pay-it-forward is a funding source, not a separate membership or entitlement type.
- Bunny Stream is the recommended Bunny-only service for protected course video.

## Fixed delivery dates

The existing delivery dates remain unchanged:

- front-end website milestone: **22 July 2026**
- internal delivery/handover buffer: **23 July 2026**
- client finished-by date: **24 July 2026**

The architecture revision materially increases delivery risk. Achieving a usable platform by 24 July remains possible only through strict launch-scope prioritization, parallel work where safe, immediate decisions, and deferral of non-essential enhancements.

## Launch-critical scope

The following are required before real users can begin onboarding or migration:

1. single-membership entitlement refactor;
2. removal of public Free registration;
3. Stripe test-mode Product/Price, Checkout, Customer Portal, cancellation, plan-change, and webhook flows;
4. mandatory email, telephone, and payment-method onboarding;
5. personal one-month and one-year voucher issuance and redemption;
6. pay-it-forward allocation through the same voucher-backed Stripe flow;
7. Payload member, subscription, voucher, sponsorship, permission, and reconciliation administration;
8. transactional email for onboarding, billing, voucher, failure, cancellation, and renewal states;
9. protected course access and minimum viable programme delivery;
10. Bunny Stream metadata and protected playback for launch-required videos;
11. migration inventory, mapping, rehearsal, exception report, and customer communication;
12. browser, billing, webhook, access-control, and staging smoke acceptance.

## Explicitly deferrable after launch

The following must not delay launch unless they become necessary for safety or operations:

- advanced sponsor dashboards;
- public voucher campaigns;
- bulk voucher generation;
- complex voucher extension UX;
- rich analytics beyond operational reconciliation;
- advanced course discussion/community interactions;
- broad media-library management beyond launch videos;
- later M2 partner-referral work;
- non-essential visual polish.

## Priority order

Work must proceed risk-first, not screen-first:

### P0-A — Billing and entitlement foundation

- product/price configuration contract;
- membership and access-state model;
- verified webhook projection;
- payment failure, cancellation, renewal, and access revocation;
- migration mapping and rollback boundaries.

### P0-B — Onboarding and supported free periods

- Checkout collection of email, telephone, payment method, and promotion code;
- one-month/year voucher templates;
- pay-it-forward allocation through identical subscription Checkout;
- renewal and cancellation disclosure;
- transactional emails.

### P0-C — Administrator operations

- member/customer search;
- subscription and entitlement visibility;
- issue/deactivate personal vouchers;
- allocate pay-it-forward funding;
- inspect webhook/reconciliation failures;
- permissions, audit, and operator evidence.

### P0-D — Course usability

- protected course navigation and access;
- representative programme content;
- Bunny Stream protected playback for required videos;
- minimum browser and mobile acceptance.

### P0-E — Migration and controlled release

- inventory and dry-run mapping;
- per-subscription Stripe invoice previews and controlled in-place prorated Price updates;
- customer communications;
- controlled batch execution plan;
- staging smoke, rollback evidence, and formal go/no-go.

## Delivery assessment

**Assessment: achievable but high risk and conditional.**

A usable launch by 24 July 2026 is credible only if:

- the implementation starts immediately with P0-A;
- no additional product-model changes are introduced;
- Stripe catalogue and provider access are authorized early enough for test/staging verification;
- representative course content and videos are supplied without delay;
- migration scope is limited to verified, unambiguous records;
- ambiguous legacy records are held for manual review instead of blocking all users;
- deferrable features remain deferred;
- release approval remains separate from implementation readiness.

A safer rollout is progressive: open the new platform to new subscriptions and verified voucher/pay-it-forward recipients first, then migrate eligible legacy paid subscriptions in small controlled cohorts using per-subscription invoice previews, Stripe-calculated prorations, idempotent updates, and immediate reconciliation. Ambiguous or unpaid subscriptions must be held for manual review rather than included in the automatic batch.

## Safety and approval boundaries

This revision does not authorize:

- live Stripe Product or Price creation;
- migration execution;
- live provider calls;
- deployment;
- production data mutation;
- staging acceptance;
- go-live.

Each operation still requires its own approved packet and evidence.
