/**
 * Deployment boundary policy.
 *
 * All staging deployment decisions must pass through assertStagingDeployment()
 * before any Dokploy API call. Fail closed — throws on any violation.
 *
 * Deny-list: web-public-jpv-bootcamp-l66egq is production; it must never be
 * targeted by any automated or scripted operation.
 */

export const STAGING_APP_ID = 'clients-jpv-bootcamp-app-tp9xrk'
export const STAGING_ORIGIN = 'https://preview.jpvbootcamp.com'
export const STAGING_BRANCH = 'feature/course-branding-and-preview'

/** Any app ID in this list must never be targeted. Fail closed. */
export const PRODUCTION_DENY_LIST = ['web-public-jpv-bootcamp-l66egq']

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
          `Only staging app '${STAGING_APP_ID}' is allowed.`,
      )
    }
  }

  // Exact app ID check — must match staging exactly
  if (ctx.appId !== STAGING_APP_ID) {
    throw new Error(
      `DEPLOY-DENIED: appId '${ctx.appId}' is not the allowed staging app ID '${STAGING_APP_ID}'.`,
    )
  }

  // Exact normalized HTTPS origin check
  assertStagingOrigin(ctx.origin)

  // Branch must be exactly the feature branch
  if (ctx.branch !== STAGING_BRANCH) {
    throw new Error(
      `DEPLOY-DENIED: branch '${ctx.branch}' is not the allowed staging branch '${STAGING_BRANCH}'.`,
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
  if (parsed.hostname !== 'preview.jpvbootcamp.com') {
    throw new Error(
      `STAGING-URL-INVALID: hostname must be exactly 'preview.jpvbootcamp.com'. ` +
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
