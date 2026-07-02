# JPV Bootcamp Preview Release Readiness

This runbook separates repository changes, image publication, Payload migrations, Prisma startup behavior, provider email delivery, and preview deployment into independent approval categories.

## Scope and safety boundary

The preview release path must use the reviewed feature branch and an exact commit. Approval for one operation never authorizes another.

The protected local files `.graphifyignore` and `docs/HANDOFF_AUTH_BRANDING_STAGING_2026-06-30.md` are outside this runbook and must not be staged.

## Pending Payload migration order

Apply only after an explicit migration authorization naming the environment, database, schema, operator, backup, and maintenance window:

1. `20260701_201500_member_email_verification`
2. `20260702_001500_member_account_action_purposes`

The first migration creates the digest-only member action table, constraints, indexes, and original purpose enum. Its down migration drops the table and loses action records.

The second migration adds account-action purposes and security-event enum values. Rolling back that migration alone intentionally retains the added PostgreSQL enum values.

Payload migrations are separate from Prisma migration/startup behavior and are not applied by `scripts/db/deploy-prod.sh`.

## Required non-secret configuration names

The safe readiness checker reports presence, modes, public URL host/protocol, and explicit schema presence. It never returns secret or connection values.

Required for a normal preview runtime:

- `DATABASE_URL` with an explicit `schema` query parameter
- `SYSTEM_DATABASE_URL`
- `APP_SLUG`
- `NODE_ENV`
- `PAYLOAD_SECRET`
- one supported public URL: `APP_PUBLIC_URL`, `NEXT_PUBLIC_APP_URL`, `PAYLOAD_SERVER_URL`, `NEXT_PUBLIC_SERVER_URL`, or `APP_BASE_URL`
- `STARTUP_MODE`
- `DEPLOYMENT_RUNTIME`

Required before real queued email apply mode:

- `RESEND_API_KEY`
- either `RESEND_FROM` or `EMAIL_FROM`
- optional `EMAIL_REPLY_TO`
- reviewed `DISABLE_NON_WEBHOOK_EMAILS` mode

Run the safe checker only in an approved environment:

```sh
pnpm preview:readiness:check
```

The checker prints no API keys, database URLs, connection strings, sender addresses, passwords, sessions, action values, or account links.

## Startup modes

### Application-only

`STARTUP_MODE=application-only` is the Docker default.

It starts the standalone Next.js server and does not invoke `scripts/db/deploy-prod.sh`. It therefore does not initialize a schema or run Prisma or Payload migrations. Normal application runtime may still require configured database connectivity.

### Database-deploy

`STARTUP_MODE=database-deploy` is opt-in and additionally requires an explicit `DEPLOYMENT_ENV` of `preview`, `staging`, or `production`.

This mode invokes `scripts/db/deploy-prod.sh`, which can inspect or initialize schemas, create backups, run Prisma production migrations, and perform database smoke checks. It does not apply Payload migrations.

Database-deploy startup requires separate authorization from image push, Payload migrations, provider delivery, and preview deployment.

Unknown startup or deployment environment values fail closed.

## Build and runtime paths

The supported preview path builds the repository Dockerfile with Node 20 and pnpm 10.33.0. The fallback Nixpacks configuration also uses Node 20 and pnpm 10.33.0, but preview automation should use the Docker build path.

Feature-branch workflow execution publishes an image. External infrastructure may redeploy after image publication, so push and deployment authorization must be considered separately.

## Queued email dry-run and apply behavior

Account-security email uses `payload_email_events` and the existing queued sender. The legacy welcome-email helper is a separate pipeline.

The queue runner defaults to dry-run. Dry-run does not call the provider, but it still initializes Payload and therefore requires authorized database access.

Apply mode requires:

- the explicit `--apply` option;
- approved provider configuration;
- an approved sender identity;
- approved recipients and operating window;
- database and queue access authorization.

No provider delivery should occur merely because a preview image was published or deployed.

## Delivery observability

Operators correlate delivery through:

- `deliveryStatus`: queued, sent, failed, or suppressed;
- deterministic dedupe key;
- provider message ID;
- sent and delivered timestamps;
- bounded failure reason;
- matching member-security event;
- matching audit event.

Sensitive invitation, reset, verification, and email-change action URLs are redacted after successful delivery. Stale queued or failed sensitive links are removed by the cleanup service after the configured retention window.

## Retry rules

- Default cooldown: five minutes.
- Default send-attempt cap: three.
- Do not clone email-event records or manually copy action links.
- Reissue only through the purpose-specific application service.
- Preserve the original failed event and audit evidence.
- Confirm the action is unexpired, unconsumed, uncompromised, and eligible before retry.
- Stop and escalate after the retry cap, duplicate provider delivery, failed redaction, missing audit correlation, or suspected action exposure.

## Rollback decision tree

### Application failure without migration failure

Pause queue processing and deploy the previously approved image. Leave additive schema objects in place.

### Migration interrupted

Stop application rollout, prevent concurrent retries, capture the exact migration state, and choose an approved idempotent retry or backup restoration. Do not improvise a down migration.

### Payload migrations completed but application fails

Roll back the application image and retain the additive schema. Dropping the first migration destroys action records and requires an explicit data-loss decision.

### Provider outage or email backlog

Keep apply mode disabled, preserve queued and failed events, retain provider IDs and failure reasons, and resume in controlled batches after recovery.

### Compromised invitation, reset, verification, or email-change action

Invalidate the action rather than deleting it. Preserve delivery and audit records, issue a replacement through the normal service, and escalate when account access or log exposure is suspected.

### Erroneous account-status notice

A delivered message cannot be recalled. Correct account state through an approved administrative action, preserve the original evidence, and issue a separately approved correction notice.

## Independent authorization templates

### Push authorization

```text
Authorize push only.
Repository: prochattools-jpv-bootcamp
Branch: <exact branch>
Commit: <exact commit>
Remote: <exact remote>
Operator: <name>
Window: <time>

This does not authorize Payload migrations, Prisma migration/startup behavior, provider email delivery, preview deployment, production deployment, merge, rebase, reset, or force-push.
```

### Payload migration authorization

```text
Authorize Payload migrations only.
Commit: <exact commit>
Environment: <exact environment>
Database identifier: <approved non-secret identifier>
Schema: <exact schema>
Migrations in order:
1. 20260701_201500_member_email_verification
2. 20260702_001500_member_account_action_purposes
Backup and restore point: <confirmed evidence>
Maintenance window: <time>
Operator: <name>
Rollback owner: <name>

This does not authorize push, Prisma migrations, schema initialization, provider delivery, or deployment.
```

### Prisma startup authorization

```text
Authorize database-deploy startup only.
Commit/image: <exact value>
Environment: <preview|staging|production>
STARTUP_MODE: database-deploy
DEPLOYMENT_ENV: <exact environment>
Backup requirements confirmed: <yes/no>
Prisma migration scope reviewed: <yes/no>
Operator: <name>
Rollback owner: <name>

This does not authorize Payload migrations, push, provider delivery, or preview deployment.
```

### Provider email authorization

```text
Authorize controlled provider email delivery only.
Environment: <exact environment>
Provider mode: apply
Approved sender identity: <approved non-secret identifier>
Approved internal recipients: <exact list>
Templates/flows: <exact list>
Window: <time>
Operator: <name>
Stop conditions reviewed: <yes/no>

This does not authorize push, database access beyond the named queue operation, migrations, or deployment.
```

### Preview deployment authorization

```text
Authorize preview deployment only.
Branch: <exact branch>
Commit/image digest: <exact value>
Target: <exact preview target>
STARTUP_MODE: <application-only|database-deploy>
Payload migration prerequisite: <status>
Prisma startup authorization: <separate approval reference or not authorized>
Provider mode: <disabled|dry-run-only|apply with separate approval>
Rollback image and owner: <exact values>
Window: <time>

This does not authorize push, Payload migrations, Prisma database operations, provider delivery, production deployment, or operations on main.
```
