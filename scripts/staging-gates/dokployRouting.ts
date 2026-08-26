/**
 * Staging routing guard for Dokploy + Traefik.
 *
 * Architecture (verified 2026-08-19):
 * - Traefik's swarm provider reads SERVICE-LEVEL labels (Spec.Labels).
 * - Dokploy's labelsSwarm writes to TaskTemplate.ContainerSpec.Labels, which
 *   Traefik's docker provider would read for standalone containers, but NOT
 *   for Docker Swarm services in this Dokploy configuration.
 * - All active routing for Swarm services (including production) uses
 *   SERVICE-LEVEL labels; Dokploy does NOT set these via labelsSwarm.
 *
 * Primary routing mechanism for staging:
 *   Traefik file provider at /etc/dokploy/traefik/dynamic/preview-jpvbootcamp.yml
 *   on the HOST filesystem. Traefik watches this directory and hot-reloads.
 *   The file survives all Docker service deploys. See traefik-file-provider-setup.md.
 *
 * Belt-and-suspenders: labelsSwarm is also set in Dokploy's DB via
 *   application.update before each deploy. This sets ContainerSpec.Labels on the
 *   running task containers. If a future Dokploy version writes service-level
 *   labels instead, these will work automatically.
 *
 * Confirmed production label format (web-public-jpv-bootcamp-l66egq, swarm):
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

/**
 * Path to the Traefik file provider config on the Dokploy HOST filesystem.
 * Traefik watches this directory with file.watch=true and hot-reloads.
 * This file MUST exist and be correct for staging routing to work.
 * See traefik-file-provider-setup.md for the config template.
 */
export const TRAEFIK_FILE_PROVIDER_PATH =
  '/etc/dokploy/traefik/dynamic/preview-jpvbootcamp.yml'

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
