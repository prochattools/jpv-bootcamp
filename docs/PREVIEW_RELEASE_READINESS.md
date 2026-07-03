# JPV Bootcamp Preview Release Readiness

This runbook separates repository changes, image publication, Payload migrations, Prisma startup behavior, provider email delivery, preview deployment, and smoke verification into independent approval categories.

## Scope and safety boundary

The preview release path must use the reviewed feature branch and an exact commit. Approval for one operation never authorizes another.

The protected local files `.graphifyignore` and `docs/HANDOFF_AUTH_BRANDING_STAGING_2026-06-30.md` are outside this runbook and must not be staged.

## Workflow architecture

The previous preview workflow published an image from ordinary feature-branch pushes. That behavior is intentionally replaced.

### Preview Validation

`.github/workflows/deploy-preview.yml` is now named `Preview Validation`. It runs on feature-branch pushes and pull requests with `contents: read` permission only.

It may install dependencies, run preview/release safety tests, type-check, build the application, and build the Dockerfile with `push: false`.

It must not log in to GHCR, publish an image, call Dokploy, deploy, run Payload migrations, run Prisma migrations, execute `database-deploy` startup, initialize a database, run queued provider email, or perform live smoke checks.

### Publish Preview Image

`.github/workflows/publish-preview-image.yml` is named `Publish Preview Image`. It runs only by `workflow_dispatch`, requires a full `commit_sha`, a target environment, a confirmation phrase, and a reproducible `source_date`, checks out exactly that SHA, verifies `git rev-parse HEAD`, and publishes only an immutable SHA-tagged image such as:

```text
ghcr.io/<repository>:<full-commit-sha>
```

It uses the `preview-image-publish` GitHub environment, `contents: read`, and `packages: write`. It must not publish `latest`, deploy, call Dokploy, run migrations, start database-deploy behavior, call a provider, or perform live smoke checks.

A Git push does not authorize image publication. Image publication does not authorize deployment. Image publication does not authorize Payload migrations, Prisma/database-deploy startup, provider dry-run, provider apply, or smoke verification.

## Release manifest and offline preflight

Generate non-secret release metadata with:

```sh
pnpm preview:release:manifest --commit-sha=<40-char-sha> --image-reference=<immutable-image> --target-environment=preview
```

The manifest records repository, commit, immutable image reference, target environment, startup mode, deployment runtime, Node 20, pnpm 10.33.0, the exact Payload migration order, authorization booleans, required configuration names, and optional rollback/artifact metadata. It must not contain secrets, database URLs, connection strings, sender addresses, recipient addresses, tokens, action URLs, GitHub tokens, or provider credentials.

Validate a local authorization packet without performing operations:

```sh
pnpm preview:release:preflight --authorization-file=<local-json>
```

Offline preflight validates each category independently:

- Git push;
- image publication;
- Payload migration;
- Prisma/database-deploy startup;
- provider dry-run;
- provider apply;
- preview deployment;
- post-deployment smoke verification.

## Phase 10 shadow validation and cutover readiness

Phase 10 adds a repository-only shadow-validation report and a separate approval track for the final cutover boundary. The approval categories remain independent:

- migration execution;
- preview deployment;
- billing webhook, checkout, and portal verification;
- provider email dry-run;
- provider email apply;
- community journey verification;
- partner delivery verification;
- final cutover approval.

The shadow report and preflight helpers never authorize live migration, deployment, provider delivery, or cutover by themselves. A healthy repository state still leaves `cutoverReady` false until every live approval is present.

The admin-only `/operations/shadow-validation` page shows concrete domain totals, issue codes, and an executable acceptance matrix for the core member, billing, email, community, and partner journeys. It remains read-only and does not perform any live verification.

Preflight does not push, log in to a registry, connect to a database, run migration status, execute migrations, initialize Payload, call a provider, call deployment infrastructure, or perform smoke requests.

## Billing readiness checklist

Billing readiness is a separate authorization track from image publication and deployment. The reviewer must confirm each category independently before any live billing operation is attempted.

- Migration execution authorization: approve the exact migration set, target database, schema, operator, and maintenance window before running the two pending Payload migrations.
- Deployment authorization: approve the reviewed preview commit or image separately from migrations and provider operations.
- Webhook configuration authorization: confirm the canonical Stripe webhook route and event set without changing production settings.
- Checkout and portal smoke verification authorization: approve controlled preview smoke checks for member checkout and billing portal flow behavior only.
- Provider email acceptance authorization: separately approve real provider email delivery, sender identity, and controlled recipient scope.

The checklist only gates operations. It does not claim live success or imply that any provider, deployment, or database step has already happened.

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

Supported account-security provider flow/template keys for release authorization are:

- `member-email-verification`
- `member-invitation`
- `member-password-reset`
- `member-password-changed`
- `member-email-change-confirmation`
- `member-email-change-requested`
- `member-email-changed`
- `access-blocked`
- `access-restored`

Provider dry-run and provider apply are mutually independent. Dry-run authorization never authorizes provider apply. Provider apply requires an approved non-secret sender identity identifier, recipient scope, exact flow list, retry policy, operator, and stop conditions.

## Smoke verification

Plan smoke verification without making network requests:

```sh
pnpm preview:smoke:plan
```

The default smoke harness is inert and prints a plan. Future live execution requires explicit `--execute`, an exact HTTPS target, and a valid authorization file. Smoke authorization remains separate from Git push, image publication, migrations, provider dry-run, provider apply, and deployment.

Planned checks classify whether they require network access, authentication, mutation, database reads, database writes, provider calls, and the authorization category required. Do not embed credentials, recipient addresses, real tokens, or provider secrets in smoke plans.

## Public account-action route controls

Member account-action API routes accept only bounded JSON request bodies and return `Cache-Control: no-store`. Token completion routes redirect to fixed clean login result URLs rather than reflecting callback destinations.

Public issuance routes such as verification resend and forgot password use generic responses for unknown, already-complete, blocked, deleted, or otherwise ineligible accounts. Route-boundary throttles hash normalized identity and network inputs before tracking attempts. Per-token cooldowns and maximum send attempts remain enforced by the account-action services.

Authenticated profile email-change requests must be same-origin and keep the current sign-in email active until the new address is confirmed.

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

### Image publication authorization

```text
Authorize image publication only.
Repository: prochattools-jpv-bootcamp
Commit: <exact 40-character commit>
Target environment label: <preview|staging>
Image reference: ghcr.io/<repository>:<exact commit>
Operator: <name>
Stop conditions: <conditions>

This does not authorize Git push, Payload migrations, Prisma/database-deploy startup, provider dry-run, provider apply, preview deployment, production deployment, live smoke checks, merge, rebase, reset, or force-push.
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

### Post-deployment smoke authorization

```text
Authorize post-deployment smoke verification only.
Commit/image: <exact value>
Target: <exact HTTPS target>
Allowed checks: <exact list>
Database access allowed: <yes/no>
Provider email allowed: <yes/no>
Operator: <name>
Stop conditions: <conditions>

This does not authorize push, image publication, Payload migrations, Prisma/database-deploy startup, provider apply, preview deployment, production deployment, or operations on main.
```
