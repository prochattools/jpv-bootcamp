# JPV Bootcamp Preview Release Readiness

## Current repository reconciliation — 2026-08-23

- **Working branch:** `feature/course-branding-and-preview`; starting committed tip `ae8c886d125200d94a8ee7aec005b6226a1304e0`.
- **Repository gate:** after the A6 authenticated-gate contract was added, `pnpm test:release` passed `172/172`; the release manifest contains 173 entries including one staging-only conditional gate; focused browser checks passed `60/60`; full browser E2E passed `148/148` with 60 declared skips. The shared `#A89A80` contrast failures are corrected.
- **Code cleanup:** removed the tracked sponsored-claim `.bak`; the current page remains the only supported implementation.
- **Migration boundary:** the release-lead verified sanitized staging position is 36/36 Payload migrations applied with pending `[]`; no migration operation was performed by this pass. The source registry and current read-only workflow agree with that state.
- **Evidence distinction:** registration inventory is not applied database state; the 36/36 position is the separately supplied sanitized staging snapshot, not evidence that the dirty feature worktree is deployed. The general `pnpm staging:migration-status` adapter remains read-only and evidence-gated.
- **External state:** exact-SHA staging deployment, provider verification, production deployment, production migration, and cutover approval were not performed or reverified by this pass. Keep the final status `NO-GO` until those separate gates have fresh evidence at the final SHA.
- **Cutover procedure:** `docs/release/FUTURE_BRANCH_CUTOVER_PLAN.md`.
- **Phase 9.5 current truth:** `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md`.
- **Phase 9.5 backlog:** `docs/release/PHASE_9_5_FINAL_IMPLEMENTATION_BACKLOG_2026-08-23.md`.
- **Rooms feature candidate — 2026-08-30:** isolated branch `feature/member-portal-rooms`; `pnpm test:release` passed `174/174`. This is local/CI validation only and does not constitute staging or production evidence.

## Historical staging checkpoint — 2026-08-19 (STAGING MIGRATION COMPLETE)

This section records the 2026-08-19 historical checkpoint. At that checkpoint, all staging migration and acceptance gates were reported closed; this is not current-live evidence. The Phase 9.5 current-truth document is authoritative for the present state.

- **Status:** `STAGING MIGRATION COMPLETE`
- **Branch:** `feature/course-branding-and-preview`
- **Deployed SHA:** `abf43893dc3f9980cc8eadc997cd7935e86e614f`
- **Deploy run:** `32352382852`
- **Staging app:** `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU`
- **Database:** `jpvbootcamp`, schema `jpvbootcamp_staging`
- **`DEPLOYMENT_ENV`:** `staging` confirmed in running container
- **Payload migrations:** 35/35 applied (expanded from 29 to 35 to include migrations 30–35)
- **Legacy import:** 935/935 operations applied; 2 historical failed ledger attempts superseded/audit-history only
- **Members:** 51 total — 12 active (`emailVerifiedAt` set on all), 39 blocked, 0 active without `emailVerifiedAt`
- **Login:** `westhoek@hotmail.com` verified on staging
- **Email:** staging Resend delivery confirmed, ID `3affb3ee-38ad-4e6e-9fe1-55d202712b8c`
- **Media:** public 24/24, private 25/25
- **Lesson resources:** 25/25 published
- **Protected download:** anonymous → 404 ✓; authenticated entitled member → 200 + content ✓
- **Playwright staging:** 84 passed / 0 failed
- **Admin responsive:** 14/14
- **Migration contract test:** PASS
- **Production migration / cutover:** NOT performed, NOT authorized. Production `jpvbootcamp.com` routing was manually restored after an unrelated incident; no production schema, deployment, or cutover is authorized here.
- **Next gated step:** Production migration and cutover planning remain a separate, independently gated process.

---

## Historical staging-closure checkpoint — 2026-08-08 (superseded)

> The checkpoint below describes the pre-migration state as of 2026-08-08. It is preserved as audit history. The STAGING MIGRATION COMPLETE section above is the authoritative current state.

- **ONLY PERMITTED OPERATIONAL LANE:** `feature/course-branding-and-preview` → `https://preview.jpvbootcamp.com` → Dokploy `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU` → PostgreSQL `10.0.2.4:5433`, database `jpvbootcamp`, schema `jpvbootcamp_staging`.
- **CURRENT FEATURE TIP (historical):** SHA `9c045fa5a5c327014c20fe9377f7d5368b550573` at the 2026-08-08 checkpoint; current deployed tip is `abf43893dc3f9980cc8eadc997cd7935e86e614f`.
- **LOCALLY VERIFIED CONTRACT:** the agreed launch-scope repository implementation and account-action hardening are complete in source; the release manifest contains `164/164` required gates and the staging-only invariant contains `52/52` checks.
- **LIVE STAGING BASELINE (historical):** preview workflow `30853006495` at SHA `9c045fa5a5c327014c20fe9377f7d5368b550573`; superseded by deploy run `32352382852` at `abf43893dc3f9980cc8eadc997cd7935e86e614f`.
- **MEDIA PERSISTENCE:** verified via disposable fixture upload, redeployment survival, and Payload API deletion; named staging volume `jpv-bootcamp-preview-media` active.
- **AUTHORITATIVE PRE-APPLY EVIDENCE (historical):** guarded read-only plan run `31215369413` at `9e068cc8b0a5ec9573732fee3a78bed9995787a6` returned `plan_ok`: migration-29 solely missing, zero unexpected/duplicate/malformed Payload records, Prisma healthy. This evidence is superseded by applied state: 35/35 migrations now confirmed applied.
- **EXTERNAL ACTION (historical):** all gates now closed; see STAGING MIGRATION COMPLETE section above.

This runbook separates repository changes, image publication, Payload migrations, Prisma startup behavior, provider email delivery, preview deployment, and smoke verification into independent approval categories.

## Scope and safety boundary

The preview release path must use the reviewed feature branch and an exact commit. Approval for one operation never authorizes another.

Current operator branch: `feature/course-branding-and-preview`.
Verify the exact branch tip with `git log --oneline -1` before operator action.

**Current migration truth — Phase 9.5:** the release-lead verified sanitized staging position is 36/36 Payload migrations applied with pending `[]`, ending at `20260820_000000_live_session_space`. No migration operation was performed by this reconciliation. The raw timestamped artifact and exact-SHA deployment identity remain separate evidence requirements.

`pnpm staging:payload-migration-plan -- --current-state=true` is the current **read-only post-apply state verifier**: it expects all 36 registered Payload migrations applied and no pending batch. The closed 35→36 pre-apply/apply/rollback path remains separately guarded and non-current; no apply is authorized by this document.

Migration apply requires five dynamic operator values in addition to fixed target flags: `expected-hostname`, `operator-id`, `backup-evidence-id`, `maintenance-window-id`, and `rollback-owner`. Any schema write requires exact target authorization, backup evidence, a maintenance window, and rollback ownership.

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

**Outcome (2026-08-19):** `STAGING MIGRATION COMPLETE` — all 35 Payload migrations applied to `jpvbootcamp_staging`, SHA `abf43893dc3f9980cc8eadc997cd7935e86e614f` deployed, Playwright 84/0, admin-responsive 14/14, 935/935 legacy operations applied, 25/25 resources published, email delivered. Production migration is NOT authorized.

**Technical staging status (2026-08-19):** `STAGING MIGRATION AND ACCEPTANCE COMPLETE`

**Repository-owned staging operations status (2026-08-19):** `ALL STAGING GATES CLOSED — PRODUCTION CUTOVER SEPARATELY GATED`

**Decision-readiness:** `STAGING COMPLETE — production migration requires separate gated approval`

> **Historical status lines (superseded 2026-08-19):** Prior outcome was `LAUNCH-SCOPE REPOSITORY IMPLEMENTATION COMPLETE — FINAL PRE-MIGRATION CLOSURE IN PROGRESS`; prior technical status was `ACCEPTANCE PENDING EXTERNAL ACTION`; prior operations status was `PRE-APPLY EVIDENCE CLEAN — FINAL EXACT-SHA PLAN AND MIGRATION AUTHORIZATION PENDING`; prior decision-readiness was `DECISION-READY, EXTERNAL APPROVALS PENDING`.

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

- `pnpm test:release` passed `172/172`; the release manifest contains 173 entries including the A6 authenticated-gate contract and one staging-only conditional gate; the default run also includes the account-action hardening-status guard (2026-08-03), staging migration plan workflow contract (2026-08-05), unified dispatchable migration plan job (2026-08-05), environment configurator dry-run/apply guard test (2026-08-06), portal admin source structure and behavioral contract verification (2026-08-25), and support requester phone migration safety coverage (2026-08-26)
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
- `pnpm exec pnpm audit --prod --audit-level high --ignore-registry-errors` previously passed the high-severity gate; the last verified residual advisory baseline was `3 moderate` with no high/critical production advisory. The final push CI must re-run this gate; do not infer current registry state from this historical note alone.
- `pnpm exec tsx scripts/no_legacy_learn_namespace.test.ts` passed
- no migration, deployment, provider, or push action occurred during this validation baseline

### Remaining release gates

| Gate | Current status | Evidence owner | Notes |
| --- | --- | --- | --- |
| Migration evidence and apply path | Current sanitized position: 36/36 applied, pending `[]`; exact-SHA artifact refresh required later | `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md`, `scripts/release/runStagingPayloadMigration.ts` | Current-state read-only gate expects 36 applied and no pending batch. Historical migration-29/pre-apply evidence remains audit-only. |
| Decision packets and owners | Ready for external approval review | `docs/decisions/`, `pnpm staging:decision-readiness` | Repository-owned decision records, owner assignments, dependency order, and rollback statements are now complete and internally validated. |
| Migration rehearsal and rollback ownership | Static rehearsal passed; disposable execution not yet run | `docs/client/MIGRATION_REHEARSAL_RUNBOOK.md`, `docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md` | Repository-owned static rehearsal and evidence are complete; localhost-only disposable execution stays opt-in and target-environment rehearsal remains gated. |
| Prisma migration target state | Staging operational supplied; fresh raw Prisma-health field not present in this local snapshot | Phase 9.5 current truth | Retain explicit Prisma-health evidence in the later exact-SHA sanitized packet; no migration operation is implied. |
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

### Preview Build and Deploy (`deploy-preview.yml`)

`.github/workflows/deploy-preview.yml` is the single unified dispatcher for three mutually exclusive operations.

**Push path (`validate-only`):** Runs on `feature/course-branding-and-preview` pushes when the head commit message does NOT contain `[migration-plan-only]`. Validates, builds, and tests only. Does NOT publish an image, call GHCR, trigger Dokploy, deploy, or run migrations. This ensures ordinary development pushes are safe by construction — the only thing a push can do is fail validation.

**Manual dispatch path (`deploy-preview`):** Triggered by `workflow_dispatch` with `operation=deploy-preview`. Requires `expected_sha` (full 40-char SHA matching the current remote feature tip) and `confirmation=deploy-staging-feature-tip`. Checks out the exact current remote tip, verifies the SHA matches, then builds, publishes to GHCR, deploys to Dokploy staging, and runs the authenticated admin responsive gate. All Docker actions are SHA-pinned. The canonical Dokploy allow-list (`clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU`) is enforced.

**Manual dispatch path (`read-only-migration-plan`):** Triggered by `workflow_dispatch` with `operation=read-only-migration-plan`. Runs a read-only Payload migration plan against staging over Tailscale. Requires `operation`, `expected_sha` (40-char SHA), and `confirmation=run-read-only-staging-payload-migration-plan`. The `read-only-plan` job uses the `staging-migration-plan` environment, job-level `contents: read` only, non-cancelling concurrency, infrastructure preflight (zero-reviewer solo-operator environment, branch policy, variable, and secret-name verification), SHA-pinned `tailscale/github-action`, port `5433`, mode-600 temp file with trap deletion, and sanitized artifact only. It must not execute Docker, GHCR, Dokploy, publication, Prisma, migration apply/down, provider, or smoke steps. The `staging-migration-plan` environment operates in solo-operator mode: zero required reviewers, zero wait timer, custom branch policy for `feature/course-branding-and-preview` only, `PLAN_READY_FOR_DISPATCH=true`, and `SOLO_OPERATOR_MODE=true`.

Commits with `[migration-plan-only]` in the message suppress the push-triggered validate job so a migration-plan dispatch can be the sole authorized action for that tip.

The standalone `staging-payload-migration-plan.yml` has been removed; all capability is now in `deploy-preview.yml`.

### Publish Preview Image

`.github/workflows/publish-preview-image.yml` is named `Publish Preview Image`. Manual publication runs by `workflow_dispatch`, requires a full `commit_sha`, a target environment, a confirmation phrase, and a reproducible `source_date`, checks out exactly that SHA, verifies `git rev-parse HEAD`, and publishes an immutable SHA-tagged image such as:

```text
ghcr.io/<repository>:<full-commit-sha>
```

The workflow uses the `preview-image-publish` GitHub environment, `contents: read`, and `packages: write`. It must not publish `latest`, deploy, call Dokploy, run migrations, call a provider, or perform live smoke checks. All third-party actions are SHA-pinned. Dispatching from a branch other than `feature/course-branding-and-preview` is rejected.

A Git push to the feature branch triggers validation-only (no image publication). Image publication requires a separate explicit `workflow_dispatch` via `publish-preview-image.yml`. Image publication does not authorize deployment. Image publication does not authorize Payload migrations, provider dry-run, provider apply, or smoke verification.

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

- Git push (validation-only, no image publication);
- image publication (separate manual dispatch);
- Payload migration;
- provider dry-run;
- provider apply;
- preview deployment (manual dispatch only);
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

**Registered migration order (src/lib/payloadMigrationRegistry.ts):**

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

Migration 29 (`20260804_050000_member_account_action_reservations`) adds four nullable reservation columns, two `NOT VALID` check constraints, and two partial indexes to `payload_member_verification_tokens`. The up migration adds constraints with `NOT VALID` (no full-table scan at add time) and then validates them with `VALIDATE CONSTRAINT`, which scans existing rows under `ShareUpdateExclusiveLock` (reduced lock, concurrent reads allowed). The down migration drops those constraints. Nullable columns need no row backfill. Normal non-concurrent index builds block writes while building. `ALTER TABLE ... ADD COLUMN` (nullable, no default) requires a brief but non-trivial table lock to update the system catalog. Duration depends on table size and index build time; treat all timing estimates as estimates only, not guarantees. This migration is not non-blocking.

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

### Staging startup

`scripts/release/start-staging.sh` is the Docker CMD. It starts the standalone Next.js server after validating `DATABASE_URL` structurally: exact PostgreSQL protocol, host (`10.0.2.4`), port (`5433`), database (`jpvbootcamp`), and schema (`jpvbootcamp_staging`) are all required. Substring matching is not used; the URL is parsed structurally by Node.js.

It does not run Prisma or Payload migrations. It does not invoke database initialization or backup operations.

**Historical safety incident:** An alternate `database-deploy` startup mode previously existed and has been removed. `scripts/runtime/start-prod.sh` and `scripts/db/deploy-prod.sh` are deleted. The `STARTUP_MODE` and `DEPLOYMENT_ENV` environment variables are no longer used. These alternate targets remain forbidden and their removal is enforced by invariant tests.

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

### Payload migration authorization (historical — closed; non-operative)

> **Historical record only.** The generic template below authorized earlier migrations
> (`20260701_201500_member_email_verification` and `20260702_001500_member_account_action_purposes`)
> in a prior release cycle. It is **not** the current operative authorization packet.
> There is no current operative migration-29 packet. The current migration
> position is 36/36 applied with pending `[]`; see the Phase 9.5 current-truth
> document. This entire section is retained for audit provenance only.
> Do not use the template below to authorize any live operation.

<details>
<summary>Historical template (collapsed — non-operative)</summary>

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

</details>

### Payload migration 29 authorization (historical — closed; non-operative)

Migration 29 (`20260804_050000_member_account_action_reservations`) adds reservation/finalization columns and indexes to `payload_member_verification_tokens`.

The guarded runner (`pnpm staging:payload-migration-plan` / `pnpm staging:payload-migration-apply` / `pnpm staging:payload-migration-rollback-plan`) enforces:
- Branch must be `feature/course-branding-and-preview`
- `--expected-commit` is supplied at runtime as the full 40-character HEAD SHA; the database name is **fixed** to `jpvbootcamp` in source — it is not operator-supplied; no source-code constant is changed per deployment
- `--expected-commit` must equal `git rev-parse HEAD` at execution time
- `--environment=staging` is required (fixed: `staging`)
- `--target-id=jpvbootcamp-staging` is required (fixed: `jpvbootcamp-staging`)
- `--expected-schema=jpvbootcamp_staging` is required (fixed: `jpvbootcamp_staging`)
- `--expected-hostname=<staging-db-host>` must match the configured hostname exactly; production markers (`prod`, `production`, `live`, `main`) are rejected as whole hostname-label tokens, not arbitrary substrings — a hostname such as `staging-domain.internal` is never falsely rejected
- `--expected-database=jpvbootcamp` — the runner enforces all three: `expectedDatabase === 'jpvbootcamp'`, `actualDatabase === 'jpvbootcamp'`, and `actualDatabase === expectedDatabase`; any other database name is rejected even if the operator-supplied argument matches it
- Exactly 28 Payload migrations applied before apply; exactly 29 after apply
- Only migration 29 may be missing at pre-apply; no unexpected records may exist
- All Prisma migrations must be present, applied, and healthy (no failed, in-progress, rolled-back, unexpected, duplicate, or missing)
- Any uncommitted change to a guarded operational path blocks plan, apply, **and rollback-plan**
- Protected residue (`.ai/**`, `.claude/**`, screenshots, logs, backups) does not block
- Exact apply confirmation value `apply_account_action_reservation_migration_to_jpvbootcamp_staging` required
- **Rollback-plan batch evidence:** the rollback-plan collects `payloadMigrationRecords` (name + batch for every applied row); it verifies that migration 29 is applied, that it is the sole entry in the highest-numbered batch, and that no later batch exists; a rollback-plan that cannot prove this evidence fails closed
- **Uncertain apply outcome:** if the apply command returns a non-zero exit code, a signal, or an execution error, the runner does **not** throw and does not recommend retry or rollback; instead it performs one read-only status collection and returns `APPLY_OUTCOME_UNCERTAIN` with non-secret state (applied count, missing/unexpected migrations, schema identity, Prisma health, whether migration 29 appears applied, and whether the status query itself succeeded); the operator must run `pnpm staging:payload-migration-plan` for a fresh read-only plan before any further action
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
Environment: staging (fixed)
Target ID: jpvbootcamp-staging (fixed)
Schema: jpvbootcamp_staging (fixed)
Database: jpvbootcamp (fixed — not operator-supplied; runner enforces expectedDatabase === actualDatabase === 'jpvbootcamp')
Expected hostname: <staging-db-host — non-secret identifier; no credentials; must be exact approved hostname>
Runner: pnpm staging:payload-migration-apply
Precondition: migration 29 missing, all Prisma migrations applied and healthy, no unexpected/duplicate/failed records
Worktree: all guarded paths must be clean; protected residue (.ai/**, .claude/**, screenshots, logs) is allowed
Batch evidence: rollback-plan verifies migration 29 is alone in the highest batch via payloadMigrationRecords
Uncertain apply outcome: if apply command exits non-zero/signal/error, runner returns APPLY_OUTCOME_UNCERTAIN and requires a fresh read-only plan; do not retry automatically; do not execute migrate:down without separate authorization
Backup and restore point: <confirmed evidence identifier>
Maintenance window: <time and duration>
Operator: <name>
Rollback owner: <name>
Rollback procedure: run pnpm staging:payload-migration-rollback-plan (read-only, verifies batch isolation, requires own confirmation); rollback execution is separately authorized

This does not authorize push, Dokploy redeployment, Prisma migrations, provider email, post-deployment smoke, production, or main.
```

### Prisma migration authorization (account-column rename)

`prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql` renames identity columns in the account table. It requires separate authorization from Payload migrations, image publication, provider delivery, and preview deployment. **Historical safety incident:** This migration previously referenced `database-deploy` startup via the deleted `scripts/db/deploy-prod.sh`; that alternate target remains forbidden.

```text
Authorize Prisma account-column rename migration only.
Migration: prisma/migrations/20260707_120000_rename_account_identity_columns/migration.sql
Commit/image: <exact value>
Environment: staging
Backup and restore point: <confirmed evidence>
Column rename scope confirmed: <yes/no>
Downstream query compatibility reviewed: <yes/no>
Maintenance window: <time>
Operator: <name>
Rollback owner: <name>

This does not authorize Payload migrations, push, provider delivery, preview deployment, or any other Prisma migrations beyond this file.
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
Branch: feature/course-branding-and-preview
Commit/image digest: <exact value>
Target: clients-jpv-bootcamp-app-tp9xrk (staging only)
Payload migration prerequisite: <status>
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

This does not authorize push, image publication, Payload migrations, Prisma migrations, provider apply, preview deployment, production deployment, or operations on main.
```
