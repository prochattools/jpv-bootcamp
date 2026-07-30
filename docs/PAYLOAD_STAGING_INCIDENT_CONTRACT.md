# Payload staging incident contract

## Status

- IMPLEMENTED: repository migration and application-only startup protections.
- LOCALLY VERIFIED: only after the focused commands listed below pass in this repository.
- STAGING VERIFIED: not claimed by this document.
- EXTERNAL: approved migration execution, Dokploy release, storage configuration, and authenticated staging checks.

## Schema and migration contract

`payload_membership_audit_history` uses four optional Payload relationship columns:

- `membership_support_id`
- `voucher_id`
- `funding_source_id`
- `reconciliation_id`

They were introduced with the membership-support collection work in `15bac8e`. The repository migration `20260730_090000_membership_audit_relationship_columns` adds all four columns, indexes, and foreign keys in the schema selected from `DATABASE_URL` (or the explicitly reviewed `PAYLOAD_MIGRATION_SCHEMA`). It must never default a preview/staging migration into another schema.

`20260730_100000_email_events_staging_guard_status` adds the PostgreSQL enum value used by the email terminal state. Its down migration is intentionally a no-op because PostgreSQL enum values cannot be removed safely.

Application-only mode does not initialize a schema or apply migrations. Before Next.js starts, it now reads the selected schema's `payload_migrations` table and refuses startup if any registered Payload migration is missing, the migration table is unavailable, or the database schema cannot be determined. This check is read-only and does not print the database URL or credentials.

For the approved staging target only, operators use:

```bash
pnpm payload:staging:migrate:status
pnpm payload:staging:migrate
```

The second command is a database mutation and requires the existing staging migration authorization, backup/rollback ownership, and an explicit `DATABASE_URL` with `schema=jpvbootcamp_staging`. Do not use it from release validation, application-only startup, production, or an unreviewed database URL.

After the migration is applied, deploy the feature branch to staging through the approved Dokploy release process. Confirm the deployed revision and the application-only preflight before exercising the audit-history admin collection.

## Legacy course access badge

Current `accessBadge` storage is restricted to `manual`. Historical course seed data used `free`, `pro`, and `vip`; the `beforeValidate` hook performs only that explicit mapping. Any other new string remains invalid, so Payload select validation is retained.

To verify course ID 3 in staging, open it in Payload admin, change only the title, save, reload, and verify that the title changed, unrelated fields are unchanged, and `accessBadge` is persisted as `manual` without an Access Badge validation error.

## Staging email queue contract

Payload-native authentication mail remains an immediate Resend adapter path. Business/event email remains the durable `payload_email_events` queue path.

In `preview` and `staging`, only the single email in `STAGING_TEST_RECIPIENT_EMAIL` may receive mail. A missing or malformed value fails clearly. Production is never restricted merely because a staging recipient variable is present.

When a queued event targets another recipient in staging/preview, it is recorded as `blocked_by_staging_guard` with the safe reason `blocked_by_staging_guard`. This is terminal for the worker: future queue runs select only `queued` rows. The worker logs an event id and the reason, not a recipient or credential. If the staging recipient configuration itself is absent, the event is marked `failed` with `staging_test_recipient_unconfigured` for an authorized operator to correct and retry.

## Payload media persistence

The missing names `proof-image-c3a1995.png` and `staging-proof-pixel.png` do not appear in repository fixtures or seed/import code. They are therefore not proven disposable test records and must not be deleted by a repository cleanup migration.

`payload_media` is configured for local `/app/public/media/` storage by default. Container-local files are ephemeral. The repository already includes the supported Payload S3 adapter and fails closed when `PAYLOAD_MEDIA_REQUIRE_DURABLE=true` is set without complete S3 configuration. The bounded external remediation is to configure that existing adapter in Dokploy (including its required secret settings) and re-upload or restore only operator-identified legitimate assets. Do not fabricate replacements. A persistent volume is an alternative only if it is mounted at `/app/public/media/` and its persistence is verified after a container replacement.

## Required external staging verification

1. Run the approved staging migration job and record its output outside credentials-bearing logs.
2. Deploy this feature branch to staging and confirm the exact revision.
3. Confirm startup reports the migration state as current; confirm the audit-history collection loads without any of the four missing-column errors.
4. Perform the course ID 3 title-only edit verification above.
5. Send one permitted message to `STAGING_TEST_RECIPIENT_EMAIL`; create one non-permitted queued event only under approved staging test authority; confirm it becomes terminal and remains unprocessed on the next worker run.
6. Confirm the two missing media rows against the selected storage remediation before deleting or restoring anything.
