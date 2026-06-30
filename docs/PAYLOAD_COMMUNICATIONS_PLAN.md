# JPV Bootcamp Communications Plan

This specification defines the approved communication system for the JPV Bootcamp Payload programme. It is subordinate to `docs/PAYLOAD_INTEGRATION_PLAN.md` and must remain aligned with the client progress document.

## Purpose

Build one branded, auditable communication system for administrators, members, billing, learning, community, and partner-affiliate workflows. The existing FreeResend service is the delivery provider. Client-facing messages must use JPV Bootcamp branding and must not expose Payload terminology.

## Communication principles

- Documentation is updated before implementation.
- FreeResend is the approved delivery service.
- Transactional, notification, and broadcast messages are separate classes.
- Security-sensitive links are time-limited, single-use where appropriate, and generated server-side.
- No plaintext password is ever emailed.
- Every message has HTML and plain-text output.
- Every message uses one shared JPV Bootcamp white-label layout.
- Staging and production links come from the configured application origin.
- Delivery, failure, retry, and complaint events are auditable.
- Optional notifications and broadcasts respect recipient preferences and unsubscribe rules.

## Shared message format

Every client-facing message includes:

- JPV Bootcamp logo and product name;
- clear subject and preheader;
- short explanation of what happened;
- relevant account, course, order, payment, group, or partner details;
- one primary action button when action is required;
- a fallback URL for security-sensitive actions;
- support contact details;
- plain-text fallback;
- no internal collection names or Payload branding.

## Communication classes

### Transactional

Required account, security, billing, enrollment, access, and operational messages. These are sent because an action occurred or a service state changed.

### Notification

Course reminders, community replies, progress summaries, announcements, and similar non-critical activity messages. These support recipient preferences.

### Broadcast

Newsletters, promotions, events, and administrator-selected group communication. These require audience selection, preference controls, and unsubscribe handling.

## Complete communication tree

### 1. Identity and account lifecycle

| Event | Recipient | Timing | Required content | Primary action |
|---|---|---|---|---|
| Member created by administrator | Member | Immediately | Account created, expiry, support | Set password |
| Self-registration started | Member | Immediately | Verification reason and expiry | Verify email |
| Email verified | Member | Immediately | Account ready confirmation | Open portal |
| Invitation expiring | Member | Before expiry | Expiry date and support | Set password |
| Invitation accepted | Member; optional administrator | Immediately | Confirmation and next step | Open portal/member record |
| Account blocked or suspended | Member; administrator audit | Immediately | Status, reason where appropriate, support | Contact support |
| Account restored | Member | Immediately | Access restored | Sign in |
| Account deletion requested | Member; administrator | Immediately | Request summary and consequences | Confirm or cancel |
| Account deleted/anonymized | Member; administrator audit | After completion | Final confirmation | None |

### 2. Password and security

| Event | Recipient | Timing | Required content | Primary action |
|---|---|---|---|---|
| Forgot-password request | Account owner | Immediately | Expiry and security guidance | Reset password |
| Password changed | Account owner | Immediately | Time, account, support if unexpected | Review account |
| Email address change requested | Old address | Immediately | Warning and support route | Report issue |
| Email address change requested | New address | Immediately | Confirmation and expiry | Confirm address |
| Email address changed | Old and new address | Immediately | Final confirmation | Review account |
| New or risky sign-in | Account owner | Immediately when risk rule triggers | Time, device/location where available | Secure account |
| Failed-login threshold reached | Account owner; security administrator | Immediately | Lock/recovery guidance | Reset password/review |
| Administrator invited | Administrator | Immediately | Role, expiry, security guidance | Set password |
| Administrator role changed | Administrator; owner | Immediately | Previous and new role | Review access |

### 3. Learning and enrollment

| Event | Recipient | Timing | Required content | Primary action |
|---|---|---|---|---|
| Enrollment created | Member | Immediately | Course, access period, next step | Start course |
| Manual enrollment | Member; administrator audit | Immediately | Course and reason | Open course |
| Enrollment removed | Member | Immediately | Course and access end | Contact support |
| Access expiring | Member | Scheduled | Expiry date and renewal path | Renew/manage plan |
| Access renewed | Member | Immediately | New period | Continue learning |
| New course available | Eligible member | At publication | Course summary | View course |
| Lesson/module released | Enrolled member | At release | Lesson title and course | Open lesson |
| Progress reminder | Member | Scheduled | Progress and next lesson | Continue learning |
| Course completed | Member | Immediately | Completion summary | View completion |
| Certificate issued | Member | Immediately | Certificate details | Download certificate |
| Assignment submitted | Member; reviewer | Immediately | Submission reference | View submission |
| Assignment graded | Member | Immediately | Result and feedback availability | View feedback |

### 4. Billing and payments

| Event | Recipient | Timing | Required content | Primary action |
|---|---|---|---|---|
| Purchase completed | Customer; finance audit | Immediately | Product, amount, tax, access | View receipt |
| Subscription started | Customer | Immediately | Plan, billing cycle, next date | Manage subscription |
| Trial started | Customer | Immediately | Trial end and conversion terms | Manage plan |
| Trial ending | Customer | Scheduled | End date and next charge | Manage plan |
| Payment succeeded | Customer | Immediately | Amount, currency, invoice/receipt | View receipt |
| Payment failed | Customer; finance administrator | Immediately | Reason where safe, retry date | Update payment method |
| Retry scheduled | Customer | Before retry | Retry date and amount | Update payment method |
| Final retry failed | Customer; finance administrator | Immediately | Access impact and support | Resolve payment |
| Subscription changed | Customer | Immediately | Old/new plan and proration | Review subscription |
| Cancellation scheduled | Customer | Immediately | End date and retained access | Resume subscription |
| Subscription canceled | Customer | At cancellation | Final status | Rejoin |
| Refund requested | Customer; finance administrator | Immediately | Request reference | View billing |
| Refund completed | Customer | Immediately | Amount, method, expected timing | View receipt |
| Invoice available | Customer | Immediately | Invoice period and amount | Download invoice |
| Billing hold applied | Customer; finance administrator | Immediately | Reason and effect | Resolve billing |
| Billing hold removed | Customer | Immediately | Access restored | Continue learning |

### 5. Community and groups

| Event | Recipient | Timing | Required content | Primary action |
|---|---|---|---|---|
| Mention | Mentioned member | Near real time | Author, space, excerpt | View discussion |
| Reply | Subscribed participant | Near real time | Author and excerpt | View reply |
| Announcement | Target members | At publication | Announcement summary | Read announcement |
| Group added/removed | Member | Immediately | Group and access effect | View groups |
| Membership request approved/rejected | Requesting member | Immediately | Decision and next step | Open community |
| Moderation action | Content author | Immediately | Action and appeal/support route | Review content |
| Digest | Opted-in member | Scheduled | Summary of activity | Open community |

### 6. Partner affiliates

| Event | Recipient | Timing | Required content | Primary action |
|---|---|---|---|---|
| Application received | Member; administrator | Immediately | Partner, date, reference | View application |
| Application approved/rejected | Member | Immediately | Decision and next step | View application |
| Referral tracked | Affiliate | Optional | Referral reference | View summary |
| Referral converted | Affiliate; administrator | Immediately | Conversion summary | View summary |
| Commission created | Affiliate; administrator | Immediately | Amount and status | View commission |
| Commission approved/voided | Affiliate | Immediately | Status and explanation | View commission |
| Payout scheduled | Affiliate | Scheduled | Amount, method, date | View payout |
| Payout completed/failed | Affiliate; finance administrator | Immediately | Result and remediation | View payout/contact support |
| Partner delivery failed | Administrator | Immediately | Partner, application, failure, retry count | Retry delivery |

### 7. Administrator and operational communication

| Event | Recipient | Timing | Required content | Primary action |
|---|---|---|---|---|
| Export/import completed or failed | Requesting administrator | On completion | Result and reference | Download/review |
| Email delivery failed | Operations administrator | On failure threshold | Template, recipient, provider status | Review delivery |
| High bounce/complaint threshold | Operations administrator | On threshold | Counts and affected sender | Review sending health |
| Stripe webhook failure | Finance/technical administrator | Immediately | Event ID and failure | Retry/reconcile |
| Migration or reconciliation issue | Technical administrator | Immediately | Environment and safe summary | Review operation |
| Security event | Security administrator | Immediately | Event type and affected identity | Investigate |
| Backup or recovery failure | Technical administrator | Immediately | Environment and failure | Review recovery |

## Recipient and audience rules

- Personal transactional messages go only to the affected account owner and required administrators.
- Group notifications use explicit group, course, community, or audience membership resolved server-side.
- Broadcasts require an administrator-selected audience and preview before send.
- Administrators cannot supply trusted account IDs, payment state, partner destinations, or entitlement changes from the browser.
- Member-visible messages never expose another member's data.

## FreeResend integration boundary

- FreeResend remains the provider used by the application.
- Payload must call the project FreeResend abstraction rather than introduce a second provider path.
- Provider API keys and sender credentials remain environment variables.
- Sender domains, reply-to addresses, and environment origins are configured outside templates.
- Authentication and verification messages disable link rewriting or click tracking where it could alter secure URLs.
- Webhook events are verified before updating delivery status.

## Delivery records and audit

Store at minimum:

- event key and template version;
- recipient type and recipient ID;
- related member, course, order, payment, group, community, or partner IDs;
- environment;
- FreeResend provider message ID;
- queued, sent, delivered, failed, bounced, complained, opened, and clicked times where available;
- retry count and last failure reason;
- actor or system source;
- preference decision for optional messages.

Sensitive content, password tokens, and full payment details must not be stored in delivery logs.

## Retry and failure rules

- Security and account messages may be retried only while their token remains valid.
- Payment and operational failures use bounded retries and administrator escalation.
- Duplicate provider events are idempotent.
- Permanent bounces and complaints suppress optional mail until reviewed.
- A failed email never directly changes entitlement, payment, or account state.

## Implementation order

### Communications Phase A — Foundation

- connect Payload to the existing FreeResend service;
- create shared JPV Bootcamp HTML and plain-text templates;
- add delivery records and verified webhook handling;
- add environment-safe link generation;
- add template preview and test-send support for administrators.

### Communications Phase B — Account and security

- invitation, verification, welcome, password setup/reset/change;
- email-address and profile-change confirmations;
- blocked, suspended, restored, and administrator security messages.

### Communications Phase C — Billing and access

- purchase, subscription, payment, retry, cancellation, refund, invoice, billing-hold, and access-restored messages.

### Communications Phase D — Learning and community

- enrollment, release, progress, completion, certificate, announcements, mentions, replies, groups, moderation, and digests.

### Communications Phase E — Partner, broadcast, and operations

- partner applications, referrals, commissions, payouts, delivery failures;
- administrator broadcasts and audience controls;
- operational alerts, delivery health, and reporting.

## Acceptance criteria

The communications phase is complete only when:

- Payload uses the existing FreeResend service in staging;
- every approved transactional template has HTML and plain-text output;
- login, invitation, verification, password reset, and password-change journeys work end to end;
- member and administrator templates are visibly distinct where required but share one brand system;
- security links are server-generated, time-limited, and environment-correct;
- optional notifications respect preferences and unsubscribe rules;
- billing messages match authoritative Stripe state;
- delivery webhooks are verified and idempotent;
- failures, retries, bounces, and complaints are visible to authorized administrators;
- no client-facing message contains Payload branding or internal terminology;
- representative administrator, member, billing, community, and partner messages are manually verified in staging.
