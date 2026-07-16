# Payload Support, Voucher, and Pay-it-forward Access Plan

This specification defines the JPV Bootcamp support, voucher, and pay-it-forward model. It is subordinate to `docs/PAYLOAD_INTEGRATION_PLAN.md` and `docs/JPV_MEMBERSHIP_BILLING_AND_VOUCHER_ARCHITECTURE.md`.

## Product boundary

JPV Bootcamp has one public membership: **JPV Bootcamp Membership**. Support, vouchers, and pay-it-forward funding do not create separate public plans or tiers.

Every recipient uses one onboarding path: Stripe Checkout for the normal monthly or annual JPV Bootcamp Membership subscription. Paying users pay immediately. Voucher and pay-it-forward recipients use a customer-restricted 100% promotion code for one month or one year. A valid payment method is always required, and the same subscription automatically renews at the normal recurring Price after the funded period unless cancelled.

## Unified administrator workflow

Payload must provide one Membership Support area for voucher and pay-it-forward operations. Administrators should not have to use separate interfaces for equivalent recipient outcomes.

The workflow must support:

- search and select an existing member or create a pending recipient profile;
- view Stripe customer, subscription, Price, renewal, discount, and reconciliation state;
- issue a personal one-month or one-year voucher;
- allocate approved pay-it-forward funding;
- generate a secure Checkout link;
- deactivate an unused promotion code;
- replace or extend access through supported Stripe operations;
- allocate, revoke, or replace approved pay-it-forward funding through the same Stripe voucher-backed subscription flow;
- record the operator, approver, reason, dates, and evidence reference;
- review webhook, payment, and reconciliation failures.

All Stripe changes must run server-side through access-controlled Payload endpoints or jobs. Payload must use Stripe’s Coupon, Promotion Code, Checkout, Subscription, Customer Portal, and webhook capabilities rather than implement a separate discount engine.

## Voucher rules

- Personal vouchers use unique Stripe Promotion Codes restricted to the intended Stripe Customer.
- Each code has one permitted redemption unless an explicit exception is approved.
- One-month vouchers apply a 100% discount to one monthly billing cycle.
- One-year vouchers apply a 100% discount to one annual billing cycle.
- Voucher Checkout must disclose the normal future renewal amount and renewal date.
- Voucher access is not active until verified Stripe state confirms the subscription.
- Unused codes may be deactivated. Historical redemption records must remain immutable.
- Extension should create a new supported Stripe discount or schedule change and must not rewrite historical voucher evidence.

## Pay-it-forward rules

Pay-it-forward is a funding source and approval workflow. It is not a membership tier.

The system must record:

- sponsor or funding source;
- payment/receipt or approved credit source;
- available and allocated value or duration;
- recipient;
- approved duration;
- voucher or sponsored-grant outcome;
- Stripe and Payload identifiers;
- approval, assignment, redemption, expiry, revocation, and communication events.

All pay-it-forward recipients receive a voucher-backed Stripe subscription. The funded period is one month or one year, a valid payment method is required, and the subscription automatically renews at the normal recurring Price unless cancelled.

## Required records

At minimum, Payload needs records for:

- support applications;
- pay-it-forward funding or credits;
- voucher issuance and redemption projections;
- sponsored-access assignments;
- recipient/member relationship;
- Stripe customer, subscription, coupon, promotion-code, Product, and Price identifiers;
- approval status and reviewer;
- start, expiry, renewal, and revocation dates;
- communication events;
- webhook/reconciliation status;
- immutable operator audit and migration source.

Secrets and API keys must never be stored in member-readable fields.

## Access rules

- Browser input must never choose trusted recipient identity, sponsorship balance, entitlement state, start date, or expiry date.
- Stripe remains authoritative for voucher-backed subscription state.
- Payload remains authoritative for sponsorship approval, audit, and application entitlement projection.
- Expired, unpaid, suspended, revoked, or unreconciled access must fail closed for protected content.
- Public free registration is unavailable.
- A support application does not itself create active membership access.

## Communication rules

Recipients must receive clear language covering:

- whether access is directly paid, voucher-funded, or pay-it-forward funded within the same Stripe subscription lifecycle;
- the access start and end or renewal date;
- the future recurring price, where applicable;
- cancellation instructions;
- payment-method requirement;
- what happens after the free period;
- support contact and privacy information.

Sponsors receive receipt or acknowledgement wording that does not expose recipient-private information. No message may expose internal Payload fields, Stripe secrets, or unrelated payment data.

## Migration rules

Historical states require explicit mapping before cutover:

- verified active paid monthly access -> JPV Bootcamp Membership monthly Price;
- verified active paid annual access -> JPV Bootcamp Membership annual Price;
- legacy Free, Table Plan, support, manual, or sponsored access -> no automatic paid conversion;
- approved non-paid recipients -> explicit voucher-backed Stripe subscription using the standard Checkout flow;
- expired, revoked, suspended, deleted, disputed, or ambiguous states -> no access until reviewed.

Migration must preserve existing Stripe Customers where possible, preview proration and invoice effects, and avoid duplicate customer creation.

## Core acceptance

The revised implementation is acceptable when:

- public free registration is technically unavailable;
- one Product and two recurring Prices are configured through an approved Stripe packet;
- an administrator can issue personal one-month and one-year vouchers from Payload;
- pay-it-forward funding can be allocated through the same workflow;
- Stripe mutations are idempotent, audited, and reconciled by verified webhooks;
- voucher recipients see future renewal terms before confirming Checkout;
- every paying, voucher, and pay-it-forward recipient uses the same Stripe subscription lifecycle;
- expiry, payment failure, cancellation, or revocation changes protected access predictably;
- migration mappings are rehearsed and reconciled;
- browser, billing, privacy, and security acceptance tests pass.

## Deferred enhancements

Sponsor dashboards, recipient matching, public credit counters, bulk voucher campaigns, advanced scoring, and richer reports remain post-core unless explicitly approved.
