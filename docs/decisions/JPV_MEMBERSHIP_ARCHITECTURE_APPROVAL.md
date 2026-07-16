# JPV Bootcamp Membership Architecture Approval

## Decision status

`APPROVED_FOR_IMPLEMENTATION_PLANNING`

This record approves the product and implementation architecture. It does not authorize live Stripe catalogue changes, subscription mutation, database migration, deployment, provider access, staging acceptance, or go-live.

## Approved architecture

- One public membership: `JPV Bootcamp Membership`.
- No public Free tier or Free self-registration.
- One Stripe Product with two recurring Prices:
  - GBP 80 monthly, cancel effective at the end of the current paid month, no minimum commitment.
  - GBP 800 annually, paid upfront and automatically renewed unless cancelled before renewal.
- Every paying, voucher, and pay-it-forward recipient uses the same Stripe Checkout subscription flow.
- Email, telephone, payment method, and recurring-payment disclosure are mandatory.
- Personal vouchers use customer-restricted Stripe Promotion Codes with one-month or one-year 100% discount templates.
- Pay-it-forward is a funding source for the same voucher-backed Stripe subscription flow, not a separate entitlement tier.
- Monthly-to-annual and annual-to-monthly changes are scheduled for the end of the current billing period.
- Stripe is authoritative for subscription, invoice, payment, discount, and renewal state.
- Payload is authoritative for member profile, entitlement projection, voucher/pay-it-forward audit, administration, and reconciliation.
- Bunny Stream is the protected course-video service.

## Approved migration design

- Preserve existing Stripe Customers, payment methods, and subscriptions where possible.
- Eligible paid subscriptions are updated in place on the separately approved migration date.
- Stripe-calculated proration credits unused paid value on the old Price and charges remaining time on the new Price.
- Every candidate receives an invoice preview immediately before mutation.
- Updates use explicit proration behavior, idempotency keys, small controlled cohorts, and immediate reconciliation.
- Unpaid, past-due, incomplete, disputed, paused, scheduled, multi-item, metered, or ambiguous subscriptions require manual review.
- The migration implementation may be built and tested in repository-only or Stripe test mode, but no live subscription may be mutated under this approval.

## Fixed planning dates

- Front-end milestone: 22 July 2026.
- Internal handover buffer: 23 July 2026.
- Client finished-by date: 24 July 2026.

These dates are fixed planning constraints, not evidence of staging or go-live authorization.

## Implementation authorization

P0-A single-membership billing and entitlement foundation is authorized for repository implementation, including tests, mocks, test configuration, migration inventory, invoice-preview modelling, and administrator workflow foundations.

## Explicit exclusions

This approval does not authorize:

- creating or changing live Stripe Products or Prices;
- mutating live subscriptions or Customers;
- applying database migrations;
- calling live Stripe, Bunny, email, staging, or production providers;
- deployment or push;
- staging acceptance;
- production migration;
- formal go-live.

## Approval evidence

- Approved through the current ProChat Workbench conversation on 16 July 2026.
- Business decisions supplied directly by the repository owner/client representative.
- Detailed architecture: `docs/JPV_MEMBERSHIP_BILLING_AND_VOUCHER_ARCHITECTURE.md`.
- Client revision: `docs/client/CLIENT_ARCHITECTURE_REVISION_16_JULY_2026.md`.
