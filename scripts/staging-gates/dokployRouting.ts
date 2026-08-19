/**
 * Staging routing guard for Dokploy application.update (labelsSwarm).
 *
 * Root cause of routing loss after each deploy:
 * - Dokploy's file provider writes Traefik config to its container-internal
 *   /etc/dokploy/traefik/dynamic/ — NOT to the host path that Traefik reads.
 * - Docker Swarm service labels survive as long as labelsSwarm is stored in
 *   Dokploy's DB. If labelsSwarm=NULL (as with the staging app), labels are
 *   absent from the service spec on every redeploy.
 *
 * Fix: call application.update with labelsSwarm set to the Traefik routing
 * labels before application.deploy. Dokploy persists labelsSwarm in its DB and
 * includes them in the Docker service spec on every deploy.
 *
 * The Traefik Swarm provider picks up the labels automatically.
 *
 * Confirmed label format from the production app (web-public-jpv-bootcamp-l66egq):
 *   traefik.enable=true
 *   traefik.http.routers.<name>.entrypoints=web,websecure
 *   traefik.http.routers.<name>.rule=Host(`<hostname>`)
 *   traefik.http.routers.<name>.service=<name>
 *   traefik.http.services.<name>.loadbalancer.server.port=3000
 *   traefik.docker.network=dokploy-network
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

/** Router/service name suffix for the staging app Traefik labels. */
const ROUTER_NAME = `${STAGING_APP_ID}-web`

/**
 * The canonical Traefik routing labels for the staging app.
 * These match the production app label format exactly.
 * They are persisted in Dokploy's DB as labelsSwarm and applied on every deploy.
 */
export const STAGING_TRAEFIK_LABELS: Record<string, string> = {
  'traefik.enable': 'true',
  [`traefik.http.routers.${ROUTER_NAME}.entrypoints`]: 'web,websecure',
  [`traefik.http.routers.${ROUTER_NAME}.rule`]: `Host(\`${STAGING_DOMAIN_HOST}\`)`,
  [`traefik.http.routers.${ROUTER_NAME}.service`]: ROUTER_NAME,
  [`traefik.http.services.${ROUTER_NAME}.loadbalancer.server.port`]: '3000',
  'traefik.docker.network': 'dokploy-network',
}

/**
 * Assert that a routing update targets only the known staging app.
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
 * Build the application.update payload that persists labelsSwarm in Dokploy's DB.
 *
 * application.deploy reads labelsSwarm from the DB and applies it to the
 * Docker service spec. Setting it here means every future deploy includes
 * the Traefik routing labels without any manual intervention.
 */
export function buildApplicationUpdatePayload(): Record<string, unknown> {
  return {
    applicationId: STAGING_DOKPLOY_APPLICATION_ID,
    labelsSwarm: STAGING_TRAEFIK_LABELS,
  }
}
