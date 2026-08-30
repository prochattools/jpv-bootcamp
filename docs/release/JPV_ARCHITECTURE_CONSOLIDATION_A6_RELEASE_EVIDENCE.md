# JPV Architecture Consolidation A6 Release Evidence

## Current A6 Gate 2 production closeout — 2026-08-30

**Decision:** `A6 GATE 2 COMPLETE` · `ARCHITECTURE CONSOLIDATION COMPLETE` ·
`FEATURE DEVELOPMENT UNBLOCKED`

The approved `fix/e1-staging-gate-b` source was integrated into `main` with
merge commit `86cedfb9e35002e18e1b412ee43b948f85c88fbe` and deployed to the
canonical production application `clients-jpv-bootcamp-app-tp9xrk` at
`https://jpvbootcamp.com`.

### Production release evidence

- Pre-merge `origin/main` was
  `08605e52af4abb0b1bdcdfbe6890d010c545b636`; the final pre-push worktree was
  clean and `git diff --check` passed.
- GitHub Actions run
  [`33282245611`](https://github.com/prochattools/jpvbootcamp/actions/runs/33282245611)
  passed exact-source validation, release runtime validation, application
  build, immutable GHCR image publication, Dokploy image configuration,
  deployment, and root-production convergence.
- Independent live verification returned HTTP 200 for the root page. The
  production health endpoint reported `status=live`,
  `deploymentEnv=production`, and `imageTag`/`commit` equal to
  `86cedfb9e35002e18e1b412ee43b948f85c88fbe`.
- Deployment health reported Node `v20.20.2`, production email readiness,
  valid import-map/branding assets, and the Docker runtime.

### Production data and migration boundary

- Read-only Stripe identity reconciliation workflow
  `33281951339` reported 11 active Stripe subscriptions, 10 Payload active
  members, 7 customer-ID matches, 0 email-only matches, 0 unmatched, 0
  ambiguous, and 4 subscriptions linked to inactive local records. No apply
  mode was dispatched.
- No production migration was applied. The production image retains the
  guarded `PAYLOAD_SCHEMA_PREFLIGHT=true` startup check, and the live health
  response proves the deployed runtime passed its startup preflight. There is
  no canonical externally exposed production migration-plan report endpoint
  in this repository; no unobserved plan result is being asserted here.
- No Stripe, billing, membership, legacy, preview, DNS, or production-data
  mutation was part of this release gate.

The historical Gate 1 evidence below is retained for traceability and is
superseded by this production closeout.

## Current A6 Gate 1 final unblock — 2026-08-30

**Decision:** `READY FOR PRODUCTION MERGE`

This is the completed bounded A6 execution record. It remains staging-only and
records readiness for a separately authorized production integration step; it
does not itself authorize or perform a production merge, deployment, migration
apply, backfill, Stripe/provider mutation, legacy change, or preview retirement.

### Staging identity and candidate

- The staging course collision was inspected read-only and classified as
  **safe to adopt as the canonical staging QA fixture**: the existing record
  matched the repository seed and had no evidence of independent production
  provenance or meaningful manual content.
- A narrow code repair restored the existing course/module/lesson ownership
  fields required by the guarded seed contract. It did not weaken the seed
  guard or change access or billing behavior. The repair is commit
  `c28578a192c501317495b5e9747382ae08b73bad`, pushed to
  `origin/fix/e1-staging-gate-b`.

- The approved staging-only QA identity was classified as an **existing
  suitable non-admin QA member**. Its protected member credential was rotated
  through the supported staging application path; no credential value is
  recorded here.
- Protected GitHub Actions secret names verified: `STAGING_MEMBER_EMAIL`,
  `STAGING_MEMBER_PASSWORD`, `STAGING_ADMIN_EMAIL`, and
  `STAGING_ADMIN_PASSWORD`.
- The candidate is on `fix/e1-staging-gate-b`, is pushed to
  `origin/fix/e1-staging-gate-b`, and is deployed to the canonical staging
  authority `https://staging.jpvbootcamp.com`.

### Deployment and acceptance evidence

- Staging deployment workflow
  [`33275500278`](https://github.com/prochattools/jpvbootcamp/actions/runs/33275500278)
  completed successfully with exact-SHA, build,
  deterministic-release, immutable-image, routing, Dokploy, revision-health,
  and authenticated admin-responsive checks passing.
- The live staging health response reports `status=live`,
  `deploymentEnv=staging`, and both `commit` and `imageTag` equal to
  `c28578a192c501317495b5e9747382ae08b73bad`.
- Guarded seed workflow
  [`33276012313`](https://github.com/prochattools/jpvbootcamp/actions/runs/33276012313)
  passed its exact staging target gates, completed a green dry-run, and
  applied once with `create=1`, `update=30`, `skip=0`. The post-apply course
  is published, members-visible, and carries
  `prototype=true` and `prototypeKey=seed:jpv-bootcamp-foundations`.
- The initial authenticated acceptance workflow
  [`33276119607`](https://github.com/prochatools/jpvbootcamp/actions/runs/33276119607)
  exposed `A6-DATA-DENIED: no portal link matched
  ^/portal/community/[^/]+/posts/[^/]+$`. This was classified as
  `A6-COMMUNITY-TEST-SELECTION-BUG`, not a runtime or data failure. The
  acceptance harness was repaired in focused commits
  `446b4faaa1bb028970fa18c4e470e6a1d18d256c`,
  `71ee86d14d5808aa4d5f4ac07e3359e88035271e`, and
  `2824d0ad112ffa9832ce9aa185daf9c2f7efcbfc` to select the canonical
  announcements route, assert the real post heading, and scope engagement
  controls to the visible post. The application runtime was not changed.
- Final protected authenticated acceptance workflow
  [`33279806459`](https://github.com/prochattools/jpvbootcamp/actions/runs/33279806459),
  job `99172941401`, passed **24/24** authenticated tests against the exact
  staging runtime. The matrix covered widths 320, 375, 768, 1024, and 1440,
  including member course/module/lesson, canonical community post engagement,
  and creator/admin acceptance. The final harness tip is
  `2824d0ad112ffa9832ce9aa185daf9c2f7efcbfc`; the deployed runtime remains
  `c28578a192c501317495b5e9747382ae08b73bad`.
- Read-only migration-plan workflow
  [`33275184060`](https://github.com/prochattools/jpvbootcamp/actions/runs/33275184060)
  passed exact target and semantic verification. No schema migration was
  applied in this turn.

### Safety boundary

- Staging is the only runtime changed by this attempt. Production read-only
  health reports `status=live`, `deploymentEnv=production`, and commit/image
  `08605e52af4abb0b1bdcdfbe6890d010c545b636`.
- No production merge, production deployment, production data change,
  migration apply, administrator backfill, Stripe/provider mutation, or live
  email send was performed.
- No rollback was invoked. The current repository worktree is clean.

Gate 1 is **READY FOR PRODUCTION MERGE**. The earlier community link failure
was repaired in the acceptance harness and the complete protected staging
matrix is green. No application runtime or production state was changed by
this E2E-only closeout.

## Historical A6 Gate 1 secret-gate snapshot — 2026-08-29 (superseded)

**Decision:** `NOT READY FOR PRODUCTION MERGE`

This section is retained as historical evidence. It superseded the earlier
staging snapshot at the time, but is itself superseded by the final unblock
attempt above. The exact deployed candidate recorded at that checkpoint was
`c0257c3c21dee7536a749306261bee1e626ab3c5` on branch `fix/e1-staging-gate-b`,
a linear descendant of the verified production tip
`08605e52af4abb0b1bdcdfbe6890d010c545b636`.

### Candidate validation and staging deployment

- Local `pnpm test:release` passed **172/172** runnable checks; the release
  manifest contains 173 entries, including the conditional authenticated A6
  gate. TypeScript, the production build, Prisma/Payload checks, release
  guards, and staging static preflight also passed.
- The first staging dispatch exposed a stale evidence-count assertion and
  stopped before deployment. That assertion was corrected in the separate
  commit `c0257c3c21dee7536a749306261bee1e626ab3c5`, which was then validated
  by the successful staging release workflow.
- The previously verified read-only staging migration plan remains the
  migration-state authority: 52 applied Payload migrations, zero expected
  pending migrations, zero unexpected/duplicate/malformed/order-anomaly
  records, and healthy Prisma access. This helper-repair deployment did not
  rerun or apply a migration plan.
- Staging deployment run
  [`33250316281`](https://github.com/prochattools/jpvbootcamp/actions/runs/33250316281),
  job `99094772710`, passed exact-SHA checks, type check, build, deterministic
  release gate, immutable image publication, staging routing, Dokploy
  redeploy, revision health, and the authenticated Payload responsive gate.
  The migration-plan, backfill, bootstrap, and duplicate validation jobs were
  skipped by the staging-only deployment operation.
- The staging authority is
  `https://staging.jpvbootcamp.com`, Dokploy application
  `clients-jpv-bootcamp-preview-wjfqfd` / `bZllV93NqsPZAFCsqDskb`, database
  `jpvbootcamp_staging`, schema `jpvbootcamp`, and role
  `jpvbootcamp_staging_app`. Its live health response reports the exact
  image/commit `c0257c3c21dee7536a749306261bee1e626ab3c5` and
  `deploymentEnv=staging`.

### Acceptance evidence and remaining boundary

- The in-app browser checked the public and unauthenticated portal route
  matrix at widths 320, 375, 768, 1024, and 1440 for `/`, portal login,
  password recovery, sponsored access, portal shell, courses, community, live
  sessions, updates, billing, and Payload login. All inspected routes loaded
  without horizontal overflow, application-error text, route-not-found text,
  or browser warning/error logs.
- The CI authenticated browser gate passed the Payload admin, support-request,
  and course-admin responsive matrix at desktop, laptop, tablet, and mobile
  sizes, including mobile account containment and authenticated course API
  access.
- The exact-SHA authenticated acceptance run
  [`33250906841`](https://github.com/prochattools/jpvbootcamp/actions/runs/33250906841),
  job `99096303965`, verified the deployed staging runtime and then stopped at
  the protected-secret gate because `STAGING_MEMBER_EMAIL` and
  `STAGING_MEMBER_PASSWORD` are not configured. No browser matrix was claimed
  or executed. The member/creator-admin acceptance boundary therefore remains
  open with the exact blocker: `A6 BLOCKED — ADD STAGING_MEMBER_EMAIL AND STAGING_MEMBER_PASSWORD`.

### Safe provider smoke

- Valid-shape staging E2E passed the health check, unauthenticated LiveKit
  token behavior (`401` with a valid `sessionId`), join-page load, Bunny page
  load, and unsigned/invalid-signature Bunny rejection. No provider mutation
  or live email send was performed.
- Post-deployment `pnpm test:staging:livekit-bunny` passed **4/4** against
  staging: health `200`, valid-shape unauthenticated LiveKit token behavior
  `401`, and unsigned/invalid-signature Bunny webhook rejection `403`.
  The stale helper was repaired in focused commit
  `380ec2d28f4f3ede46cb2377e6a76e37c683b990` to send the current `sessionId`
  contract and require the expected authentication boundary.

### Production safety, billing baseline, and rollback

- Post-deployment health checks confirm production remains at
  `08605e52af4abb0b1bdcdfbe6890d010c545b636` with
  `deploymentEnv=production`. The preview compatibility hostname remains on
  that same production image and was not changed. Legacy remains frozen.
- No reconciliation, backfill, Stripe mutation, production migration, or
  production data change was performed by this helper repair.
- The deployed staging application can be rolled back through the guarded
  Dokploy staging path to the prior staging SHA
  `380ec2d28f4f3ede46cb2377e6a76e37c683b990`; no database rollback is needed
  because this gate applied no migration.

Gate 1 remains **NOT READY FOR PRODUCTION MERGE** until the authenticated
member/creator-admin acceptance matrix is completed. The deployed candidate,
provider smoke, and production-safety checks passed, but the exact protected
member secrets are required before the authenticated acceptance gate can run.

## Current E1 final closeout — 2026-08-29

**Decision:** `READY TO RESUME A6 GATE 1`

This current section supersedes older Gate-1 snapshots below. E1 verified the
staging runtime and boundary without changing production or legacy. The
canonical staging authority is `https://staging.jpvbootcamp.com` on Dokploy
application `clients-jpv-bootcamp-preview-wjfqfd` /
`bZllV93NqsPZAFCsqDskb`, exact image/commit
`0515b792f0aa6ab89db94f30e6176421e06546ae`, and `deploymentEnv=staging`.
It uses database `jpvbootcamp_staging`, schema `jpvbootcamp`, and role
`jpvbootcamp_staging_app`.

The exact-SHA read-only migration-plan workflow `33235046165` passed with 52
Payload migrations applied, zero expected pending migrations, zero unexpected,
duplicate, malformed, or ordering-anomaly records, and healthy Prisma access.
The guarded administrator-member backfill workflow `33234852975` passed with
one resolved and linked administrator identity, no unresolved matches, and no
fabricated subscription. The staging deployment workflow was `33234347436`.
Sanitized artifacts are `9709659401` and `9709600822` respectively.

Production remains healthy and protected at
`08605e52af4abb0b1bdcdfbe6890d010c545b636` with
`deploymentEnv=production`; legacy remains isolated and frozen. The preview
hostname is still HTTP 200 with no redirect, but serves the production image
and `deploymentEnv=production`. It is a stale compatibility endpoint, not
staging authority, and was not retired or mutated by E1. Preview retirement,
production integration, and provider changes remain separately authorized.

The sections below are historical A6 evidence snapshots. Their older preview,
Gate-A, branch, and staging claims must not be read as current live state.

## Historical A6 evidence snapshots

**Gate:** A6 Gate 1 — full regression, staging acceptance, and controlled production integration
**Assessment date:** 2026-08-28
**Decision:** `NOT READY FOR PRODUCTION MERGE`

This dossier records the bounded A6 execution. It separates repository evidence,
read-only live evidence, staging evidence, and deployment authorization. No
production merge, production deployment, migration apply, billing mutation,
provider-state mutation, or email send was performed by this A6 pass.

## 1. Release identities

| Item | Evidence |
| --- | --- |
| Starting A5.1 SHA | `102d23b5218eadbce13141c61b5a8c7e2fdf3595` |
| Current production authority | `main` and `origin/main` at `08605e52af4abb0b1bdcdfbe6890d010c545b636` |
| First Gate 1 application candidate | `69617bd87da256e0c344e01396c61b385fd60783` |
| A6.1 repaired application candidate | `323a73a13e6da07ebc3c1b44fc7ee2d1ff178870` |
| Candidate branch | `codex/production-architecture-consolidation` |
| Staging lane ref | `origin/feature/course-branding-and-preview` at the immutable application candidate |
| Production application | `clients-jpv-bootcamp-app-tp9xrk` |
| Staging origin | `https://preview.jpvbootcamp.com` |

The candidate is a descendant of the current production authority. The only
A6 repair committed in the application candidate is a release-guard allow-list
change in `scripts/release/stagingMigrationPreflight.ts` and
`scripts/staging-gates/configureStagingMigrationPlanEnvironment.ts`, allowing
the consolidation branch to pass the guarded staging lane. No application,
schema, provider, or user-data behavior was changed by that repair.

The paragraph above records the first Gate 1 candidate and is retained as
historical evidence. A6.1 produced the bounded follow-up repair at
`323a73a13e6da07ebc3c1b44fc7ee2d1ff178870`. That repair decouples generic
read-only migration discovery from the explicit reviewed apply batch, adds
duplicate/order anomaly evidence, and updates the staging-plan semantic gate.
It does not authorize or execute a migration apply.

## 2. Main reconciliation

- `git fetch origin` completed.
- `main` and `origin/main` agree at `08605e52af4abb0b1bdcdfbe6890d010c545b636`.
- The consolidation candidate includes the current production main history;
  no production hotfix was overwritten.
- No unrelated worktree residue was present before validation or after the
  candidate commit.
- No force push or reset was used.

## 3. Repository validation

| Gate | Result |
| --- | --- |
| `pnpm test:release` | **PASS — 171/171** |
| TypeScript and Payload config checks | **PASS** in release suite |
| Production build | **PASS** in release suite |
| Prisma validation | **PASS** in release suite |
| Auth/member/portal/Payload/billing/Stripe/email/LiveKit/Bunny/sponsored/support tests | **PASS** in release suite |
| `git diff --check` | **PASS** |
| GitHub push validation and build run `33167741593` | **PASS** at candidate SHA |
| Browser E2E in that CI run | **190 passed, 75 skipped, 0 failed** |

The CI browser run is a launch/local test-server run. It is not staging
acceptance and is not treated as proof of authenticated staging behavior.

## 4. Architecture regression review

The A6 candidate delta was reviewed for the packet's listed invariants:
authorization boundaries, duplicated gates/serializers, privileged imports,
cross-domain writes, identity collapse, audit/notification loss, billing truth
inversion, unknown-member creation, block-reason overwrite, dry-run writes,
secret exposure, design-system drift, and portal scroll behavior.

No regression was introduced by the A6 candidate delta: it is limited to the
two release-process branch allow-lists described above. Full runtime proof of
the inherited A0–A5.1 behavior remains pending because the candidate was not
deployed to staging.

## 5. Production read-only inventory

Read-only public health and deployment checks for `https://jpvbootcamp.com`
returned HTTP 200 and reported:

- deployed image/commit: `08605e52af4abb0b1bdcdfbe6890d010c545b636`;
- `deploymentEnv=production`;
- Node runtime `v20.20.2`;
- import-map checks healthy;
- email configuration present and ready by name/presence only;
- the canonical Payload migration registry is registered through the current
  production inventory, with no malformed or duplicate migration claim made
  from this endpoint check.

No production database write was performed.

## 6. Billing/member reconciliation

The authorized production `identity-dry-run` workflow `33168341116` completed
successfully against the production application. It performed no apply,
provisioning, checkpoint, or backfill operation.

Sanitized result:

- active Stripe subscriptions: **11**;
- active Payload members: **10**;
- exact Stripe customer-ID matches: **7**;
- unique-email matches: **0**;
- unmatched: **0**;
- ambiguous: **0**;
- active Stripe subscriptions linked to inactive local Payload members: **4**.

The current discrepancy is therefore a lifecycle-status mismatch, not four
unidentified subscriptions: seven subscriptions resolve to active local
members and four resolve by customer link to inactive Payload members. No
automatic identity repair is safe until those four lifecycle records are
reviewed. The earlier screenshot showing 13 active subscriptions is not the
current live dry-run result.

## 7. Staging deployment and migration gate

The current public staging runtime reported:

- `https://preview.jpvbootcamp.com` healthy;
- `deploymentEnv=preview`;
- deployed SHA `8388070c9ab79d0799b50adbd77329d982b3f2ef`, not the candidate;
- a migration registration inventory ending at the 2026-08-25 staging
  checkpoint.

The required guarded read-only staging migration plan was dispatched as run
`33167780312` against candidate SHA `69617bd87da256e0c344e01396c61b385fd60783`.
The network, target, and credential-presence guards passed, but the plan
stopped before querying the database. The runner's reviewed nine-migration
slice no longer matched the canonical 52-migration registry and aborted during
module initialization; the workflow consequently produced a sanitized
`plan_blocked` artifact with `output_format_invalid`.

This is a release-control defect and leaves the actual staging database state
unproven. The older workflow also encodes the historical 40-applied / six
migration checkpoint, while the current registry contains later migrations.
Because A6 requires staging migration state to be verified before deployment
and requires a stop when an unexpected migration appears, the candidate was
**not deployed to staging**.

## 8. Browser acceptance

Staging authenticated browser acceptance at widths 320, 375, 768, 1024, and
1440 was not run. The exact candidate never reached staging because the
read-only migration gate stopped first. Therefore no claim is made for
staging public, member, creator/admin, Payload admin, responsive, focus, or
runtime-JavaScript acceptance.

## 9. Provider/runtime proof

Production health reported provider configuration readiness by presence only.
The repository's static provider contracts passed. No live Stripe payment,
email send, Bunny mutation, LiveKit room creation, or other provider-state
operation was performed. Safe provider smoke remains pending staging
acceptance and must not be inferred from static tests or health configuration.

## 10. Data-flow regression status

The source-level A5.1 ownership decisions remain represented in the candidate:

- administrator identity uses an explicit Payload-to-member link/profile;
- Stripe remains commercial billing authority;
- Payload billing records remain local canonical projections;
- ambiguous and unmatched identities remain review-required;
- support and sponsored flows retain their named persistence/service paths;
- email remains an outbox/delivery concern;
- partner telemetry remains non-authoritative.

Live staging confirmation of these paths is pending because the candidate was
not deployed.

## 11. Rollback readiness

- Current production image/SHA: `08605e52af4abb0b1bdcdfbe6890d010c545b636`.
- Candidate application SHA: `69617bd87da256e0c344e01396c61b385fd60783`.
- No A6 migration was applied and no A6 production data was changed.
- Application rollback target is the retained production image at the current
  production SHA; restoring it through the guarded Dokploy production path is
  the operational rollback.
- If Git rollback is required after a future authorized merge, use a reviewed
  non-force-pushed revert commit for the merged range. Do not reset or force
  push `main`.
- Because A6 introduced no schema migration and performed no migration apply,
  database reversal is not required for this candidate.

## 12. Known blockers and non-blocking risks

Blocking:

1. The guarded staging read-only migration plan is stale and failed before the
   database query.
2. The candidate has not been deployed to staging, so exact-SHA convergence,
   authenticated browser acceptance, and provider smoke are unproven.
3. Four active Stripe subscriptions are linked to inactive Payload members and
   require explicit lifecycle review before any backfill or production
   integration decision.

Non-blocking observations:

- CI browser E2E had 75 declared skips and was not staging acceptance.
- Public deployment-info route checks returned 404; the health/deployment
  endpoints were the available identity evidence.
- The production health endpoint reports the registered migration inventory;
  this is not a substitute for an applied-state database query.

## Gate 1 decision

`NOT READY FOR PRODUCTION MERGE`

Gate 2 was not entered. No merge to `main`, production build/deployment, live
provider smoke, migration apply, reconciliation apply, or administrator
backfill was performed.

The next safe action is to repair and review the staging migration-plan
contract, then run a fresh guarded read-only plan against the exact candidate
before any staging deployment. That repair must be separately validated and
must not broaden into a migration apply or production change.

## 13. A6.1 continuation — bounded release-control repair

This continuation preserves the first failed Gate 1 attempt above and records
the follow-up work without reopening A0–A5.1 or entering Gate 2.

### Repair and repository evidence

- Repair commit: `323a73a13e6da07ebc3c1b44fc7ee2d1ff178870`
  (`fix: decouple migration discovery from apply authorization`).
- The repair commit was pushed fast-forward to
  `origin/feature/course-branding-and-preview`; the current feature tip is
  the documentation-only evidence snapshot
  `d9eeb1bbfe3bb632a9ae3e9922aa78f829ea4cc2`. The final exact-SHA staging
  plan below ran at its parent evidence tip
  `0738687cc71007077e370ca72e83df48b0d4ae1a`, whose parent is the repaired
  application SHA.
- `main` and `origin/main` remain at
  `08605e52af4abb0b1bdcdfbe6890d010c545b636`; no merge or production change
  was performed.
- Local focused release tests passed: staging runner **152/152**, migration
  status **43/43**, staging workflow contract **74/74**, and dynamic Step 3
  semantics passed.
- `pnpm test:release` passed **171/171**; TypeScript, static preflight,
  migration preflight, and `git diff --check` passed.
- Push-gate workflow `33179516087` completed successfully at the repaired SHA;
  its application build, deterministic release gate, and browser E2E passed
  (**190 passed, 75 skipped, 0 failed**).
- Push-gate workflow `33180994836` completed successfully at the current
  feature tip `0738687cc71007077e370ca72e83df48b0d4ae1a`; its application
  build, deterministic release gate, and browser E2E again passed (**190
  passed, 75 skipped, 0 failed**).

### Fresh guarded staging plan

Read-only staging-plan workflow `33179579309` checked out the exact repaired
SHA and passed confirmation, branch/SHA ancestry, target identity, secret
presence, Tailscale connectivity, and TCP connectivity to the reviewed
staging database path. The migration runner then returned the sanitized
blocker `status_query_failed`; `prismaHealthy=false`. No migration was
applied, and no deploy job ran.

A final exact-feature-tip read-only staging plan, workflow `33181017493`,
checked out `0738687cc71007077e370ca72e83df48b0d4ae1a` and returned the same
sanitized blocker `status_query_failed` with `prismaHealthy=false`. Its
sanitized result confirms `schema=jpvbootcamp_staging`,
`targetId=jpvbootcamp-staging`, and `appliedPayloadCount=0`; no deploy job
ran. The underlying database status-query error is intentionally not
included in the artifact, so its concrete database/configuration cause is
not established by this run. Because the status query did not complete, the
actual applied/pending migration state remains **unknown**. The staging
candidate must not be deployed until the read-only query is diagnosed and a
fresh exact-SHA plan succeeds.

### Fresh production identity classification

The authorized read-only production identity dry-run `33180247113` completed
successfully in live Stripe mode and performed no writes. It reported:

- active Stripe subscriptions: **11**;
- active Payload members: **10**;
- customer-ID matches: **7**;
- email matches: **0**;
- unmatched: **0**;
- ambiguous: **0**;
- active subscriptions linked to inactive Payload members: **4**.

All four exceptional rows were explained by an existing Stripe customer-ID
link to an inactive local Payload member (member IDs 1, 17, 37, and 40). They
are not unresolved identities, so no identity backfill was authorized or
performed. Lifecycle review is still required before any access or status
repair.

### A6.1 decision

`NOT READY FOR PRODUCTION MERGE`

The release remains outside Gate 2. No staging migration apply, staging
deployment, production merge, production deployment, provider mutation, or
member-data mutation was performed. The next safe action is a bounded
read-only diagnosis of `status_query_failed`, followed by one fresh exact-SHA
staging plan; if that plan does not pass, stop without deploying.

## 14. A6.1 resumed Gate 1 evidence — exact candidate `ba87958`

This section supersedes the earlier A6.1 continuation for the current release
control repair while preserving all earlier attempts above. It remains within
the A6.1 boundary: no migration apply, provider mutation, member mutation,
staging deployment, production merge, or production deployment.

### Bounded repair

- Code commit: `ba87958f4209e5ab4ad88a4b6191ae5b7ee1d483`
  (`fix: decouple migration discovery from apply authorization`).
- The commit contains only the staging migration runner and its focused test.
- The candidate was pushed fast-forward to
  `origin/feature/course-branding-and-preview`.
- `main` and `origin/main` remain at
  `08605e52af4abb0b1bdcdfbe6890d010c545b636`.
- Pre-landing review found no actionable issues in the bounded diff; no PR or
  Greptile review was available for this candidate branch.

### Validation

All local validation used the repository Node 20.20.2 / pnpm 10.33.0 contract:

| Check | Result |
|---|---|
| Focused staging migration runner | **158/158 passed** |
| Migration status contract | **43/43 passed** |
| Staging migration-plan workflow contract | **74/74 passed** |
| Staging migration preflight | **12/12 passed** |
| TypeScript (`tsc --noEmit`) | **PASS** |
| Documentation/status consistency | **PASS** |
| Migration boundary, readiness, and rehearsal safety checks | **PASS** |
| `pnpm test:release` | **171/171 passed** |
| `git diff --check` | **PASS** |

The automatic candidate push gate `33184787945` was still running through
its deterministic release gate and browser E2E when this evidence snapshot
was written; its build and type-check stages had passed. Its final result must
be recorded before any future staging decision.

### Fresh guarded staging plan

Read-only staging-plan workflow `33184846837` checked out the exact candidate
SHA `ba87958f4209e5ab4ad88a4b6191ae5b7ee1d483`. The sanitized artifact
reported:

```json
{"version":2,"resultCode":"plan_blocked","blockerCodes":["status_query_failed"],"branch":"feature/course-branding-and-preview","commit":"ba87958f4209e5ab4ad88a4b6191ae5b7ee1d483","schema":"jpvbootcamp_staging","environment":"staging","targetId":"jpvbootcamp-staging","appliedPayloadCount":0,"expectedPendingMigrations":[],"expectedPendingBatchIsOnlyMissing":false,"unexpectedPayloadCount":0,"duplicatePayloadCount":0,"malformedPayloadCount":0,"orderingAnomalyCount":0,"prismaHealthy":false}
```

Confirmation, branch/SHA ancestry, target identity, required-secret
presence, Tailscale connectivity, and TCP connectivity passed. The
read-only database status query did not complete, so the actual staging
applied/pending migration state remains unknown. The workflow uploaded the
sanitized artifact and did not run any apply or deploy job. The prior failed
plans `33179579309` and `33181017493` remain preserved above.

### A6.1 decision

`NOT READY FOR PRODUCTION MERGE`

Gate 2 was not entered. No staging migration was applied, no staging or
production deployment was performed, and no provider, subscription,
reconciliation, administrator-link, or member data was changed. The next
safe action is a bounded read-only diagnosis of `status_query_failed`, then
one fresh exact-SHA staging plan; if it does not pass, stop without deploying.

## 15. A6.1 current-tip confirmation — `3da499c`

The code repair remains `ba87958f4209e5ab4ad88a4b6191ae5b7ee1d483`.
Documentation-only commit `3da499c8e9e7b66832dab300bdf49a4c733072c4` was the
branch tip when the plan below ran; later documentation-only snapshots changed
no runtime code, database, provider, subscription, reconciliation, or member
state.

The final exact-current-tip read-only staging-plan workflow was
`33185789357`. Its sanitized result was:

```json
{"version":2,"resultCode":"plan_blocked","blockerCodes":["status_query_failed"],"branch":"feature/course-branding-and-preview","commit":"3da499c8e9e7b66832dab300bdf49a4c733072c4","schema":"jpvbootcamp_staging","environment":"staging","targetId":"jpvbootcamp-staging","appliedPayloadCount":0,"expectedPendingMigrations":[],"expectedPendingBatchIsOnlyMissing":false,"unexpectedPayloadCount":0,"duplicatePayloadCount":0,"malformedPayloadCount":0,"orderingAnomalyCount":0,"prismaHealthy":false}
```

All pre-database guards passed and the sanitized artifact uploaded. The
read-only status query failed, so applied/pending staging state remains
unknown. The deploy and migration-apply jobs were skipped. The automatic
candidate push validation `33185716475` is separate and remains in progress;
it does not change this read-only database decision.

### Current Gate 1 decision

`NOT READY FOR PRODUCTION MERGE`

Gate 2 remains unopened. No migration apply, staging deployment, production
merge, production deployment, provider mutation, reconciliation apply, or
administrator backfill was performed.

## 16. A6.1 exact-current-tip confirmation — `1fc0296`

The candidate tip was `1fc02962a138923055dcbd070108ace6e62534fe`. This tip
contains the bounded A6.1 release-control repair and documentation-only
evidence descendants; it contains no application, migration, provider, or
member-data mutation beyond the already reviewed repair.

The exact-SHA read-only staging-plan workflow was `33187797302`. Its sanitized
artifact reported:

```json
{"version":2,"resultCode":"plan_blocked","blockerCodes":["status_query_failed"],"branch":"feature/course-branding-and-preview","commit":"1fc02962a138923055dcbd070108ace6e62534fe","schema":"jpvbootcamp_staging","environment":"staging","targetId":"jpvbootcamp-staging","appliedPayloadCount":0,"expectedPendingMigrations":[],"expectedPendingBatchIsOnlyMissing":false,"unexpectedPayloadCount":0,"duplicatePayloadCount":0,"malformedPayloadCount":0,"orderingAnomalyCount":0,"prismaHealthy":false}
```

Confirmation, branch/SHA ancestry, target identity, required-secret
presence, Tailscale connectivity, and TCP connectivity passed. The read-only
database status query failed, so applied/pending staging state remains
unknown. The sanitized artifact was uploaded; migration apply, staging
deploy, and production deploy jobs did not run. A local environment audit
found only localhost development database URLs, so no local database query
was attempted.

### Current Gate 1 decision

`NOT READY FOR PRODUCTION MERGE`

Gate 2 remains unopened. No migration apply, staging deployment, production
merge, production deployment, provider mutation, reconciliation apply, or
administrator backfill was performed. The external staging database
configuration or permissions must be repaired or independently verified
before another exact-SHA plan can pass.

## 17. A6.1 exact-current-tip confirmation — `f6f293d`

The candidate tip was `f6f293d3b47193d5d3e5a0ae04cc729f5af8ae9f`. This tip
contains documentation-only evidence changes after the previously reviewed
runtime repair; it contains no application, migration, provider, or member
data mutation.

The exact-SHA read-only staging-plan workflow was `33189321596`. Its sanitized
artifact reported:

```json
{"version":2,"resultCode":"plan_blocked","blockerCodes":["status_query_failed"],"branch":"feature/course-branding-and-preview","commit":"f6f293d3b47193d5d3e5a0ae04cc729f5af8ae9f","schema":"jpvbootcamp_staging","environment":"staging","targetId":"jpvbootcamp-staging","appliedPayloadCount":0,"expectedPendingMigrations":[],"expectedPendingBatchIsOnlyMissing":false,"unexpectedPayloadCount":0,"duplicatePayloadCount":0,"malformedPayloadCount":0,"orderingAnomalyCount":0,"prismaHealthy":false}
```

Confirmation, branch/SHA ancestry, target identity, required-secret
presence, Tailscale connectivity, and TCP connectivity passed. The read-only
database status query failed, so applied/pending staging state remains
unknown. The sanitized artifact was uploaded; migration apply, staging
deploy, and production deploy jobs did not run.

### Current Gate 1 decision

`NOT READY FOR PRODUCTION MERGE`

Gate 2 remains unopened. No migration apply, staging deployment, production
merge, production deployment, provider mutation, reconciliation apply, or
administrator backfill was performed. The external staging database
configuration or permissions must be repaired or independently verified
before another exact-SHA plan can pass.
