# Payload Partner Affiliate Implementation Plan

## Status and scope

This document defines the target replacement for the retained Prisma/WordPress partner-click and sponsored-application implementation documented in `docs/archive/PARTNER_AFFILIATE_LEGACY.md`.

This phase is inventory and architecture only. It does not authorize collection creation, migrations, seeds, routes, delivery jobs, or production cutover.

## Product goal

JPV members can review active partner affiliates, submit a controlled application, and see their own application history. Payload administrators can manage partners, inspect all applications, measure clicks and submissions, export partner-specific reports, retry failed delivery, and audit every status transition.

The system must answer:

- which member interacted with which partner;
- which member submitted which application;
- when submission and delivery occurred;
- which affiliate configuration was used;
- whether delivery succeeded;
- how many clicks, submissions, and unique members each partner received;
- which records belong in a partner-facing report.

## Security boundary

- Members authenticate through the Payload member domain and use `/portal`.
- Administrators authenticate through the Payload administrator domain and use `/admin`.
- Members may read only their own applications and member-safe statuses.
- Administrators receive explicit collection and export permissions.
- Partner URLs, webhook endpoints, recipient addresses, delivery errors, internal notes, and audit metadata are server-only or administrator-only.
- The browser never supplies a trusted member ID, partner delivery address, affiliate URL, webhook endpoint, or application status.
- All application, click, delivery, export, and status operations are enforced server-side and fail closed.

## Target Payload collections

### `payload_partner_affiliates`

Administrator-managed partner directory.

Recommended fields:

- `name` — partner-facing display name;
- `slug` — stable unique route key;
- `status` — `draft`, `active`, `paused`, `archived`;
- `category` — controlled relationship or select value;
- `description` — member-facing summary;
- `logo` — relationship to public Payload media;
- `affiliateUrl` — administrator-managed outbound URL;
- `applicationMode` — `redirect`, `email`, `webhook`, `manual_export`;
- `recipientEmails` — administrator-only email destinations;
- `webhookEndpoint` — administrator-only endpoint;
- `requiredFields` — controlled field configuration, not arbitrary executable schema;
- `privacyNotice` — consent text shown before submission;
- `sortOrder` — portal ordering;
- `externalReference` — optional partner identifier;
- `createdBy` / `updatedBy` — administrator audit relationships;
- timestamps.

### `payload_partner_applications`

Authoritative member application record.

Recommended fields:

- `member` — required relationship to `payload_members`;
- `partner` — required relationship to `payload_partner_affiliates`;
- `status` — `draft`, `submitted`, `delivery_pending`, `delivered`, `delivery_failed`, `acknowledged`, `closed`;
- `submittedAt`;
- `deliveredAt`;
- `applicationReference` — non-sensitive external reference;
- `memberNameSnapshot`;
- `memberEmailSnapshot`;
- `memberPhoneSnapshot`;
- controlled application fields such as company, country, experience, message, and consent;
- `affiliateUrlSnapshot` — exact configured URL used for this submission;
- `consentAcceptedAt`;
- `deliveryMethod`;
- `deliveryAttempts`;
- `lastDeliveryError` — sanitized and administrator-only;
- `source` — `portal`, `administrator`, `migration`;
- optional `legacyWpUserId` and legacy record references;
- internal notes restricted to administrators;
- timestamps.

### `payload_partner_events`

Append-only operational and reporting event stream.

Recommended event types:

- `partner_viewed`;
- `affiliate_link_clicked`;
- `application_started`;
- `application_submitted`;
- `delivery_attempted`;
- `delivery_succeeded`;
- `delivery_failed`;
- `application_status_changed`;
- `report_exported`.

Recommended fields:

- `member`;
- `partner`;
- optional `application`;
- `eventType`;
- `occurredAt`;
- `sourceRoute`;
- campaign/reference code;
- privacy-safe session reference;
- optional IP and user-agent hashes only when justified by privacy policy;
- administrator actor for administrative events;
- sanitized metadata with a strict schema.

### Delivery outbox

Use the existing queued-event architecture or a dedicated `payload_partner_delivery_jobs` collection for email and webhook delivery.

Required properties:

- idempotency key;
- application relationship;
- partner relationship;
- delivery method;
- state;
- attempt count;
- next attempt time;
- sanitized failure category;
- created, attempted, and completed timestamps.

External delivery must not occur as an untracked browser side effect.

## Member routes and screens

### `/portal/partners`

- active partner directory;
- category filters;
- member-safe descriptions;
- clear application action;
- no administrator delivery configuration.

### `/portal/partners/[partnerSlug]`

- partner description and logo;
- privacy notice;
- application requirements;
- member-safe disclosure of what information will be shared.

### `/portal/partners/[partnerSlug]/apply`

- authenticated member only;
- prefilled verified member profile fields where available;
- partner-specific controlled fields;
- explicit consent checkbox;
- server-side validation;
- application record created before redirect or delivery;
- no client-provided affiliate URL or delivery destination.

### `/portal/partner-applications`

Member history showing:

- partner name;
- submitted date;
- member-safe status;
- delivery confirmation when appropriate;
- follow-up action when appropriate.

Members must not see recipient emails, webhook endpoints, delivery errors, internal notes, export history, or other members.

## Administrator navigation and screens

Payload navigation group:

```text
Partners
├── Partner Affiliates
├── Partner Applications
└── Partner Activity
```

Administrator capabilities:

- create, edit, pause, and archive partners;
- maintain affiliate URLs and delivery configuration;
- review and filter applications;
- inspect application and delivery timelines;
- retry failed deliveries;
- change controlled statuses with audit events;
- export filtered CSV reports;
- view click, submission, delivery, and conversion summaries.

Recommended filters:

- partner;
- member;
- application status;
- delivery status;
- category;
- submitted date range;
- source;
- legacy migration status.

## Reporting design

Required metrics:

- clicks by partner;
- submissions by partner;
- unique members by partner;
- click-to-submit conversion;
- delivery success rate;
- failed delivery count;
- applications by period;
- member application history.

CSV export must:

- be administrator-authorized server-side;
- respect current filters;
- include only approved report fields;
- avoid secrets, webhook configuration, raw hashes, and internal errors;
- create a `report_exported` audit event;
- include export timestamp and administrator actor.

Suggested partner-facing columns:

- partner name;
- application reference;
- member name;
- member email when contractually permitted;
- member phone when consented;
- submission timestamp;
- delivery timestamp;
- safe application status;
- agreed application fields.

## Dummy partner seed proposal

For local and staging demonstration only:

1. `Demo Finance Partner`
   - category: finance;
   - mode: redirect;
   - URL: `https://example.com/finance?ref=jpv-demo`.
2. `Demo Software Partner`
   - category: software;
   - mode: email;
   - dummy recipient owned by the test environment.
3. `Demo Advisory Partner`
   - category: advisory;
   - mode: manual export;
   - no external delivery.

Seed commands must refuse production by default and must never contain live partner credentials.

## Form data recommendation

Initial controlled fields:

- member name;
- verified email;
- phone;
- country;
- company or project name;
- experience level;
- short message;
- consent acceptance;
- optional partner-specific reference fields approved in advance.

Avoid unrestricted JSON form payloads. Add schema fields deliberately so reporting, consent, privacy, and migration remain understandable.

## Click and submission flow

1. Member opens an active partner page.
2. Server records a privacy-safe `partner_viewed` event when required.
3. Member starts the form; server may record `application_started`.
4. Member submits controlled fields and consent.
5. Server resolves the authenticated member and active partner.
6. Server snapshots approved member and partner data.
7. Server creates the application before any redirect or external delivery.
8. Server records `application_submitted`.
9. Server queues delivery or returns a validated same-origin continuation.
10. Worker attempts delivery and records success or failure.
11. Member sees only a safe application status.
12. Administrator sees the full operational timeline.

## Migration and reconciliation

Legacy sources:

- `partner_sessions`;
- `partner_clicks`;
- `sponsored_applications` only where records genuinely represent partner applications;
- WordPress user IDs and email hashes;
- static partner definitions and category slugs.

Migration rules:

- do not treat sponsored-seat applications as partner applications without an explicit mapping decision;
- preserve legacy IDs in dedicated reference fields;
- map WordPress users to Payload members through reviewed identity reconciliation;
- import click events only when partner slug and member mapping are reliable;
- do not invent delivery success for historical clicks;
- retain raw legacy exports outside member-facing records;
- reconcile counts by partner, date range, event type, and mapped member;
- dry-run first and require explicit apply approval.

## Privacy and retention

Before implementation, approve:

- which member fields may be shared with each partner;
- consent wording and versioning;
- retention period for applications and events;
- whether IP/user-agent hashes are necessary;
- who may export personal data;
- deletion and correction procedures;
- partner-specific contractual reporting fields.

## Acceptance criteria

### Member

- only active partners appear;
- member can submit an application once under defined duplicate rules;
- application is linked to the authenticated member;
- application is persisted before external delivery;
- member sees only their own history;
- direct URLs cannot expose another member’s application;
- partner configuration and delivery errors remain hidden.

### Administrator

- administrator can manage partner records;
- administrator can filter applications by partner, member, status, and date;
- administrator can see clicks, submissions, unique members, and delivery outcomes;
- administrator can export an authorized CSV;
- every retry, export, and status change produces an audit event;
- ordinary members cannot access collections or exports.

### Delivery

- delivery is idempotent;
- failed delivery is retryable;
- client input cannot select an arbitrary endpoint or URL;
- redirects are constructed only from the stored active partner configuration;
- email and webhook secrets never reach the client;
- duplicate requests do not create uncontrolled duplicate submissions.

### Cutover

- legacy and Payload counts reconcile within reviewed rules;
- member mappings are reviewed;
- administrator reporting is accepted;
- rollback is tested;
- legacy routes remain available until explicit cutover approval;
- no legacy table or route is deleted as part of initial implementation.

## Recommended implementation sequence

1. Approve fields, consent, statuses, duplicate policy, and report columns.
2. Add Payload collections and access rules.
3. Add pure member/application/delivery services with tests.
4. Seed dummy partners in local/staging only.
5. Build member directory, application form, and history.
6. Build administrator collections, filters, metrics, and CSV export.
7. Add queued email/webhook delivery.
8. Add legacy dry-run reconciliation.
9. Run shadow validation and rollback tests.
10. Obtain explicit cutover approval.
