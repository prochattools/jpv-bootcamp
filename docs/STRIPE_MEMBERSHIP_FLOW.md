# Stripe Membership Flow

This document is the Version 3.3 Stripe membership contract.

## Product Truth

- Free is controlled non-paid access for support, pay-it-forward, staff, test, admin-created, or approved migration outcomes.
- Pro is the only paid subscription.
- Pro has two payment options: monthly with a 12-month commitment, and annual upfront.
- Support and pay-it-forward are controlled Free access paths, not product tiers.

## Checkout

Public and portal checkout entry points call the app-owned checkout route with:

- `plan=pro`
- `billing=monthly` or `billing=annual`

Checkout must reject any non-Pro public plan value. Checkout metadata should be sufficient for webhook projection and audit logs. It must not create, preserve, or route to any additional paid plan, one-off table product, or public upgrade alias inside the membership checkout path.

## Webhooks

Stripe webhook handling must:

- verify the Stripe signature;
- record idempotency before side effects;
- project active Pro subscription state into local member access;
- fail closed on invalid, unpaid, canceled, incomplete, or disputed states;
- send membership email only through configured, deduplicated paths;
- keep support/pay-it-forward access separate from paid subscription state.

## Billing Portal

Billing portal sessions are for existing Stripe customers. They should return to the app-owned portal billing page and must remain separate from checkout.

## Environment

Required current billing configuration:

- Stripe secret key and publishable key for the active environment;
- Pro monthly price id;
- Pro annual price id;
- Pro product id where product matching is used;
- Stripe webhook secret;
- billing portal configuration id where portal sessions are enabled.

Removed product configuration must not be required for current checkout, webhook processing, or billing portal handoff.

## Validation

Before launch, verify:

- monthly checkout creates the approved Pro subscription terms;
- annual checkout creates the approved Pro upfront subscription;
- webhook projection grants Pro access only for active or trialing subscriptions;
- payment failure and cancellation remove private paid access;
- billing portal return lands inside the app;
- support/pay-it-forward grants controlled Free access only.
