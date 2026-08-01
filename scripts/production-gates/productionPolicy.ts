/**
 * Production deployment boundary policy.
 *
 * All production deployment decisions must pass through assertProductionDeployment()
 * before any Dokploy API call. Fail closed — throws on any violation.
 *
 * Canonical production app ID: web-public-jpv-bootcamp-l66egq
 * Canonical production origin: https://jpvbootcamp.com
 * Canonical production branch: main
 *
 * Staging app ID and origin are deny-listed here so this policy cannot be
 * accidentally pointed at staging.
 */

export const PRODUCTION_APP_ID = 'web-public-jpv-bootcamp-l66egq'
export const PRODUCTION_ORIGIN = 'https://jpvbootcamp.com'
export const PRODUCTION_BRANCH = 'main'

/** Staging identifiers that must never be targeted by production deployment. */
export const STAGING_DENY_LIST = [
  'clients-jpv-bootcamp-app-tp9xrk',
  'I_2Vukga3cc3ZhaG-mUzU',
]
export const STAGING_ORIGIN_DENY_LIST = ['https://preview.jpvbootcamp.com']

export interface ProductionDeploymentContext {
  appId: string
  origin: string
  branch: string
  expectedSha: string
}

/**
 * Assert that a deployment context targets only the allowed production environment.
 * Throws a descriptive PRODUCTION-DEPLOY-DENIED error for any violation.
 */
export function assertProductionDeployment(ctx: ProductionDeploymentContext): void {
  // Deny staging app IDs first — fail closed before any other check.
  for (const deniedId of STAGING_DENY_LIST) {
    if (ctx.appId === deniedId) {
      throw new Error(
        'PRODUCTION-DEPLOY-DENIED: supplied application ID is a denied staging identifier.',
      )
    }
  }

  // Deny staging origins without echoing the supplied value.
  for (const deniedOrigin of STAGING_ORIGIN_DENY_LIST) {
    if (ctx.origin === deniedOrigin || ctx.origin.startsWith(deniedOrigin)) {
      throw new Error('PRODUCTION-DEPLOY-DENIED: supplied origin is a denied staging origin.')
    }
  }

  if (!ctx.appId) {
    throw new Error('PRODUCTION-DEPLOY-DENIED: application ID is required.')
  }

  if (ctx.appId !== PRODUCTION_APP_ID) {
    throw new Error(
      'PRODUCTION-DEPLOY-DENIED: supplied application ID does not match the canonical production application.',
    )
  }

  assertProductionOrigin(ctx.origin)

  if (ctx.branch !== PRODUCTION_BRANCH) {
    throw new Error('PRODUCTION-DEPLOY-DENIED: supplied branch is not the production branch.')
  }

  if (!/^[0-9a-f]{40}$/.test(ctx.expectedSha)) {
    throw new Error(
      'PRODUCTION-DEPLOY-DENIED: supplied SHA must be a full lowercase 40-character hexadecimal commit SHA.',
    )
  }
}

/**
 * Assert that a URL string is exactly the production origin.
 * Rejects: staging origin, suffix domains, userinfo, non-HTTPS, non-default port,
 * path/query/hash suffixes.
 */
export function assertProductionOrigin(rawUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error(`PRODUCTION-URL-INVALID: cannot parse URL: '${redactUserinfo(rawUrl)}'`)
  }

  // Reject any userinfo (credentials in URL)
  if (parsed.username || parsed.password) {
    throw new Error(
      `PRODUCTION-URL-INVALID: URL must not contain userinfo (credentials). ` +
        `Got: '${redactUserinfo(rawUrl)}'`,
    )
  }

  // Require HTTPS
  if (parsed.protocol !== 'https:') {
    throw new Error(
      `PRODUCTION-URL-INVALID: URL must use HTTPS. Got protocol: '${parsed.protocol}'. URL: '${rawUrl}'`,
    )
  }

  // Reject non-default port
  if (parsed.port !== '') {
    throw new Error(
      `PRODUCTION-URL-INVALID: URL must not specify a non-default port. Got port: '${parsed.port}'. URL: '${rawUrl}'`,
    )
  }

  // Exact hostname — must be jpvbootcamp.com, not preview.jpvbootcamp.com or any other variant
  if (parsed.hostname !== 'jpvbootcamp.com') {
    throw new Error(
      `PRODUCTION-URL-INVALID: hostname must be exactly 'jpvbootcamp.com'. ` +
        `Got: '${parsed.hostname}'. URL: '${rawUrl}'`,
    )
  }

  // Must have no path beyond /, no query, no hash
  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
    throw new Error(
      `PRODUCTION-URL-INVALID: URL must be the bare origin with no path, query, or hash. ` +
        `Got: '${rawUrl}'`,
    )
  }
}

function redactUserinfo(url: string): string {
  return url.replace(/\/\/[^@]*@/, '//[redacted]@')
}
