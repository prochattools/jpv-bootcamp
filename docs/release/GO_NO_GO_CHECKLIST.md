# Go / No-Go Checklist

Default decision state: `NO-GO`

Do not change this checklist to `GO` until the required operator evidence exists.

## Identity

- Branch:
- Commit:
- Release candidate label:
- Date:
- Operator:
- Approvers:
- Rollback owner:
- Monitoring owner:

## Repository-owned green gates

- [ ] `pnpm staging:migration-preflight`
- [ ] `pnpm staging:migration-rehearsal`
- [ ] `pnpm staging:migration-rehearsal:evidence`
- [ ] `pnpm staging:provider-simulation`
- [ ] `pnpm staging:smoke-plan`
- [ ] `pnpm staging:smoke-simulated`
- [ ] `pnpm release:evidence:dry-run`
- [ ] `pnpm test:release`
- [ ] `pnpm test:e2e`
- [ ] `pnpm test:release:full`
- [ ] `pnpm staging:static-preflight`
- [ ] `./node_modules/.bin/tsc --noEmit --pretty false --incremental false`
- [ ] `pnpm build`
- [ ] `./node_modules/.bin/prisma validate --schema=prisma/system.prisma`
- [ ] `./node_modules/.bin/prisma validate --schema=prisma/schema.prisma`
- [ ] `pnpm exec pnpm audit --prod --audit-level high`

## Required external gates

- [ ] representative programme content approved or placeholder accepted
- [ ] migration approval complete
- [ ] migration applied through approved path
- [ ] post-migration verification complete
- [ ] rollback evidence from staging or production window captured
- [ ] provider/email verification complete
- [ ] Stripe verification complete
- [ ] Payload/admin staging verification complete
- [ ] support-intake staging verification complete where in scope
- [ ] staging smoke complete
- [ ] browser acceptance evidence complete
- [ ] monitoring readiness confirmed
- [ ] formal approval recorded

## Required green-gate status

| Gate | Required state | Evidence link / path |
| --- | --- | --- |
| release suite | pass | |
| browser suite | pass | |
| static preflight | pass | |
| build | pass | |
| Prisma validation | pass | |
| dependency audit | pass at high severity gate | |
| migration preflight | pass | |
| migration rehearsal | pass in static mode or explicit localhost-only disposable mode | |
| migration rehearsal evidence | pass | |
| provider simulation | pass | |
| migration applied | pending until executed | |
| post-migration verification | pending until executed | |
| provider verification | pending until executed | |
| local simulated smoke | pass | |
| staging smoke | pending until executed | |
| rollback readiness | documented and repository-owned checklist complete | |
| rollback evidence from staging | pending until executed | |
| monitoring readiness | owner assigned and evidence captured | |
| content approval | pending until explicit approval | |

## Blockers

- programme content:
- migration state:
- provider state:
- staging state:
- unresolved advisories:
- operational ownership:

## Rollback trigger review

- [ ] rollback trigger criteria reviewed
- [ ] backup or snapshot reference recorded
- [ ] rollback owner available during the window
- [ ] restore-based fallback approved

## Decision

- GO:
- CONDITIONAL GO:
- NO-GO:

Current default:

- Decision: `NO-GO`
- Reason: repository-owned preparation may be complete, but actual migration approval and apply, staging/provider verification, staging rollback evidence, content approval, and formal approval remain external gates until evidenced.

## Approval record

- Timestamp:
- Approver names:
- Approval references:
- Notes:
