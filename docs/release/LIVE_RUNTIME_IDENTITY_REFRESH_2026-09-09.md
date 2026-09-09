# JPV Bootcamp — Live Runtime Identity Refresh — 2026-09-09

**Status:** PRE-DEPLOYMENT READ-ONLY OBSERVATION — superseded by the verified
post-deployment state below

**Observed at:** `2026-09-09T12:20:47.955Z`

This record captures the pre-deployment public DNS and HTTP health probe. It
remains historical evidence and does not override the post-deployment result.

## Post-deployment verification — 2026-09-09

Publish workflow `34375016540` completed successfully for `main` commit/image
`c72ad378c6cf43a2d0a474000e3e979f834f784e`, including Dokploy convergence. A
follow-up read-only deployment-health probe returned HTTP 200 with
`status=live`, `deploymentEnv=production`, and image tag
`c72ad378c6cf43a2d0a474000e3e979f834f784e`. No separate production migration
workflow was run for this deployment.

## Observed results

| Origin | DNS | HTTP | `status` | `deploymentEnv` | `imageTag` | `commit` |
| --- | --- | ---: | --- | --- | --- | --- |
| `https://staging.jpvbootcamp.com` | Resolved | 200 | `live` | `staging` | `8b1f459fed358776fda791553ef225cc9f03b2ae` | `8b1f459fed358776fda791553ef225cc9f03b2ae` |
| `https://jpvbootcamp.com` | Resolved | 200 | `live` | `production` | `f93ffac7dd299c39d8daf242d6a436272cc79188` | `f93ffac7dd299c39d8daf242d6a436272cc79188` |
| `https://preview.jpvbootcamp.com` | `ENOTFOUND` | Not reached | — | — | — | — |
| `https://legacy.jpvbootcamp.com` | Resolved | 404 | — | — | — | — |

The preview hostname returned no answer through the local resolver and through
public resolver checks using `1.1.1.1` and `8.8.8.8`. The failed resolution does
not prove that preview retirement was intentional; authoritative DNS and
Dokploy state were not inspected.

## Probe method

The health checks used a Node `fetch` request to `/api/health` with a ten-second
timeout and recorded only `status`, `deploymentEnv`, `imageTag`, and `commit`.
DNS was checked with the Node resolver and public `dig` queries. No credentials,
response secrets, or database connection strings were read or recorded.

## Operational interpretation

- Staging is currently live and reports `deploymentEnv=staging`; this probe does
  not independently re-verify database isolation. It is serving image
  `8b1f459…`, not the current hygiene worktree tip.
- Production is currently live on image `f93ffac…`; the separate guarded
  migration-status record remains the authority for production migration state.
- Preview DNS/routing requires an authoritative external-state check before it
  can be classified as intentionally retired or repointed.
