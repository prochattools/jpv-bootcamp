# JPV Bootcamp — Live Runtime Identity Refresh — 2026-09-09

**Status:** POST-DEPLOYMENT READ-ONLY OBSERVATION — final production identity verified;
dated pre-deployment values are retained below for audit continuity

**Initial observation:** `2026-09-09T12:20:47.955Z`

**Final post-deployment verification observed at:** `2026-09-09T19:15:24Z`

This record preserves the pre-deployment public DNS and HTTP health probe as
historical evidence and records the final post-deployment result below.

## Post-deployment verification — 2026-09-09

Publish workflow `34392897174` completed successfully for `main` commit/image
`d55ac6a30bcd78c63bd2a0a46db709617efc48f2`, including Dokploy convergence. A
follow-up read-only deployment-health probe returned HTTP 200 with
`status=live`, `deploymentEnv=production`, and image tag
`d55ac6a30bcd78c63bd2a0a46db709617efc48f2`. No separate production migration
workflow was run for this deployment.

The configured production origin is `https://jpvbootcamp.com`. The separate
alias `https://jpv-bootcamp.prochat.tools` resolved in DNS but returned
Cloudflare HTTP 530 error 1033 during the same read-only probe; it is not the
production origin used by the publish workflow.

## Observed results

| Origin | DNS | HTTP | `status` | `deploymentEnv` | `imageTag` | `commit` |
| --- | --- | ---: | --- | --- | --- | --- |
| `https://staging.jpvbootcamp.com` | Resolved | 200 | `live` | `staging` | `8b1f459fed358776fda791553ef225cc9f03b2ae` | `8b1f459fed358776fda791553ef225cc9f03b2ae` |
| `https://jpvbootcamp.com` | Resolved | 200 | `live` | `production` | `d55ac6a30bcd78c63bd2a0a46db709617efc48f2` | `d55ac6a30bcd78c63bd2a0a46db709617efc48f2` |
| `https://jpv-bootcamp.prochat.tools` | Resolved | 530 / Cloudflare 1033 | — | — | — | — |
| `https://preview.jpvbootcamp.com` | `ENOTFOUND` | Not reached | — | — | — | — |
| `https://legacy.jpvbootcamp.com` | Resolved | 404 | — | — | — | — |

The preview and legacy rows above are historical pre-deployment observations;
they were not re-probed in this post-deployment check.

The preview hostname returned no answer through the local resolver and through
public resolver checks using `1.1.1.1` and `8.8.8.8`. The failed resolution does
not prove that preview retirement was intentional; authoritative DNS and
Dokploy state were not inspected.

## Probe method

The health checks used a Node `fetch` request to `/api/health` with a ten-second
timeout and recorded only `status`, `deploymentEnv`, `imageTag`, and `commit`.
DNS was checked with the Node resolver and public `dig` queries. No credentials,
response secrets, or database connection strings were read or recorded.

## Historical pre-deployment operational interpretation

- Staging was live and reported `deploymentEnv=staging`; this probe did
  not independently re-verify database isolation. It is serving image
  `8b1f459…`, not the current hygiene worktree tip.
- Production was previously live on image `f93ffac…`; the post-deployment
  section above supersedes that value.
- Preview DNS/routing requires an authoritative external-state check before it
  can be classified as intentionally retired or repointed.
