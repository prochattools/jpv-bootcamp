# JPV Architecture Consolidation A6 Release Evidence

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
  the documentation-only continuation commit
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
