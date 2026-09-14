# Provenance Control-Plane Deployment — 2026-09-14

## Scope

This record covers the approved inert production deployment and its pre-apply
read-only verification. It does not authorize or perform a Prisma migration,
Payload migration, Mighty operation, Stripe operation, worker execution,
bootstrap execution, scheduler run, population inspection, or user-data change.

## Deployment

- Workflow run: `34877921951`
- Target/deployed SHA: `b1e105d3ac855f20a983fb70bcefffb2490c864f`
- Production revision before: `dbe0d9180e4233c5d7b58ba23554dafa5cd2333f`
- Stale run `34870616841`: cancelled
- Deployment result: image build, publish, Dokploy update, and convergence passed
- Public `/api/health`, `/api/health/deployment`, `/`, `/terms`, `/privacy`,
  and `/cookies`: HTTP 200
- `status`: `live`
- `deploymentEnv`: `production`
- Observed downtime: none

The deployed delta is control-plane migration/verifier support only. The
bootstrap/access-sync runtime RC was not deployed; production does not depend
on `state_source` or `state_observed_at` runtime behavior.

## Read-only verifier

The exact verifier code from the deployed SHA reported:

- result: `VERIFIED`
- verification state: `VERIFIED_WITH_EXPECTED_PENDING_PRISMA`
- observed image tag: `b1e105d3ac855f20a983fb70bcefffb2490c864f`
- pending Payload: `[]`
- unexpected Payload: `[]`
- pending Prisma: `20260914140000_add_mighty_bootstrap_provenance`
- unexpected Prisma: `[]`
- failed/in-progress/rolled-back Prisma: `[]`
- protected Payload anomaly: `20260826_100000_administrator_member_identity`
- protected fingerprint: `0fdb089ae8abdeaabb7cacd8ab7452a62d266bb5038d8f470a795e4241ea3f8c`
- fingerprint match: `true`
- blockers: `[]`
- transaction: `BEGIN TRANSACTION READ ONLY` followed by `ROLLBACK`
- mutation performed: `false`

The production image does not ship the development `tsx` launcher and its
container egress could not complete the public health fetch. The verifier's
exact deployed-code production path was therefore run with the independently
captured deployment-health identity supplied through its supported revision
reader dependency. The PostgreSQL evidence path remained the exact official
read-only implementation against the governed runtime `DATABASE_URL`.

## Backup and recovery evidence

- Azure Recovery Services Vault: `rsv-saas-infra`
- Recovery point: `8016719968922080516`
- Created: `2026-09-14T03:03:21.643747+00:00`
- Type: `FileSystemConsistent`
- Protected item health: `Passed`
- Protected item state: `Protected`
- Target: production infrastructure backup for the Supabase VM hosting the
  production database
- Integrity/checksum: no checksum field was exposed by the supported Azure
  evidence queried; provider health and recovery-point identity were verified
- Recovery validation: recovery-point listing/show succeeded; no restore was
  performed in this goal
- Rollback owner: `production-release-owner`

The evidence is same-day and current for this pre-apply window. It must be
revalidated again if the guarded migration apply occurs outside this window.

## Inertness and impact

- `MIGHTY_ACCESS_SYNC_ENABLED`: not `true`
- Scheduler: disabled
- Worker/bootstrap/cutover/migration/reconciliation executions: `0` observed
- Live Mighty reads/mutations: `0`
- Live Stripe reads/mutations: `0`
- Production database migrations: `0`
- Production data/access/content changes: `0`
- User-visible test data: `0`

## Next gate

The sole pending migration is intentionally not applied:

`20260914140000_add_mighty_bootstrap_provenance`

The next operation requires a separate explicit authorization for a guarded
provenance migration apply. Do not invoke the production migration workflow,
`prisma migrate deploy`, raw SQL, Mighty, Stripe, worker, scheduler, or
bootstrap before that authorization.
