# JPV Bootcamp — Production Readiness & Cutover Preparation Package

**Status:** PREPARATION ONLY — production is not authorized  
**Date:** 2026-08-23  
**Candidate branch:** `feature/course-branding-and-preview`  
**Candidate SHA:** `4853d63c6a006fd27ab66e365f29de9ade9472d8`

This document is the preparation source of truth for a future production
decision. It does not authorize a deployment, migration, provider mutation,
secret change, DNS change, or production data operation.

## 1. Current position

| Area | Evidence-based state | Authority boundary |
|---|---|---|
| Repository | Candidate SHA is locally verified and matches the feature remote | Current source evidence |
| CI | GitHub Actions run `32643645302` passed; deterministic release gate `164/164`; browser E2E passed with declared skips | Repository/CI evidence |
| Staging | Historical/frozen readiness package exists; exact-candidate deployment receipt and provider packet are not present in this repository | Historical evidence only until exact-SHA packet is attached |
| Migration registry | 36 canonical Payload registrations, ending `20260820_000000_live_session_space` | Source inventory only |
| Staging migration position | Supplied sanitized position: 36/36 applied, pending `[]` | No production inference permitted |
| Production | No current production identity, schema state, backup reference, provider evidence, or authorization is recorded | Blocked |

Phase 8 and Phase 9 are recorded as implementation-complete historical
milestones. Phase 9.5 remains the reconciliation/completion gate; “staging
complete” and a green CI result do not equal production authorization.

## 2. Environment reconciliation

### 2.1 Known staging lane

| Item | Staging value | Evidence status |
|---|---|---|
| Branch lane | `feature/course-branding-and-preview` | Workflow contract |
| URL | `https://preview.jpvbootcamp.com` | Historical/documented target |
| Dokploy app | `clients-jpv-bootcamp-app-tp9xrk` / `I_2Vukga3cc3ZhaG-mUzU` | Documented target; exact candidate receipt missing |
| Database | `jpvbootcamp`, schema `jpvbootcamp_staging`, host `10.0.2.4`, port `5433` | Staging contract; no connection performed |
| Image path | GHCR/Dokploy preview path | Pipeline contract; current digest missing |
| Migration state | 36/36, no pending | Supplied sanitized staging position |

### 2.2 Production values that must be established separately

Production must have a separately approved and recorded identity for:

- Git ref, immutable image tag/digest, Dokploy/application identifier, and deployment target;
- production URL, DNS zone, TLS certificate, reverse proxy, and cache/CDN behavior;
- production database host, database name, schema, connection policy, and backup/snapshot provider;
- `DATABASE_URL` and any system/secondary database connection values;
- Payload encryption/authentication configuration and admin bootstrap path;
- `NEXT_PUBLIC_APP_URL`, allowed origins, cookie domain/secure settings, and redirect/callback URLs;
- Stripe secret/publishable keys, price/product IDs, portal configuration, and webhook secret/endpoint;
- Resend/API email credentials, verified sending domain, templates, and webhook settings;
- Bunny storage/CDN credentials, pull-zone/private-delivery configuration, media signing, and protected-resource policy;
- LiveKit API key/secret, host URL, room/session policy, and token audience;
- observability credentials, alert routing, error tracking, and log retention.

Secret values must never be placed in this package. Record only presence,
owner, target environment, rotation date, and verification result.

### 2.3 Deployment dependencies

The future production path depends on:

1. Protected repository integration and branch checks.
2. Immutable container build and GHCR publication.
3. Dokploy configuration selecting the approved image digest.
4. Correct production environment variables and secret references.
5. Database connectivity, backup capability, and migration authorization.
6. DNS/TLS routing and health-check convergence.
7. Stripe, email, Bunny, LiveKit, authentication, and webhook readiness.
8. Monitoring, incident response, rollback ownership, and communications.

## 3. Production deployment plan

This is an ordered plan, not an execution command sequence.

### Gate 0 — Authorization and freeze

- Approve scope, final SHA, integration PR, maintenance window, and owners.
- Archive the pre-cutover `main` SHA with an immutable tag.
- Confirm no unreviewed worktree or branch changes are included.
- Confirm the rollback image and database recovery path exist.

### Gate 1 — Integration validation

- Create the protected cutover integration branch from the validated feature SHA only after main-branch reconciliation is approved.
- Reconcile any selected main changes with a reviewable non-fast-forward merge.
- Run toolchain, typecheck/build, `pnpm test:release`, browser E2E, security, migration-contract, and documentation gates at the resulting SHA.

### Gate 2 — Exact-SHA staging verification

- Deploy only the exact integration SHA through the guarded staging lane.
- Record image digest, Dokploy convergence, health samples, migration artifact, provider checks, and the complete acceptance matrix.
- Stop if the running SHA, image digest, schema identity, or acceptance result does not match the packet.

### Gate 3 — Production preflight

- Verify production secrets/configuration by presence and owner, without exposing values.
- Confirm DNS/TLS, provider webhooks, monitoring, backup, restore, and rollback readiness.
- Obtain independent technical, database, product, and operations approvals.

### Gate 4 — Production deployment and migration order

Only after explicit authorization:

1. Capture and verify the production backup/snapshot reference.
2. Put the approved maintenance/rollback communication in effect.
3. Deploy the immutable application image according to the approved order.
4. Run a guarded read-only production migration/status preflight.
5. If a migration is actually required and separately approved, apply only the approved migration set using the named migration owner and maintenance window.
6. Run migration post-checks before opening customer traffic.
7. Verify health, authentication, portal, billing, providers, and monitoring.
8. Open traffic gradually if the infrastructure supports a canary or staged rollout.
9. Record final identity and go/no-go evidence.

No migration should be inferred from the staging 36/36 state. Production
schema state must be independently measured and approved.

## 4. Database safety review

### 4.1 Inventory and current contract

- The repository contains 36 canonical Payload migration registrations.
- The latest registered migration is `20260820_000000_live_session_space`.
- The reconciled staging position is 36/36 applied with no pending migration.
- Historical 29/35 baselines and the closed 35→36 path are audit history, not production state.
- Repository migration tests and CI prove contract behavior; they do not prove the production database has the same state.

### 4.2 Production migration risks

- Production may have a different applied set, schema, Prisma history, or legacy data shape.
- Relationship, uniqueness, index, enum, and account-action changes may fail on pre-existing data even when an empty rehearsal passes.
- Payload and Prisma histories must be compared independently.
- Application rollback does not automatically make a database rollback safe.
- Legacy subscriptions, media, rich-text embeds, reactions, and identity relationships require explicit source-to-target disposition.

### 4.3 Required backup and restore evidence

Before any production migration or schema-affecting deployment, record:

- backup/snapshot identifier, timestamp, retention, encryption, and owner;
- restore target and successful restore verification;
- expected row-count/integrity queries before and after restore;
- recovery point and recovery time objectives;
- migration owner, rollback/restore owner, abort threshold, and communication owner;
- explicit decision on whether rollback is application-only, restore-based, or migration-specific.

## 5. Launch acceptance checklist

### Member flows

- [ ] Registration, login, logout, verification, password reset, and account actions.
- [ ] Entitlement and membership access for monthly and annual plans.
- [ ] Portal dashboard, courses, lessons, resources, profile, directory, and cover image.
- [ ] Community browse, post, comment, discussion, moderation, reactions, and denial paths.
- [ ] Billing checkout, portal, webhook, payment failure, cancellation, and recovery.
- [ ] Public/private media access, protected delivery, and representative playback.
- [ ] LiveKit authorization, room/session behavior, and agreed AV acceptance.
- [ ] Empty, retry, rate-limit, and error states for critical journeys.

### Admin flows

- [ ] Admin authentication and least-privilege access.
- [ ] Member/course/content review and moderation.
- [ ] Media and protected-resource management.
- [ ] Billing/support/reconciliation visibility.
- [ ] Email queue and operational failure handling.
- [ ] Audit events and incident evidence capture.

### Infrastructure checks

- [ ] Exact image digest and Dokploy deployment identity match the approved SHA.
- [ ] Health endpoint and repeated availability samples pass.
- [ ] Logs, error tracking, metrics, alerts, and ownership are active.
- [ ] DNS, TLS, cache invalidation, redirects, and webhook routes pass.
- [ ] Backup, restore, rollback image, and configuration recovery are proven.
- [ ] No staging-only target, secret, hostname, or schema remains in production configuration.

## 6. Final launch decision framework

### Blockers

Production must remain NO-GO while any of the following is true:

- final integration SHA or immutable image identity is not fixed;
- main-branch reconciliation is unresolved;
- exact-SHA staging/provider/acceptance evidence is missing;
- production schema state or backup/restore evidence is unknown;
- rollback owners and abort thresholds are unassigned;
- required product gaps remain ambiguous, including reactions, media, preview-content scope, or partner processing;
- required secrets, DNS, webhooks, monitoring, or provider configuration are unverified;
- any approver has not explicitly signed the go/no-go record.

### Risks to carry explicitly

Critical risks are database integrity, incorrect image/SHA promotion, and
rollback failure. High risks are provider/webhook configuration, incomplete
feature parity, media exposure/loss, and customer billing/access regression.

### Deferred items

Only written, owner-approved deferrals are acceptable. Current candidates for
decision—not automatic approval—include durable partner/referral processing,
real-device LiveKit AV validation, preview content, and any reaction subtype
not promoted into scope.

### Required authorization record

The final go/no-go record must name and approve:

- product scope and deferred items;
- technical release owner and exact SHA;
- database/migration owner;
- backup/restore and rollback owner;
- infrastructure/Dokploy owner;
- provider/secrets owner;
- monitoring and incident owner;
- customer/support communications owner;
- maintenance window, abort thresholds, and final production decision.

## 7. Current decision

**Production decision: NO-GO / NOT AUTHORIZED.**

The repository and CI candidate are strong source evidence, but production
readiness cannot be inferred from staging history or local tests. The required
next evidence layer is an exact-SHA staging/provider/acceptance packet followed
by production-specific backup, configuration, rollback, and approval evidence.

## 8. Single next action

Complete the exact-SHA staging verification packet for the approved candidate,
including image/Dokploy identity, sanitized migration state, provider checks,
acceptance results, and rollback evidence. Do not begin production integration
or execution until that packet is independently reviewed.

Related authorities:

- `docs/release/PHASE_9_5_CURRENT_TRUTH_2026-08-23.md`
- `docs/release/PHASE_9_5_FINAL_IMPLEMENTATION_BACKLOG_2026-08-23.md`
- `docs/release/FINAL_CUTOVER_CANDIDATE_VERIFICATION_PACKAGE_2026-08-23.md`
- `docs/release/FUTURE_BRANCH_CUTOVER_PLAN.md`
- `docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md`
