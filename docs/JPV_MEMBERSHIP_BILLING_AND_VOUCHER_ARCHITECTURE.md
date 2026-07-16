# JPV Bootcamp Membership, Billing, Voucher, and Video Architecture

## Status

**Architecture revision authorized for documentation and implementation planning.**

This document replaces the former Free/Pro product assumption. It does not authorize live Stripe changes, migration execution, deployment, provider access, or go-live.

## Product model

JPV Bootcamp has one membership product:

- **Product:** `JPV Bootcamp Membership`
- **Monthly price:** GBP 80 every month, cancel at the end of the current paid period, no minimum commitment
- **Annual price:** GBP 800 every year, paid upfront for a 12-month service period and automatically renewed unless cancelled before renewal
- **Free self-registration:** unavailable
- **Course access:** requires an active JPV Bootcamp Membership subscription, including a temporarily fully discounted subscription created through the same Stripe Checkout flow

Stripe must own commercial subscription state. Payload CMS must own the application profile, entitlement projection, voucher/sponsorship audit trail, operator workflow, and reconciliation state.

## Standard Stripe design

Use one Stripe Product with two recurring Prices. Do not create separate products for monthly and annual access.

Use Stripe Checkout in `subscription` mode and enable promotion-code entry. Use Stripe Customer Portal for payment-method updates, invoices, cancellation, and supported plan changes. Monthly-to-annual and annual-to-monthly changes must be scheduled for the end of the current billing period, with no mid-period proration; an annual member therefore remains annual until the paid year ends. Use verified, idempotent webhooks to project Stripe state into Payload.

Recommended event coverage includes:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- relevant discount and promotion-code lifecycle events where available

The member entitlement must derive from verified subscription and invoice state, not from browser redirects.

## Voucher model

Stripe Coupons define the discount. Stripe Promotion Codes provide redeemable codes and restrictions. For personal vouchers, create a unique Promotion Code for a specific Stripe Customer, with one redemption and an explicit expiry where appropriate.

Two standard voucher templates are required:

1. **One-month voucher**
   - 100% discount
   - duration: one billing cycle on the monthly Price
   - after the discounted invoice period, the same subscription renews at GBP 80/month

2. **One-year voucher**
   - 100% discount
   - duration: one billing cycle on the annual Price
   - after the discounted annual period, the same subscription renews at GBP 800/year

The customer must add a valid payment method during Checkout before receiving the discounted subscription unless an explicitly approved operational exception is documented. Checkout should clearly disclose the future renewal amount and date.

Payload must store the Stripe identifiers and an immutable audit projection, not secrets:

- member
- Stripe customer ID
- Stripe product and price IDs
- coupon ID
- promotion-code ID and display code
- voucher type and duration
- issued by, issued at, expires at
- intended recipient email/member
- redemption state and redeemed at
- subscription ID
- revocation/deactivation state
- reason and approval reference
- reconciliation status and last webhook timestamp

Operators may create, deactivate, or extend vouchers from Payload through server-only Stripe API endpoints. Payload must not implement an independent discount engine. “Extend” means creating or applying a supported Stripe discount/schedule change and recording the resulting Stripe object IDs; it must not silently edit historical voucher records.

## Pay-it-forward model

Pay-it-forward is a funding source and approval workflow, not a separate membership tier. The recipient ultimately receives the same JPV Bootcamp Membership entitlement.

Preferred implementation:

- record paid-forward funds or sponsorship credits in Payload;
- approve a recipient and duration in Payload;
- issue a customer-restricted 100% Stripe promotion code for one month or one year when the recipient will continue as a paying subscriber afterward;
- require Checkout and a payment method, with transparent future renewal disclosure;
- preserve the sponsorship allocation, donor/fund reference, recipient, duration, Stripe IDs, and redemption state in Payload.

All sponsored recipients must use the same Stripe subscription Checkout flow as paying and voucher recipients. A valid payment method is mandatory. Pay-it-forward funding is implemented by issuing a customer-restricted 100% promotion code for one monthly or annual billing cycle; after that period, the same subscription automatically renews at the normal recurring Price unless cancelled. No separate non-Stripe sponsored-access entitlement path is permitted.

## Payload administrator workflow

Provide one “Membership support” administrator area rather than separate voucher and pay-it-forward interfaces. It should support:

- search member/customer;
- view current subscription, price, status, renewal date, payment state, active discount, and sponsorship history;
- issue a one-month or one-year personal voucher;
- allocate approved pay-it-forward funding;
- deactivate an unused promotion code;
- schedule supported subscription/discount changes;
- resend the secure Checkout link;
- review webhook/reconciliation failures;
- record approvals, reasons, and operator identity.

All Stripe mutations must run server-side through access-controlled Payload endpoints or jobs. Every mutation must be idempotent, logged, and followed by Stripe retrieval or webhook reconciliation.

## Migration strategy

Do not create duplicate Stripe Customers when an existing verified customer can be retained. Prefer migrating existing subscriptions in place to the new monthly or annual Price, using Stripe subscription updates, billing-cycle controls, subscription schedules, and explicit proration behavior.

Migration must be segmented:

1. inventory existing customers, subscriptions, prices, discounts, payment methods, statuses, renewal anchors, taxes, credits, unpaid invoices, and cancellation state;
2. decide the mapping for every legacy state;
3. create a Stripe invoice preview for every subscription immediately before mutation and record the expected credit, charge, tax, discount, and next renewal date;
4. route subscriptions with unpaid, past-due, incomplete, disputed, paused, scheduled, multi-item, metered, or otherwise ambiguous state to manual review rather than applying automatic proration;
5. notify affected customers and obtain any legally required consent;
6. update eligible subscriptions in controlled batches with idempotency keys and explicit proration behavior;
7. verify the resulting invoice, payment state, billing-cycle anchor, Price, discount, and entitlement before continuing;
8. reconcile webhooks and invoices;
9. preserve rollback evidence, failed-payment handling, and exception reports.

Recommended default mapping:

- existing paid monthly member -> retain the existing Stripe Customer and update the active subscription in place to the new GBP 80 monthly Price on the approved migration date, preserving the individual billing-cycle anchor where operationally supported and using Stripe proration so unused value on the old Price is credited and the remaining time on the new Price is charged;
- existing paid annual member -> retain the existing Stripe Customer and update the active subscription in place to the new GBP 800 annual Price on the approved migration date, preserving the individual annual billing-cycle anchor where operationally supported and using Stripe proration so unused value on the old Price is credited and the remaining time on the new Price is charged;
- legacy Free/Table Plan/support access -> no automatic paid conversion; require an explicit voucher, sponsored-access approval, or paid Checkout decision;
- active fixed-term commitments -> preserve contracted commercial terms until the approved transition date.

Creating a new Product and Prices is appropriate. Creating new Customer records for all existing users is not the default best practice. No migration may run until the exact mapping, customer communication, proration behavior, backup, rollback, operator, and approval packet are complete.

## Bunny video architecture

Use Bunny.net only. For course video, prefer **Bunny Stream** rather than treating raw Bunny Storage as the playback platform. Bunny Stream provides video objects, upload APIs, transcoding, adaptive streaming, an embeddable player, token authentication, and domain restrictions.

Payload lessons should store Bunny Stream library/video identifiers and safe metadata, not permanent public media URLs or Bunny API secrets. Upload and management actions must use server-only Bunny APIs. Protected playback must use signed/tokenized access and domain restrictions.

Bunny Storage may remain suitable for non-video files or source/archive workflows. Its S3-compatible API was still preview-limited in the researched documentation, so the implementation should not depend on AWS-specific behavior or assume complete S3 parity. Build against Bunny’s documented HTTP/Stream APIs and isolate the adapter.

## Checkout and onboarding data

Checkout/onboarding must collect:

- email address;
- telephone number;
- selected billing cadence;
- voucher/promotion code where applicable;
- explicit recurring-payment and renewal disclosure;
- required terms/privacy consent.

Use Stripe Customer email and phone fields when Checkout supports the required collection. Mirror normalized contact data into Payload after verified Checkout completion, while preserving consent and update provenance. Telephone numbers must be stored in a normalized international format and protected by least-privilege access.

## Course-platform best-practice comparison

Mature course platforms commonly model a membership as one learner entitlement with multiple billing options, use coupons for introductory free periods or discounts, keep learner billing self-service separate from administrator operations, and retain access until the paid period ends after cancellation. JPV should follow those patterns while keeping Stripe as the billing system of record and Payload as the controlled operational layer.

Avoid platform-specific weaknesses such as forcing a learner to cancel and repurchase merely to change cadence. Stripe supports direct subscription price changes and schedules; use those standard capabilities with explicit proration and renewal rules.

## Implementation roadmap

### R0 — Architecture and client approval

Confirmed on 16 July 2026:

- one Product with GBP 80 monthly and GBP 800 annual recurring Prices;
- annual automatic renewal unless cancelled;
- mandatory payment method for every Checkout, including voucher and pay-it-forward recipients;
- one Stripe subscription onboarding path for all recipients;
- plan changes scheduled for the end of the current billing period;
- existing eligible paid subscriptions transition in place on the approved migration date with Stripe-calculated proration, preserving individual customer and billing-cycle context where operationally supported;
- Bunny Stream is the protected course-video service.

Still required before live execution:

- exact legacy-state mapping and customer communication approval;
- legal/privacy copy approval;
- operator and rollback ownership;
- separate approval for live Stripe catalogue changes, migration, staging, and go-live.

### R1 — Product-model refactor

- remove public Free registration and Free/Pro copy;
- replace plan enums and entitlement semantics with membership/access-source states;
- preserve administrative pending, sponsored, suspended, expired, revoked, and test states without presenting them as public plans;
- add email and telephone collection/validation.

### R2 — Stripe catalogue and checkout

- provision one Product and two recurring Prices through an approved operator packet;
- update Checkout and Customer Portal configuration;
- enable promotion-code entry;
- implement monthly cancel-anytime and annual renewal disclosures;
- add webhook and reconciliation tests.

### R3 — Voucher and pay-it-forward operations

- add voucher/sponsorship collections and access controls;
- implement server-only promotion-code issuance and deactivation;
- implement one-month and one-year templates;
- add audit, idempotency, reconciliation, and failure recovery;
- provide one administrator workflow.

### R4 — Migration preparation and rehearsal

- build inventory and mapping reports;
- preview prorations and renewal-date effects;
- test in Stripe test mode with representative subscriptions;
- create customer communication and exception procedures;
- produce rollback and evidence packets.

### R5 — Bunny-only protected video

- integrate Bunny Stream upload/metadata management;
- store library/video IDs in Payload;
- implement protected tokenized playback and domain restrictions;
- add processing, failure, deletion, and reconciliation states;
- migrate existing video references only through an approved content packet.

### R6 — Acceptance and controlled release

- complete release, browser, webhook, billing, voucher, migration, privacy, and video-security tests;
- obtain independent approvals for Stripe catalogue changes, migration execution, provider verification, staging smoke, and go-live.

## Open decisions requiring explicit approval

- whether unused vouchers may be extended through a new Stripe discount/schedule or must always be replaced;
- which administrator roles may issue, deactivate, replace, or extend vouchers and the required approval threshold;
- exact treatment of every legacy Free, Table Plan, manual, support, disputed, suspended, expired, and ambiguous member state;
- legal wording for automatic renewal, cancellation, vouchers, telephone collection, plan changes, and migration notices;
- customer communication timing and wording for the individually prorated migration;
- exact Stripe test/staging operator, rollback owner, and evidence owner.

## Research basis

This architecture follows the documented Stripe Product/Price, Checkout, Customer Portal, Coupon, Promotion Code, subscription-update, proration, billing-cycle, schedule, and webhook models; Payload’s Stripe plugin, hooks, custom endpoints, jobs, and admin-extension model; Bunny Stream’s upload, player, token-authentication, and domain-restriction capabilities; and common membership/coupon patterns documented by established course platforms.
