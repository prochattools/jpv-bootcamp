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

It must not log in to GHCR, publish an image, call Dokploy, deploy, run Payload migrations, run Prisma migrations, execute `database-deploy` startup, initialize a database, run queued provider email, or perform live smoke checks unless the feature-branch publish workflow is the authorized path.

### Publish Preview Image

`.github/workflows/publish-preview-image.yml` is named `Publish Preview Image`. Manual publication runs by `workflow_dispatch`, requires a full `commit_sha`, a target environment, a confirmation phrase, and a reproducible `source_date`, checks out exactly that SHA, verifies `git rev-parse HEAD`, and publishes an immutable SHA-tagged image such as:

```text
ghcr.io/<repository>:<full-commit-sha>
```

Authorized feature/pr pushes may also publish the branch-tagged preview image plus the immutable SHA tag. The workflow uses the `preview-image-publish` GitHub environment, `contents: read`, and `packages: write`. It must not publish `latest`, deploy, call Dokploy, run migrations, start database-deploy behavior, call a provider, or perform live smoke checks.

A Git push to an authorized feature branch can publish the branch-tagged preview image through workflow execution. Image publication does not authorize deployment. Image publication does not authorize Payload migrations, Prisma/database-deploy startup, provider dry-run, provider apply, or smoke verification.

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

## Rollback plan and staging packet

Generate a deterministic rollback plan without touching a database or provider:

```sh
pnpm preview:rollback:plan
```

Generate the release packet used by the staging gate:

```sh
pnpm preview:release:packet
```

Validate an existing packet or rollback evidence file without making live calls:

```sh
pnpm preview:release:packet --mode=validate --packet-file=<local-json>
pnpm preview:rollback:plan --mode=validate-evidence --evidence-file=<local-json>
```

Both commands are repository-only. They never authorize pushes, images, migrations, deployment, provider delivery, billing verification, community verification, partner verification, rollback execution, or cutover.

The rollback draft now derives migration backout entries from the canonical nine-item inventory, keeps planned freeze controls separate from confirmed evidence, and records whether repository-only planning mode is missing approvals.

The release packet now binds the exact branch, HEAD, repository identifier, immutable image reference, migration order, and typed approval records. Placeholder approvals, duplicate approval references, missing evidence, and repository drift fail closed.

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

The admin-only `/operations/shadow-validation` page now reads a bounded Payload snapshot, shows collection counts, domain totals, issue codes, and an executable acceptance matrix for the core member, billing, email, community, and partner journeys, and offers a safe evidence download. It remains read-only and does not perform any live verification.

The canonical reviewed migration inventory is now unified across policy, manifest, preflight, shadow evidence, and validation. It lists the ten reviewed Payload migrations in exact order, ending with `20260704_090000_partner_schema_reconciliation`, but execution remains pending until an explicit migration authorization is granted.

Preflight does not push, log in to a registry, connect to a database, run migration status, execute migrations, initialize Payload, call a provider, call deployment infrastructure, or perform smoke requests.

## Provider email readiness (staging)

**Current status (4 July 2026):**

Staging image rebuilt with `DISABLE_NON_WEBHOOK_EMAILS=false` and confirmed via `/api/health/deployment`:
- `resendApiKeyPresent`: true
- `senderIdentityPresent`: true
- `webhookEmailsDisabled`: false
- `readyForApply`: true

Queued email sender enhanced with `--event-id` targeting to prevent bulk sends and enforce single-event authorization.

When ready to send one controlled verification email:
```sh
pnpm exec tsx scripts/payload/send-queued-emails.mts --apply --event-id=<redacted-id>
```

**Account recovery update (5 July 2026):**

- Staging preview remains healthy with `application-only`/Docker runtime, ten reviewed Payload migrations in inventory, and email readiness `readyForApply: true`.
- The controlled member account `i***@yeshua.academy` is active and verified. Login was blocked by failed-password/lockout history and an unknown current password, not by verification, session, or portal routing.
- Source fixes for account recovery are deployed on the feature branch: password-reset queue writes avoid a non-unique conflict target, active reset actions can be replaced safely, reset completion clears lockout state best-effort, and queued email send status persists through the collection update path.
- Exactly one targeted password-reset email was sent for the controlled account. The reset action and email artifacts were inspected only through sanitized yes/no evidence. Event IDs, provider IDs, recipient values, action URLs, token digests, and password hashes were not recorded in docs.
- Operator reset completion, login, and portal acceptance are now complete for the controlled account:
  - reset completed on the preview domain through the JSON reset route and Payload auth reset flow;
  - the custom reset action was consumed only after the password update path completed;
  - lockout no longer blocked login, login attempts were below threshold, and the active reset action was absent after completion;
  - login with the newly set password succeeded;
  - the Member Portal dashboard loaded with no visible error text;
  - visible portal evidence included dashboard navigation, the "Welcome back" dashboard, the JPV Bootcamp Foundations course card, and the sign-out control.
- Non-blocking hardening follow-ups remain: `lastLoginAt` was not confirmed/set, the password-changed security event was not recorded, and the password-changed confirmation email was not queued/sent. These are not blockers to account recovery, login, or portal acceptance.

**Account-security side-effect hardening update (6 July 2026):**

- Source commit `8cd4f95161bfb418e6a37057d4f1a281ca3ba7bf` hardens the focused Phase 6 side effects without reopening the account recovery flow:
  - accepted member sessions record `lastLoginAt` best-effort only after the member portal destination is allowed;
  - successful password resets record a `password_changed` member security event after Payload auth reset and lockout cleanup;
  - the password-changed confirmation email queues after the security event exists, and audit/queue failures are isolated from reset success.
- Local validation passed for the focused reset, auth, account-action, account-email-route, security-control, deployment-health, type-check, production-build, whitespace, and CMS-exclusion gates.
- Feature-branch GitHub preview validation and preview image publication passed for the same commit.
- The existing Dokploy staging app `JPV Bootcamp | Payload CMS` was redeployed with `ghcr.io/prochattools/jpv-bootcamp:feature-course-branding-and-preview`; `/api/health/deployment` returned 200 JSON with Docker/application-only runtime, ten reviewed Payload migrations in inventory, and email readiness `readyForApply: true`.
- Live side-effect acceptance remains a controlled-operator step:
  - `lastLoginAt` needs one normal member login on staging, followed by sanitized metadata inspection;
  - password-changed security-event and confirmation-email verification need separate authorization for another password-reset email/reset cycle before any provider email is requested or sent.

**Admin logout boundary acceptance update (6 July 2026):**

- The existing Dokploy staging app was redeployed from `feature/course-branding-and-preview` for commits `742d7b2d18b3cda3b07820b0a20484418bfae138` and `3473e25fbe512963aae97fd9d505048d15a41c89`.
- Staging health returned HTTP 200 with Docker/application-only runtime, ten reviewed Payload migrations in inventory, and email readiness `readyForApply: true`.
- Live route checks showed both GET and POST `/admin/logout` return a public HTTPS preview admin-login redirect with `loggedOut=1` and no internal origin.
- Cookie-clearing evidence showed Payload-prefixed auth cookies are expired while unrelated cookies are not targeted.
- Operator acceptance confirms the member-to-admin unauthorized boundary no longer traps the user in an unauthorized loop, the prior `http://0.0.0.0:3000` redirect regression is fixed, and admin login works after logout.
- No regression to member portal login was reported.
- Sanitized read-only metadata for `i***@yeshua.academy` confirms exactly one active, verified, unlocked member row with login attempts below threshold, but `lastLoginAt` is still not accepted after the hardening deployment. One fresh successful member login followed by sanitized inspection remains required for that Phase 6 side-effect.

**Member last-login acceptance update (6 July 2026):**

- Source commit `e6e59eebae42f8269726f28501db88bea7932cc7` hardens the accepted member-session metadata path by using the Payload database `updateOne` adapter for `lastLoginAt` after member eligibility succeeds.
- Staging health returned HTTP 200 with Docker/application-only runtime, ten reviewed Payload migrations in inventory, and email readiness `readyForApply: true`.
- Operator acceptance confirms a fresh login for `i***@yeshua.academy` succeeded after the `e6e59ee` deployment, the member portal loaded, and no visible error text was reported.
- Sanitized read-only staging metadata confirms exactly one active, verified, unlocked controlled member row with login attempts below threshold and `lastLoginAt` set after the `e6e59ee` deployment.
- Phase 6 `lastLoginAt` live acceptance is complete.
- No regression was reported for account recovery, member portal loading, administrator unauthorized handling, administrator logout, or administrator login.

## Billing readiness checklist

Billing readiness is a separate authorization track from image publication and deployment. The reviewer must confirm each category independently before any live billing operation is attempted.

- Migration execution authorization: approve the exact migration set, target database, schema, operator, and maintenance window before running the two pending Payload migrations.
- Deployment authorization: approve the reviewed preview commit or image separately from migrations and provider operations.
- Webhook configuration authorization: confirm the canonical Stripe webhook route and event set without changing production settings.
- Checkout and portal smoke verification authorization: approve controlled preview smoke checks for member checkout and billing portal flow behavior only.
- Provider email acceptance authorization: separately approve real provider email delivery, sender identity, and controlled recipient scope. Staging has confirmed `readyForApply: true`. One test verification email can be sent per operator event-id targeting.

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

Email readiness is observable from `/api/health/deployment` without secrets:

```json
{
  "emailReadiness": {
    "resendApiKeyPresent": boolean,
    "senderIdentityPresent": boolean,
    "webhookEmailsDisabled": boolean,
    "readyForApply": boolean
  }
}
```

When `readyForApply` is false, registration and email verification queue properly but delivery requires the missing configuration. Operators run dry-run only to inspect queue without credentials.

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

Feature-branch workflow execution publishes the branch-tagged preview image and the immutable SHA tag. External infrastructure may redeploy after image publication, so push and deployment authorization must be considered separately.

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

The default smoke harness is inert and prints a plan. Offline plan validation uses `--mode=print-plan`, `--mode=validate-plan`, and `--mode=validate-evidence`. These modes never use network, database, provider, or migration calls. Future live execution requires explicit `--execute`, an exact HTTPS target, and a valid authorization file. Smoke authorization remains separate from Git push, image publication, migrations, provider dry-run, provider apply, deployment, or cutover.

The rehearsal matrix now covers the full offline preview surface: public/auth, course, billing, community, partner, and operations checks. Every check declares a stable key, description, authorization category, automation mode, network/auth/database-read/database-write/mutation/provider risk flags, prerequisites, expected result, required evidence fields, and stop conditions. Smoke/read-only approval never authorizes provider calls, writes, migrations, deployment, or cutover.

Safe evidence is schema-validated and rejects unknown keys, missing fields, invalid time ranges, authorization mismatches, invalid status transitions, non-immutable commit/image identities, and notes or references containing secrets, cookies, tokens, emails, provider/customer IDs, database URLs, or URLs with path/query components. Evidence validation is offline-only and does not perform live network, database, migration, or provider calls.

The staging-candidate report is read-only and tells the operator whether the current commit is ready to request live approvals. Repository readiness does not mean live authorization, and protected-only worktree dirt is tolerated only when it is explicitly excluded from the report.

## Fast safe sequence

Use this order for the staging gate:

1. Validate the current commit.
   - Prerequisites: clean intended paths, correct branch, approved commit.
   - Command: `git branch --show-current && git rev-parse HEAD && git status --short`
   - Evidence: branch name, commit SHA, no unexpected intended-path changes.
   - Success: the repo is on `feature/course-branding-and-preview` at the reviewed commit.
   - Stop: branch mismatch, dirty intended paths, or protected-path changes.
2. Create the release packet.
   - Prerequisites: exact commit, immutable image placeholder, canonical migration order, approval references.
   - Command: `pnpm preview:release:packet`
   - Evidence: serialized packet JSON.
   - Success: packet validates and includes only non-secret configuration names.
   - Stop: mutable image, migration drift, missing backup reference, or approval reuse.
3. Approve and push the branch.
   - Prerequisites: release packet is valid and approvals are isolated.
   - Command: `git push` only after separate push approval.
   - Evidence: remote branch update.
   - Success: branch is published without image or deployment side effects.
   - Stop: wrong branch, dirty working tree, or unauthorized push.
4. Publish the immutable image.
   - Prerequisites: push approval and image publication approval are separate.
   - Command: publish workflow with the exact 40-character commit SHA.
   - Evidence: immutable SHA-tagged image reference.
   - Success: image exists and matches the reviewed commit.
   - Stop: mutable tag, wrong commit, or missing publish approval.
5. Verify backup and migration authorization.
   - Prerequisites: backup evidence and target schema are present.
   - Command: preflight/authorization review only.
   - Evidence: backup reference, schema, migration order, operator, maintenance window.
   - Success: migration execution is explicitly authorized and separate from deploy/image approvals.
   - Stop: missing backup, drifted migration order, or approval reuse.
6. Run the exact reviewed migrations.
   - Prerequisites: migration approval, backup evidence, and maintenance window.
   - Command: the reviewed migration runner for the approved environment.
   - Evidence: migration logs and applied migration order.
   - Success: all ten reviewed migrations complete in order.
   - Stop: error, drift, or any destructive rollback attempt.
7. Deploy the exact image.
   - Prerequisites: image publication approval and deployment approval are separate.
   - Command: deployment workflow for the immutable image reference.
   - Evidence: deployment record and image digest.
   - Success: preview runs the reviewed immutable image.
   - Stop: mutable image, wrong target, or deployment without approval.
8. Run authorized read-only checks first.
   - Prerequisites: smoke verification approval only.
   - Command: `pnpm preview:smoke:plan`
   - Evidence: rehearsal matrix and safe evidence output.
   - Success: read-only checks pass without writes, provider calls, or migrations.
   - Stop: any provider call, write path, or approval mismatch.
9. Run separately approved write/provider checks.
   - Prerequisites: exact provider/billing/community/partner approvals.
   - Command: approval-specific live workflows only.
   - Evidence: operator references, approval references, and operation logs.
   - Success: only the explicitly approved write/provider checks execute.
   - Stop: read-only approval reused for writes, provider calls, or deployment.
10. Collect evidence.
   - Prerequisites: checks complete or are blocked for a recorded reason.
   - Command: repository evidence validation only.
   - Evidence: check key, times, status, safe status, operator, approval reference, artifact digest.
   - Success: evidence validates and contains no secrets.
   - Stop: malformed evidence, unsafe notes, or missing approval references.
11. Rehearse rollback.
   - Prerequisites: immutable previous image, backup reference, and rollback approval.
   - Command: `pnpm preview:rollback:plan`
   - Evidence: rollback plan plus rollback evidence.
   - Success: application rollback, frozen writes, and webhook preservation are proven offline.
   - Stop: any destructive command, data-loss ambiguity, or missing backup.
12. Stop before production cutover.
   - Prerequisites: staging evidence exists, but production cutover is not approved.
   - Command: none.
   - Evidence: explicit pending cutover state.
   - Success: work stops with production still untouched.
   - Stop: any attempt to treat staging evidence as production authorization.

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
