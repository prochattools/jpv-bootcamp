# JPV Bootcamp Preview Release Readiness

## Current staging-closure checkpoint — 2026-08-04

- **IMPLEMENTED / LOCALLY VERIFIED:** core staging scope, Payload admin design, responsive behavior, focused design contract, Payload TypeScript, changed-path security scan, application build, and `pnpm test:release` (`166/166`).
- **STAGING VERIFIED (latest completed verification snapshot):** preview workflow `30853006495` concluded `success`; staging health reported exact SHA `9c045fa5a5c327014c20fe9377f7d5368b550573`; authenticated staging admin gate passed `14/14`. Earlier snapshots remain historical evidence only. For current live state: compare `git rev-parse HEAD` with `https://preview.jpvbootcamp.com/api/health`.
- **MEDIA PERSISTENCE:** verified via disposable fixture upload, redeployment survival, and Payload API deletion; named staging volume `jpv-bootcamp-preview-media` active.
- **TECHNICAL STATUS:** `STAGING TECHNICAL IMPLEMENTATION COMPLETE — ACCEPTANCE PENDING EXTERNAL ACTION`.
- **HARDENING STATUS:** `ACCOUNT-ACTION HARDENING IMPLEMENTED LOCALLY — STAGING MIGRATION AUTHORIZATION REQUIRED`; reservation/finalization is implemented in source and behaviorally tested, but the new schema is not applied or verified on shared staging.
- **EXTERNAL ACTION:** client content approval, approved provider evidence, approved migration execution, and formal staging sign-off remain separate.

This runbook separates repository changes, image publication, Payload migrations, Prisma startup behavior, provider email delivery, preview deployment, and smoke verification into independent approval categories.

## Scope and safety boundary

The preview release path must use the reviewed feature branch and an exact commit. Approval for one operation never authorizes another.

Current operator branch: `feature/course-branding-and-preview`.
Verify the exact branch tip with `git log --oneline -1` before operator action.

**No applied-database-state claim is made by this checkpoint.** The canonical 29-name Payload registry and the health endpoint expose application registration inventory, not evidence that those migrations were applied. The real `pnpm staging:migration-status` read-only CLI is implemented, guarded by explicit staging mode, expected-schema, and acknowledgement flags, but it was not run against staging during this work. An authorized operator must still capture read-only Payload and Prisma migration evidence before any apply decision. Any schema or legacy-domain write requires explicit target authorization, backup, and rollback ownership.

Legacy source intake now recognizes reviewed WordPress JSON root arrays and `items`, `posts`, or `lessons` arrays only when each non-empty export has meaningful type, content/title, and identity markers; bounded files are structurally parsed, while larger files retain streaming byte and SHA-256 evidence with record count unavailable. Generic RSS is not WordPress WXR: the reviewed WXR namespace, version, channel, and complete closing structure are required. No real source export was read and no real source import was executed.

Do not touch `main`.

Version 3.7 client plan: `docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_7.docx`
Version 3.5 codebase audit: `docs/V3_5_CODEBASE_ALIGNMENT_ASSESSMENT.md`
Front-end website go-live milestone: 22 July 2026
Client content/input due: Wednesday 15 July 2026, now past due as of Friday 17 July 2026
The front-end milestone is a delivery marker only and does not authorize migration execution.

Status update procedure: `docs/client/STATUS_UPDATE_PROCEDURE.md`

The protected local files `.graphifyignore` and `docs/HANDOFF_AUTH_BRANDING_STAGING_2026-06-30.md` are outside this runbook and must not be staged.

Static preflight automation is available via `pnpm staging:static-preflight`; it is local-only and does not authorize migrations, deployment, or live provider checks.

## Current repository-owned readiness snapshot

**Latest completed staging verification snapshot (2026-08-02):** SHA `c15cd578a953cd6b1dc8a3d4705350a52f7d0812`, preview workflow `30761713446`, conclusion `success`, exact-SHA staging health confirmed. Prior verified snapshot: SHA `3a6613498241c5dd71761c26c3b1e790764db1d5`, workflow `30756831212`, conclusion `success` (retained as historical anchor). The authoritative current branch tip is determined by `git rev-parse HEAD`; do not treat any hardcoded SHA as the immutable current tip.

**Outcome:** `ACCOUNT-ACTION HARDENING IMPLEMENTED LOCALLY — STAGING MIGRATION AUTHORIZATION REQUIRED` — durable reservation/finalization is implemented in source with behavioral concurrency evidence, while formal acceptance and shared-staging schema verification remain separately gated.

**Technical staging status:** `STAGING TECHNICAL IMPLEMENTATION COMPLETE — ACCEPTANCE PENDING EXTERNAL ACTION`

**Repository-owned staging operations status:** `LOCAL HARDENING COMPLETE — CONTROLLED STAGING MIGRATION APPROVAL REQUIRED`

**Decision-readiness command result:** `DECISION-READY, EXTERNAL APPROVALS PENDING`

### Completed launch-scoped implementation

- M0-01 through M0-09 are implemented on this branch.
- M1-01 through M1-06 are implemented on this branch.
- `M1-06` completed in state **B**:
  - `/portal/programme` remains an explicit preview because approved representative programme content is still missing.
  - `/portal/community` and discussion views use persisted read-only member views.
  - interactive community posting, replies, uploads, and moderation actions remain deferred.
- The programme-content acceptance and release-candidate packet is complete: the repository-owned contract, client intake template, non-publishable fixture, validation, acceptance-report, import-plan, approval-record, release-manifest, and preview guards are present and tested.
- M2-01 remains post-core and is not promoted by this packet.

### Deterministic local validation baseline

- `pnpm test:release` passed `166/166`, including the account-action hardening-status guard (2026-08-03)
- `pnpm test:e2e` Playwright execution: 188 collected, 148 passed, 40 skipped; four staging-only spec files not collected (admin-crud-staging, admin-responsive-staging, staging-smoke, stripe-webhook-staging)
- `pnpm test:release:full` passed
- `pnpm staging:static-preflight` passed
- `pnpm staging:decision-readiness` passed with `DECISION-READY, EXTERNAL APPROVALS PENDING`
- `pnpm staging:migration-preflight` passed
- `pnpm staging:migration-rehearsal` passed on a disposable localhost rehearsal schema: apply, idempotent rerun, scoped rollback, and reapply succeeded; preservation of unrelated or updated preexisting rows remains unproven because the rehearsal baseline was empty
- `pnpm staging:migration-rehearsal:evidence` passed and produced deterministic repository-only Markdown evidence
- `pnpm staging:provider-simulation` passed `10/10` with local mocked EMAIL, STRIPE, and PAYLOAD verification only
- `pnpm staging:smoke-plan` passed
- `pnpm staging:smoke-simulated` passed `5/5`; it is local simulated evidence only and not staging acceptance
- `pnpm release:evidence:dry-run` produced a deterministic repository-only summary
- `pnpm exec tsc --noEmit --pretty false --incremental false` passed
- `pnpm build` passed
- `pnpm exec prisma validate --schema=prisma/system.prisma` passed
- `pnpm exec prisma validate --schema=prisma/schema.prisma` passed
- `pnpm exec pnpm audit --prod --audit-level high --ignore-registry-errors` passed the high-severity gate; remaining advisories are `3 moderate` (no high-severity issues)
- `pnpm exec tsx scripts/no_legacy_learn_namespace.test.ts` passed
- no migration, deployment, provider, or push action occurred during this validation baseline

### Remaining release gates

| Gate | Current status | Evidence owner | Notes |
| --- | --- | --- | --- |
| Migration evidence and apply path | Blocked | `docs/client/MIGRATION_APPROVAL_PACKET.md`, `docs/client/MIGRATION_APPROVAL_STATUS.md` | Applied state is unverified; authorized read-only evidence is required before any separately authorized write. |
| Decision packets and owners | Ready for external approval review | `docs/decisions/`, `pnpm staging:decision-readiness` | Repository-owned decision records, owner assignments, dependency order, and rollback statements are now complete and internally validated. |
| Migration rehearsal and rollback ownership | Static rehearsal passed; disposable execution not yet run | `docs/client/MIGRATION_REHEARSAL_RUNBOOK.md`, `docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md` | Repository-owned static rehearsal and evidence are complete; localhost-only disposable execution stays opt-in and target-environment rehearsal remains gated. |
| Support-request migration target state | Blocked / unverified | `prisma/migrations/20260712_151700_add_support_requests/migration.sql` | The additive migration exists in the repository, but its applied state is not established by repository or health evidence. |
| Provider/email verification | Repository simulation passed; live verification not executed | `docs/client/PROVIDER_EMAIL_READINESS.md`, `docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md` | Mocked/local provider simulation is repository-owned and complete; live verification still requires credentials and operator evidence. |
| Stripe checkout/webhook/billing portal live verification | Repository simulation passed; live verification not executed | `docs/client/PROVIDER_EMAIL_READINESS.md` | Local validation and provider simulation passed safely; live verification is separate. |
| Representative programme and public-copy approval | Blocked | `docs/client/FRONTEND_CONTENT_INTAKE_CHECKLIST.md`, `docs/client/FRONTEND_COPY_APPROVAL_PACKET.md` | Programme remains preview-only until approved content exists. |
| Staging smoke | Local simulated smoke passed; actual staging smoke not executed | `docs/client/STAGING_SMOKE_CHECKLIST.md`, `docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md` | Local simulated smoke is repository-only evidence; actual staging smoke still requires the approved deployment target and operator evidence. |
| Formal go/no-go | Not executed | operator review process | Must follow staging, provider, content, and migration evidence review. |
| Production operation | Blocked | this runbook plus client evidence docs | Production is blocked until every independent gate is complete. |

### Repository-owned staging operations contract

The repository-owned preparation contract is complete and validated locally. Operators now have:

- migration runbook: `docs/release/SUPPORT_REQUESTS_MIGRATION_RUNBOOK.md`
- rollback evidence checklist: `docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md`
- provider verification runbook: `docs/release/PROVIDER_VERIFICATION_RUNBOOK.md`
- go / no-go checklist: `docs/release/GO_NO_GO_CHECKLIST.md`
- decision manifest and readiness runner: `scripts/release/decisionManifest.ts`, `pnpm staging:decision-readiness`
- decision packets:
  - `docs/decisions/PROGRAMME_CONTENT_PUBLICATION_APPROVAL.md`
  - `docs/decisions/TABLE_PLAN_TO_FREE_APPROVAL.md`
  - `docs/decisions/ACCOUNT_COLUMN_RENAME_APPROVAL.md`
  - `docs/decisions/STAGING_MIGRATION_APPROVAL.md`
  - `docs/decisions/ROLLBACK_READINESS_APPROVAL.md`
  - `docs/decisions/PROVIDER_VERIFICATION_APPROVAL.md`
  - `docs/decisions/STAGING_SMOKE_APPROVAL.md`
  - `docs/decisions/CORE_GO_LIVE_DECISION.md`
- programme content intake template: `docs/client/PROGRAMME_CONTENT_INTAKE_TEMPLATE.md`
- programme approval record template: `docs/client/PROGRAMME_CONTENT_APPROVAL_RECORD.md`
- programme content validation: `pnpm content:programme:validate -- <repository-relative-json-path>`
- programme content acceptance report: `pnpm content:programme:acceptance -- <repository-relative-json-path>`
- programme content import plan: `pnpm content:programme:import-plan -- <repository-relative-json-path>`
- migration preflight command: `pnpm staging:migration-preflight`
- migration rehearsal command: `pnpm staging:migration-rehearsal`
- migration rehearsal evidence: `pnpm staging:migration-rehearsal:evidence`
- provider simulation command: `pnpm staging:provider-simulation`
- staging smoke plan command: `pnpm staging:smoke-plan`
- local simulated smoke command: `pnpm staging:smoke-simulated`
- release evidence dry run: `pnpm release:evidence:dry-run`

These assets are repository-ready only. They do not mark migration applied, provider verified, staging passed, or go-live approved.

### Required operator sequence before staging

1. confirm the exact approved branch tip with `git log --oneline -1`;
2. run `pnpm staging:decision-readiness`, `pnpm staging:migration-preflight`, `pnpm staging:smoke-plan`, and `pnpm release:evidence:dry-run` at that exact tip;
3. run `pnpm staging:migration-rehearsal`, `pnpm staging:migration-rehearsal:evidence`, `pnpm staging:provider-simulation`, and `pnpm staging:smoke-simulated` at that exact tip;
4. convert the approved representative programme package into the canonical JSON contract and run `pnpm content:programme:validate`, `pnpm content:programme:acceptance`, and `pnpm content:programme:import-plan`;
5. confirm client content/public-copy decisions, especially representative programme content;
6. confirm migration approval, rollback owner, and exact apply path;
7. execute the manual staging smoke checklist and capture evidence;
8. execute provider/email verification and capture evidence;
9. review the evidence packet and hold the formal go/no-go.

### Production blockers

- support-request migration target state remains unverified pending authorized read-only evidence;
- table-plan-to-Free mapping approval remains pending;
- account-column rename approval remains pending;
- staging migration approval, rollback owner confirmation, and formal go/no-go approval remain pending;
- representative programme content is still blocked until the client supplies a complete approved package and it passes the repository intake, acceptance, and import-plan checks; the repository is ready to accept that package;
- provider/email verification is still pending;
- staging smoke is still pending;
- formal go/no-go is still pending.

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

The canonical reviewed migration inventory is now unified across policy, manifest, preflight, shadow evidence, and validation. It lists the eleven reviewed Payload migrations in exact order, ending with `20260707_130000_remove_table_plan_from_payload_enums`, but execution remains pending until an explicit migration authorization is granted.

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

- Staging preview remains healthy with `application-only`/Docker runtime, eleven reviewed Payload migrations in inventory, and email readiness `readyForApply: true`.
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
- The existing Dokploy staging app `JPV Bootcamp | Payload CMS` was redeployed with `ghcr.io/prochattools/jpv-bootcamp:feature-course-branding-and-preview`; `/api/health/deployment` returned 200 JSON with Docker/application-only runtime, eleven reviewed Payload migrations in inventory, and email readiness `readyForApply: true`.
- Live side-effect acceptance remains a controlled-operator step:
  - `lastLoginAt` needs one normal member login on staging, followed by sanitized metadata inspection;
  - password-changed security-event and confirmation-email verification need separate authorization for another password-reset email/reset cycle before any provider email is requested or sent.

**Admin logout boundary acceptance update (6 July 2026):**

- The existing Dokploy staging app was redeployed from `feature/course-branding-and-preview` for commits `742d7b2d18b3cda3b07820b0a20484418bfae138` and `3473e25fbe512963aae97fd9d505048d15a41c89`.
- Staging health returned HTTP 200 with Docker/application-only runtime, eleven reviewed Payload migrations in inventory, and email readiness `readyForApply: true`.
- Live route checks showed both GET and POST `/admin/logout` return a public HTTPS preview admin-login redirect with `loggedOut=1` and no internal origin.
- Cookie-clearing evidence showed Payload-prefixed auth cookies are expired while unrelated cookies are not targeted.
- Operator acceptance confirms the member-to-admin unauthorized boundary no longer traps the user in an unauthorized loop, the prior `http://0.0.0.0:3000` redirect regression is fixed, and admin login works after logout.
- No regression to member portal login was reported.
- Sanitized read-only metadata for `i***@yeshua.academy` confirms exactly one active, verified, unlocked member row with login attempts below threshold, but `lastLoginAt` is still not accepted after the hardening deployment. One fresh successful member login followed by sanitized inspection remains required for that Phase 6 side-effect.

**Member last-login acceptance update (6 July 2026):**

- Source commit `e6e59eebae42f8269726f28501db88bea7932cc7` hardens the accepted member-session metadata path by using the Payload database `updateOne` adapter for `lastLoginAt` after member eligibility succeeds.
- Staging health returned HTTP 200 with Docker/application-only runtime, eleven reviewed Payload migrations in inventory, and email readiness `readyForApply: true`.
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

**Historical snapshot claim (not independently reverified by this checkpoint):** the codebase at `eb03a08` registered 16 Payload migrations; the registry now contains 29. Current applied state must come from the authorized read-only status path (`pnpm staging:payload-migration-plan -- --expected-commit=<HEAD-sha> ...`) before any write authorization is issued. The plan command requires the full 40-character HEAD SHA at runtime; no source-code constant needs changing between deployments.

**Registered migration order (src/migrations/migrationRegistry.ts):**

1. `20260620_213328`
2. `20260621_194424_course_system_phase1`
3. `20260622_093852_course_private_media`
4. `20260627_010700_structured_community_attachments`
5. `20260630_100730_affiliate_reporting`
6. `20260630_190000_payload_preferences_id_constraint`
7. `20260701_201500_member_email_verification`
8. `20260702_001500_member_account_action_purposes`
9. `20260703_000000_partner_affiliate_operations`
10. `20260704_090000_partner_schema_reconciliation`
11. `20260707_130000_remove_table_plan_from_payload_enums`
12. `20260718_103726_membership_support_schema`
13. `20260718_000000_live_sessions`
14. `20260718_110000_bunny_videos`
15. `20260719_150000_subscription_schema_cols`
16. `20260720_000000_locked_docs_rels_new_collections`
17. `20260720_010000_payload_community_posts`
18. `20260720_020000_payload_community_topics`
19. `20260720_030000_payload_moderation`
20. `20260720_040000_payload_community_notifications`
21. `20260720_050000_payload_partner_referral_codes`
22. `20260720_060000_payload_entitlement_overrides`
23. `20260721_000000_payload_branding_and_preview_config`
24. `20260721_010000_payload_course_branding`
25. `20260721_020000_payload_course_programme`
26. `20260721_030000_payload_live_session_branding`
27. `20260721_040000_payload_community_branding`
28. `20260721_050000_payload_email_branding`
29. `20260804_050000_member_account_action_reservations`

Migration 29 (`20260804_050000_member_account_action_reservations`) adds four nullable reservation columns, two `NOT VALID` check constraints, and two partial indexes to `payload_member_verification_tokens`. `NOT VALID` avoids full-table validation at add time; `VALIDATE CONSTRAINT` scans under `ShareUpdateExclusiveLock` in the down migration. Index builds block concurrent writes for the duration of the build. `ALTER TABLE ... ADD COLUMN` (nullable, no default) requires a brief but non-trivial table lock to update the system catalog. Duration depends on table size and index build time; treat all timing estimates as estimates only, not guarantees. This migration is not non-blocking.

Verify exact applied count against staging DB before any apply operation. Payload migrations are separate from Prisma migration/startup behavior and are not applied by `scripts/db/deploy-prod.sh` or by `STARTUP_MODE=database-deploy`.

## Environment lane isolation

**Build-time vs. runtime split:** `NEXT_PUBLIC_*` variables are embedded into the
Docker image during build and propagate to the browser; changing them requires
a new image build. All other variables (`DATABASE_URL`, `PAYLOAD_SECRET`,
`STRIPE_SECRET_KEY_*`, `RESEND_API_KEY`, `BUNNY_*`, etc.) are runtime-only and
injected from the Dokploy deployment platform at container start.

**Production lane (`main` branch):** deploys with production `NEXT_PUBLIC_*`
build args (canonical domain `jpvbootcamp.com`), production database
(`jpvbootcamp` schema), Stripe LIVE keys, and production secrets.
`STRIPE_ENV=live`. Production webhook: `jpvbootcamp.com/api/webhook/stripe`.

**Staging lane (`feature/course-branding-and-preview` branch):** deploys with
staging `NEXT_PUBLIC_*` build args (preview domain `preview.jpvbootcamp.com`),
isolated staging database (`jpvbootcamp_staging` schema), Stripe TEST keys,
staging Resend domain, and staging-only secrets. `STRIPE_ENV=test`. Staging
webhook: `preview.jpvbootcamp.com/api/webhook/stripe`. Production webhook must
be disabled while staging is active.

The two lanes must never share a database schema or exchange secrets.
`DEPLOYMENT_ENV` and `STARTUP_MODE` control Prisma migration execution at
startup; `DEPLOYMENT_ENV=staging` restricts migrations to the staging schema.

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
   - Success: all 29 reviewed migrations complete in order.
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

### Payload migration 29 authorization (account_action_reservation columns)

Migration 29 (`20260804_050000_member_account_action_reservations`) adds reservation/finalization columns and indexes to `payload_member_verification_tokens`.

The guarded runner (`pnpm staging:payload-migration-plan` / `pnpm staging:payload-migration-apply` / `pnpm staging:payload-migration-rollback-plan`) enforces:
- Branch must be `feature/course-branding-and-preview`
- `--expected-commit` is supplied at runtime as the full 40-character HEAD SHA; no source-code constant is changed per deployment
- `--expected-commit` must equal `git rev-parse HEAD` at execution time
- `--environment=staging` is required
- `--target-id=jpvbootcamp-staging` is required
- `--expected-schema=jpvbootcamp_staging` is required
- `--expected-hostname=<staging-db-host>` must match the configured hostname (production markers rejected; hostname alone is not proof of identity — schema and database name are also checked)
- `--expected-database=jpvbootcamp` must match the configured database name
- Exactly 28 Payload migrations applied before apply; exactly 29 after apply
- Only migration 29 may be missing at pre-apply; no unexpected records may exist
- All Prisma migrations must be present, applied, and healthy (no failed, in-progress, rolled-back, unexpected, duplicate, or missing)
- Any uncommitted change to a guarded operational path blocks plan and apply
- Protected residue (`.ai/**`, `.claude/**`, screenshots, logs, backups) does not block
- Exact apply confirmation value `apply_account_action_reservation_migration_to_jpvbootcamp_staging` required
- Rollback requires a separate read-only plan (`pnpm staging:payload-migration-rollback-plan`) with its own confirmation `plan_rollback_account_action_reservation_from_jpvbootcamp_staging`
- Rollback execution requires separate authorization; the rollback plan is read-only and does not invoke `migrate:down`

Plan command:

```sh
pnpm staging:payload-migration-plan -- \
  --expected-commit=<full-40-char-HEAD-sha> \
  --environment=staging \
  --target-id=jpvbootcamp-staging \
  --expected-schema=jpvbootcamp_staging \
  --expected-hostname=<staging-db-host> \
  --expected-database=jpvbootcamp
```

Apply command:

```sh
pnpm staging:payload-migration-apply -- \
  --expected-commit=<full-40-char-HEAD-sha> \
  --environment=staging \
  --target-id=jpvbootcamp-staging \
  --expected-schema=jpvbootcamp_staging \
  --expected-hostname=<staging-db-host> \
  --expected-database=jpvbootcamp \
  --operator-id=<id> \
  --backup-evidence-id=<id> \
  --maintenance-window-id=<id> \
  --rollback-owner=<id> \
  --confirmation=apply_account_action_reservation_migration_to_jpvbootcamp_staging
```

Rollback plan command (read-only, does NOT execute migrate:down):

```sh
pnpm staging:payload-migration-rollback-plan -- \
  --expected-commit=<full-40-char-HEAD-sha> \
  --environment=staging \
  --target-id=jpvbootcamp-staging \
  --expected-schema=jpvbootcamp_staging \
  --expected-hostname=<staging-db-host> \
  --expected-database=jpvbootcamp \
  --operator-id=<id> \
  --backup-evidence-id=<id> \
  --maintenance-window-id=<id> \
  --rollback-owner=<id> \
  --confirmation=plan_rollback_account_action_reservation_from_jpvbootcamp_staging
```

Authorization template:

```text
Authorize Payload migration 29 only.
Migration: 20260804_050000_member_account_action_reservations
Expected commit: <full current authorized SHA — must equal git rev-parse HEAD at execution time>
Environment: staging
Target ID: jpvbootcamp-staging
Schema: jpvbootcamp_staging
Database: jpvbootcamp
Expected hostname: <staging-db-host — non-secret identifier, no credentials>
Runner: pnpm staging:payload-migration-apply
Precondition: 28 Payload migrations applied, migration 29 missing, all Prisma migrations applied and healthy, no unexpected/duplicate/failed records
Backup and restore point: <confirmed evidence identifier>
Maintenance window: <time and duration>
Operator: <name>
Rollback owner: <name>
Rollback procedure: requires separate rollback-plan authorization; run pnpm staging:payload-migration-rollback-plan first; rollback execution is separately authorized

This does not authorize push, Dokploy redeployment, STARTUP_MODE=database-deploy, Prisma migrations, provider email, post-deployment smoke, production, or main.
```

### Prisma migration authorization (account-column rename)

`prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql` renames identity columns in the account table. This migration runs inside `database-deploy` startup via `scripts/db/deploy-prod.sh`. It requires separate authorization from Payload migrations, image publication, provider delivery, and preview deployment.

```text
Authorize Prisma account-column rename migration only.
Migration: prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql
Commit/image: <exact value>
Environment: <preview|staging|production>
STARTUP_MODE: database-deploy
DEPLOYMENT_ENV: <exact environment>
Backup and restore point: <confirmed evidence>
Column rename scope confirmed: <yes/no>
Downstream query compatibility reviewed: <yes/no>
Maintenance window: <time>
Operator: <name>
Rollback owner: <name>

This does not authorize Payload migrations, push, provider delivery, preview deployment, or any other Prisma migrations beyond this file.
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
