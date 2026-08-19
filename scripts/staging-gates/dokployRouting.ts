/**
 * Staging routing guard for Dokploy domain.update calls.
 *
 * Dokploy routes HTTP traffic via the Traefik file provider:
 * /etc/dokploy/traefik/dynamic/<appName>.yml is written by manageDomain().
 * manageDomain() is called on domain CREATE and UPDATE — not on application.deploy.
 * After every Dokploy redeploy the file may be stale/absent; calling domain.update
 * forces manageDomain() to re-write it, restoring Traefik routing without manual
 * docker service label manipulation.
 *
 * See: Dokploy server.mjs — domain.update mutation → Hh() (manageDomain)
 */

import {
  assertStagingDeployment,
  STAGING_APP_ID,
  STAGING_BRANCH,
  STAGING_ORIGIN,
  PRODUCTION_DENY_LIST,
} from './stagingPolicy'
import { STAGING_DOKPLOY_APPLICATION_ID } from './dokployMediaMount'

/** The staging domain record ID in Dokploy's DB. */
export const STAGING_DOMAIN_ID = 'lLeympWtBHVcL6R9JeyZQ'

/** The canonical staging domain hostname. */
export const STAGING_DOMAIN_HOST = 'preview.jpvbootcamp.com'

/**
 * Assert that a domain update targets only the known staging domain and app.
 * Throws on any violation — fail closed.
 */
export function assertStagingRoutingTarget(domainId: string, appId: string): void {
  // Deny-list check first — production IDs must never be touched
  for (const deniedId of PRODUCTION_DENY_LIST) {
    if (appId === deniedId) {
      throw new Error(
        `ROUTING-DENIED: appId '${appId}' is on the production deny-list. ` +
          `Denied IDs: [${PRODUCTION_DENY_LIST.join(', ')}]. ` +
          `Only staging app '${STAGING_APP_ID}' / '${STAGING_DOKPLOY_APPLICATION_ID}' is allowed.`,
      )
    }
    if (domainId === deniedId) {
      throw new Error(
        `ROUTING-DENIED: domainId '${domainId}' is on the production deny-list.`,
      )
    }
  }

  // Domain ID must be exactly the documented staging domain
  if (domainId !== STAGING_DOMAIN_ID) {
    throw new Error(
      `ROUTING-DENIED: domainId '${domainId}' is not the allowed staging domain ID '${STAGING_DOMAIN_ID}'.`,
    )
  }

  // App ID must be exactly the staging app (slug or internal ID)
  if (appId !== STAGING_APP_ID && appId !== STAGING_DOKPLOY_APPLICATION_ID) {
    throw new Error(
      `ROUTING-DENIED: appId '${appId}' is not the allowed staging app ID. ` +
        `Allowed: '${STAGING_APP_ID}' or '${STAGING_DOKPLOY_APPLICATION_ID}'.`,
    )
  }

  // Full deployment context check — origin and branch
  assertStagingDeployment({
    appId: STAGING_APP_ID,
    origin: STAGING_ORIGIN,
    branch: STAGING_BRANCH,
  })
}

/**
 * Build the minimal domain.update payload that triggers manageDomain.
 *
 * Sends the existing staging domain values back unchanged — the update itself is
 * the side-effect that causes Dokploy to re-write the Traefik config file.
 */
export function buildDomainUpdatePayload(): Record<string, unknown> {
  return {
    domainId: STAGING_DOMAIN_ID,
    host: STAGING_DOMAIN_HOST,
    https: false,
    certificateType: 'none',
  }
}
