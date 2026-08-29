/**
 * Deployment boundary policy.
 *
 * All staging deployment decisions must pass through assertStagingDeployment()
 * before any Dokploy API call. Fail closed — throws on any violation.
 *
 * The staging application and source ref are explicit allow-lists. Production
 * and legacy IDs are denied before any other check.
 */

import {
  ENVIRONMENT_TOPOLOGY,
  isAllowedStagingSourceRef,
} from '../../src/lib/environmentTopology'

export const STAGING_APP_ID = ENVIRONMENT_TOPOLOGY.staging.dokploySlug
export const STAGING_APP_INTERNAL_ID = ENVIRONMENT_TOPOLOGY.staging.dokployApplicationId
export const STAGING_APP_IDS = [STAGING_APP_ID, STAGING_APP_INTERNAL_ID] as const
export const STAGING_ORIGIN = ENVIRONMENT_TOPOLOGY.staging.origin
export const STAGING_SOURCE_REF_EXAMPLE = 'feature/example'
export const STAGING_SOURCE_REF_DESCRIPTION = 'feature/*, fix/*, or release/*'

/** Any app ID in this list must never be targeted. Fail closed. */
export const PRODUCTION_DENY_LIST = [
  ENVIRONMENT_TOPOLOGY.production.dokploySlug,
  ENVIRONMENT_TOPOLOGY.production.dokployApplicationId,
  ENVIRONMENT_TOPOLOGY.legacy.dokploySlug,
  ENVIRONMENT_TOPOLOGY.legacy.dokployApplicationId,
] as const

export interface DeploymentContext {
  appId: string
  origin: string
  branch: string
}

/**
 * Assert that a deployment context targets only the allowed staging environment.
 * Throws a descriptive error for any violation.
 */
export function assertStagingDeployment(ctx: DeploymentContext): void {
  // Check deny-list first — deny-listed IDs must never proceed regardless of other params
  for (const deniedId of PRODUCTION_DENY_LIST) {
    if (ctx.appId === deniedId) {
      throw new Error(
        `DEPLOY-DENIED: appId '${ctx.appId}' is on the production deny-list. ` +
          `Denied IDs: [${PRODUCTION_DENY_LIST.join(', ')}]. ` +
        `Only staging app '${STAGING_APP_ID}' or '${STAGING_APP_INTERNAL_ID}' is allowed.`,
      )
    }
  }

  // Exact app ID check — must match staging exactly
  if (!STAGING_APP_IDS.includes(ctx.appId as (typeof STAGING_APP_IDS)[number])) {
    throw new Error(
      `DEPLOY-DENIED: appId '${ctx.appId}' is not an allowed staging app ID. ` +
        `Allowed: '${STAGING_APP_ID}' or '${STAGING_APP_INTERNAL_ID}'.`,
    )
  }

  // Exact normalized HTTPS origin check
  assertStagingOrigin(ctx.origin)

  // Candidate refs are constrained by type, but are not permanently coupled
  // to one historical feature branch.
  if (!isAllowedStagingSourceRef(ctx.branch)) {
    throw new Error(
      `DEPLOY-DENIED: source ref '${ctx.branch}' is not allowed. ` +
        `Use ${STAGING_SOURCE_REF_DESCRIPTION}; main and legacy refs are forbidden.`,
    )
  }
}

/**
 * Assert that a URL string is exactly the staging origin.
 * Rejects: production origin, suffix domains, userinfo, non-HTTPS, wrong port,
 * path/query suffixes, and redirects.
 */
export function assertStagingOrigin(rawUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error(`STAGING-URL-INVALID: cannot parse URL: '${redactUserinfo(rawUrl)}'`)
  }

  // Reject any userinfo (credentials in URL)
  if (parsed.username || parsed.password) {
    throw new Error(
      `STAGING-URL-INVALID: URL must not contain userinfo (credentials). ` +
        `Got: '${redactUserinfo(rawUrl)}'`,
    )
  }

  // Require HTTPS
  if (parsed.protocol !== 'https:') {
    throw new Error(
      `STAGING-URL-INVALID: URL must use HTTPS. Got protocol: '${parsed.protocol}'. URL: '${rawUrl}'`,
    )
  }

  // Reject non-default port (HTTPS default is 443; URL.port is '' when default)
  if (parsed.port !== '') {
    throw new Error(
      `STAGING-URL-INVALID: URL must not specify a non-default port. Got port: '${parsed.port}'. URL: '${rawUrl}'`,
    )
  }

  // Exact hostname check — prevents suffix attacks and unrelated preview domains
  if (parsed.hostname !== new URL(STAGING_ORIGIN).hostname) {
    throw new Error(
      `STAGING-URL-INVALID: hostname must be exactly '${new URL(STAGING_ORIGIN).hostname}'. ` +
        `Got: '${parsed.hostname}'. URL: '${rawUrl}'`,
    )
  }

  // Must have no path, query, or hash (origin only)
  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
    throw new Error(
      `STAGING-URL-INVALID: URL must be the bare origin with no path, query, or hash. ` +
        `Got: '${rawUrl}'`,
    )
  }
}

function redactUserinfo(url: string): string {
  return url.replace(/\/\/[^@]*@/, '//[redacted]@')
}
