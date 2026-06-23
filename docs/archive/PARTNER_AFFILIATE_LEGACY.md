# Legacy Partner Affiliate and Sponsored Application System

## Status

This implementation is retained for production compatibility and historical reporting. It is deprecated for new development and must not be extended, deleted, redirected, or replaced before the Payload partner-affiliate replacement has passed reconciliation, rollback, authorization, reporting, and cutover approval.

The target replacement is documented in `docs/PAYLOAD_PARTNER_AFFILIATE_PLAN.md`.

## Verified legacy inventory

### Identity and authorization

The legacy partner surface uses a dedicated `partners_session` cookie backed by the Prisma `PartnerSession` model.

Stored session fields:

- session ID;
- WordPress user ID;
- normalized WordPress email hash;
- WordPress display name;
- creation and expiry timestamps.

Administrator access is determined through WordPress user IDs and environment-configured allowlists. This authorization model is not the target model for the Payload replacement.

### Partner click tracking

The Prisma `PartnerClick` model records:

- session ID;
- WordPress user ID;
- partner slug;
- category slug;
- referring path;
- privacy-safe user-agent hash;
- privacy-safe IP hash;
- creation timestamp.

The current operational report is implemented at:

- `src/app/(frontend)/operations/partners-clicks/page.tsx`

It supports:

- click totals by partner;
- click totals by category;
- recent click history;
- filtering by WordPress user ID;
- filtering by partner slug.

### Sponsored application flow

The sponsored-seat application flow is separate from partner-affiliate applications. It currently captures:

- applicant name;
- normalized email;
- phone number;
- optional message;
- requested Pro or VIP tier;
- status and timestamps;
- optional WordPress user ID.

Primary implementation paths:

- `src/app/api/sponsored-applications/route.ts`;
- `src/app/(frontend)/operations/sponsored-applications/page.tsx`;
- `src/app/api/admin/sponsored-applications/[id]/approve/route.ts`;
- `src/app/api/admin/sponsored-applications/[id]/reject/route.ts`.

The flow creates or updates Prisma `SponsoredApplication` records, sends administrator email notifications, and supports approve/reject decisions tied to sponsored seats and grants.

This is not an external partner-affiliate application system. It does not let a member choose a partner, persist the affiliate URL used, record delivery to the external partner, or provide a Payload member application history.

### Related Prisma models

The legacy domain includes:

- `PartnerSession`;
- `PartnerClick`;
- `SponsoredApplication`;
- `SponsoredSeat`;
- `SponsoredGrant`.

These records remain operational and may be used as historical migration sources. They are not the target schema.

## Retention rules

1. Keep all existing legacy routes, tables, sessions, reports, and sponsored-seat workflows operational until an approved cutover.
2. Do not migrate authentication responsibility from WordPress sessions incrementally.
3. Do not write new partner-affiliate features against the legacy Prisma tables.
4. Do not delete historical click or application records.
5. Preserve stable legacy identifiers for reconciliation.
6. Any future cutover must include count reconciliation by partner, member, date range, and event type.

## Known limitations

The legacy system can answer which WordPress user clicked a partner and how many clicks each partner received. It cannot reliably answer the complete target questions:

- which Payload member submitted an application;
- which partner received it;
- when the form was submitted;
- which affiliate URL was used;
- whether delivery succeeded;
- whether delivery was retried;
- what safe status the member should see;
- how administrators should export a partner-specific report.

## Replacement boundary

The replacement must use:

- Payload members for student identity;
- Payload administrators for administration and reporting;
- server-side authorization for every read and mutation;
- explicit partner, application, event, and delivery records;
- member-owned portal history;
- administrator-owned reports and exports;
- append-only audit events;
- non-destructive migration and cutover.

Until the replacement is validated, the existing implementation remains production-compatible, retained, and obsolete only for new development.
