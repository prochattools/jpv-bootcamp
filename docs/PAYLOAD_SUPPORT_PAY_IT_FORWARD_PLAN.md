# Payload Support and Pay-it-forward Access Plan

This specification defines the Version 3.3 first-release support and pay-it-forward model for JPV Bootcamp. It is subordinate to `docs/PAYLOAD_INTEGRATION_PLAN.md`.

## Product boundary

JPV Bootcamp has two clear access labels:

- **Free** — non-paid access created or approved through support, pay-it-forward, staff/test, migration, or administrator action.
- **Pro** — the single paid subscription, available through monthly and annual payment options.

Support and pay-it-forward access must not create another public tier. It is an administrator-controlled way to grant Free access with clear terms, dates, audit, and communication.

## First-release workflow

1. A visitor applies for support or a sponsor pays forward one or more memberships/support credits.
2. The system records the application, sponsor action, receipt state, and safe public-facing details.
3. An administrator reviews the application or assigns the sponsored access.
4. The recipient receives Free access with a clear start date, end date, and terms.
5. The system records who approved or assigned the access and which communication was sent.
6. The recipient can sign in and use the allowed course/community surfaces during the approved access window.
7. Expiry, renewal, revocation, or upgrade to Pro is handled explicitly and audited.

## Roles

| Role | Responsibility |
|---|---|
| Sponsor | Pays forward one or more support credits and receives a receipt/thank-you email. |
| Applicant/recipient | Applies for support or receives approved Free access with clear terms and duration. |
| Administrator | Reviews applications, assigns access, sets dates, revokes access, and sees expiry/renewal state. |
| System | Tracks source, status, approval, dates, communication, audit, and member access outcome. |

## Required records

At minimum the system needs records for:

- support applications;
- sponsor/pay-it-forward transactions or credits;
- sponsored-access assignments;
- recipient member relationship;
- approval status and reviewer;
- start date, end date, and revocation date;
- communication events;
- audit and migration source.

## Access rules

- Free access is granted only by verified support/pay-it-forward logic, migration mapping, or administrator action.
- Browser input must never choose trusted recipient identity, access state, sponsor balance, start date, or expiry date.
- Free access may permit selected course/community access but must not imply a paid Pro subscription.
- Pro checkout, billing portal, and payment recovery remain separate from Free access assignment.
- Expired or revoked Free access must fail closed for protected content while preserving account login where recovery or support is needed.

## Communication rules

- Sponsors receive a receipt or thank-you email with sponsor-safe wording.
- Applicants receive a confirmation that the request is pending review.
- Recipients receive approval, terms, start/end date, and next-step instructions.
- Administrators see pending applications, assigned access, expiry, renewal, and revocation state.
- No email should expose private sponsor, recipient, payment, or internal Payload data.

## Migration rules

Historical Free, Pro, manual, sponsor, support, expired, revoked, and suspended states must be mapped into the new access model before cutover:

- paid active legacy access maps to **Pro** where billing confirms an active paid subscription;
- approved non-paid access maps to **Free** with an explicit source and duration where known;
- expired, revoked, suspended, deleted, or disputed states remain non-access states until reviewed;
- ambiguous states require administrator review before production cutover.

## Core acceptance

The first release is acceptable when:

- an administrator can review and assign Free support/pay-it-forward access;
- dates, source, and approval state are visible to administrators;
- the recipient can sign in and access only the allowed surfaces;
- expiry or revocation removes protected access without deleting the account;
- sponsor/applicant/recipient communications are queued with safe content;
- migration mapping from old tier labels is rehearsed and reconciled.

## Post-core enhancements

Later releases may add sponsor dashboards, visible credit counters, automated matching, renewal campaigns, richer applicant scoring, direct sponsor-recipient updates, and advanced reports. These are not first core go-live requirements unless explicitly approved.
