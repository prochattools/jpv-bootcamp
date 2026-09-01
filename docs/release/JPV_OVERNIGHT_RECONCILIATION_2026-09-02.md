# JPV Bootcamp Overnight Repository Reconciliation — 2026-09-02

## Scope and authority

Captured at 2026-09-02 00:28 Lisbon time. This was a repository, worktree, branch, and staging-parity reconciliation. No application behavior was changed, no staging migration was applied, and production and legacy were left untouched.

| Evidence | Result |
| --- | --- |
| Historical audit baseline | `ce82f12bae10bb44e19f4efa757d9717bcbe9bdc` |
| Canonical local main | `/Users/Office/Repos/prochattools/clients/jc-citadel/jpv-bootcamp-main` |
| `origin/main` and canonical `main` | `f93ffac7dd299c39d8daf242d6a436272cc79188` |
| Canonical main status | Clean; zero commits ahead or behind `origin/main` |
| Open pull requests | 0 |
| Production image | `ghcr.io/prochattools/jpv-bootcamp:f93ffac7dd299c39d8daf242d6a436272cc79188` |
| Staging image | `ghcr.io/prochattools/jpv-bootcamp:6344612c735bd57264b4f376b66f36039bc33830` |
| Legacy image | `ghcr.io/prochattools/jpv-bootcamp:e88cb8de015c329a64d8aa303bd36c3ff4aa3ec0-legacy` |

The production health endpoint returned HTTP 200 and the expected `f93ffac7` image tag. Its reported `commitSha` is null, so no stronger live-commit claim is made. The legacy deployment endpoint returned HTTP 404; Dokploy inspection still confirmed the preserved legacy image, and no legacy mutation was attempted.

## Worktrees, disk, and refs

- Registered worktrees: 16 fresh-audit baseline → 13 final.
- Final worktrees: 6 dirty, 7 unique to `origin/main`, and 6 ancestry-merged (including canonical main).
- Removed exactly three clean, fully ancestry-merged worktrees: course-admin UX, production Payload bootstrap, and resources/LiveKit/content fixes.
- A temporary parity worktree and branch were created only for the guarded read-only staging plan, then removed after the plan failed before database access.
- Client repository disk usage: approximately 22G → 16G.
- Local branches: 64 → 40. Remote branches: 39 → 21 (excluding the symbolic `origin` ref).
- Retired 24 local refs and 18 exact remote refs. Each remote ref was independently confirmed ancestry-merged, unreferenced by workflows/docs, and covered by zero open PRs.
- Preserved active/dirty/unique work, including `codex/ux-architecture-consolidation`, the dirty Stripe reconciliation worktree, billing and leaderboard branches, `feature/payload-v2`, the legacy release line, webhook retry-safety work, portal visual work, community-admin work, all dirty nested worktrees, and documented historical refs.
- Preserved `feature/course-branding-and-preview` because current staging workflows and runbooks still name it as the operational staging authority, even though its tip is already reachable from `main`.
- `git worktree prune --dry-run` reported no remaining stale metadata.

## Staging parity and migration evidence

The staging health endpoint is healthy, but staging is not at current-main parity:

- Staging reports 53 registered migration names; current main reports 55.
- A direct read-only transaction against the staging container confirmed schema `jpvbootcamp`, 53 applied Payload migrations, and 28 Prisma migrations with 0 unhealthy records.
- The two current-main migrations absent from staging are `20260901_210000_notification_event_key` and `20260901_220000_member_follows`.
- The guarded GitHub read-only plan was dispatched at temporary parity SHA `19ef6f547d28e961c144f9db311494740c2537ab`; run [33570198515](https://github.com/prochattools/jpv-bootcamp/actions/runs/33570198515).
- Environment readiness and secret-presence gates passed. The plan then failed at the Tailscale ping to `10.0.2.4` after repeated timeouts, before the database query. The workflow correctly performed no write.
- Because the private staging route is not reachable from the guarded runner and two migrations are pending, exact-main staging deployment was not safe and was not attempted. The existing staging app remains on image `6344612c`.

The temporary parity marker was an empty commit on top of `origin/main`; its tree was otherwise identical to current main. It was deleted locally and remotely after the evidence run.

## Validation and final shape

- `pnpm test:release`: **181/181 passed**, including TypeScript, production build, migration inventory/readiness/rehearsal/rollback contracts, portal/admin behavior, route contracts, security checks, dependency audit, staging boundary checks, and evidence validation.
- Canonical main `git diff --check`: passed.
- Production and legacy: unchanged.
- Staging: unchanged; no migration apply, seed, backfill, deployment, or data mutation performed.
- Active dirty worktrees and user changes were not reset, stashed, committed, or deleted.

## Remaining debt and next action

1. Restore the reviewed Tailscale subnet route/ACL for the GitHub `ci-reader` plan runner to `10.0.2.4:5433`, then rerun the read-only staging plan against an approved temporary parity ref.
2. Separately authorize and apply the two pending staging Payload migrations through the guarded staging process; only after a clean post-apply plan should the exact current-main app image be deployed to staging.
3. Keep production and the legacy deployment outside this staging remediation until separate release authorization and evidence exist.
