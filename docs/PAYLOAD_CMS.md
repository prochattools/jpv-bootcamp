# Payload CMS Target Reference

Payload is the administrative system for JPV Bootcamp courses, members, access, community preview, billing visibility, and editorial workflows.

## Access Labels

- Free: controlled non-paid access for support, pay-it-forward, staff, test, admin-created, or approved migration outcomes.
- Pro: the only paid subscription.
- Pro billing: monthly with a 12-month commitment, or annual upfront.

Support and pay-it-forward are controlled Free access paths, not tiers.

## Core Collections

| Area | Purpose |
| --- | --- |
| Courses, modules, lessons | Representative 8-week course and future content |
| Media | Course images, downloads, and protected files |
| Members | Portal identity, profile, account status |
| Billing accounts/subscriptions | Stripe projection for access and admin visibility |
| Access groups/policies/grants | Explicit access decisions and fail-closed rules |
| Community spaces/posts | First-release community and private-room preview |
| Email events/templates | Operational and transactional messaging |

## Admin Users

Payload admin users are editorial and operational users. They do not automatically grant member portal access or billing access.

## Access Rules

Access decisions must use explicit policy inputs:

- resource privacy;
- member account status;
- email verification where required;
- active Free or Pro entitlement;
- billing status for Pro resources;
- direct grants or access groups;
- preview lesson allowance.

Private content must fail closed when status is unclear.

## Billing Projection

Stripe remains the payment processor. Payload stores a local projection for member access and admin visibility. The projection must support Pro monthly and annual options and must not introduce any other paid subscription label.

## Launch Requirements

Before go-live:

- public copy uses Free and Pro only;
- Pro checkout and billing portal are verified;
- representative 8-week course is accepted;
- storage and private media behavior are accepted;
- community/private-room preview is accepted;
- support/pay-it-forward creates controlled Free access;
- partner first-release tracking is accepted;
- migration rehearsal and rollback notes are complete;
- client approval is recorded.

Post-core work remains separate from the first launch.
