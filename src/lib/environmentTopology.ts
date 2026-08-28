/**
 * Non-secret environment identity contract.
 *
 * This module is intentionally limited to stable names, URLs, and database
 * metadata. Credentials belong to the runtime environment and must never be
 * committed here or printed by diagnostics.
 */

export const ENVIRONMENT_TOPOLOGY = {
  production: {
    deploymentEnv: 'production',
    origin: 'https://jpvbootcamp.com',
    dokploySlug: 'clients-jpv-bootcamp-app-tp9xrk',
    dokployApplicationId: 'I_2Vukga3cc3ZhaG-mUzU',
    databaseHost: '10.0.2.4',
    databasePort: '5433',
    database: 'jpvbootcamp',
    schema: 'jpvbootcamp',
    databaseRole: 'jpvbootcamp_staging_user',
    sourceRef: 'main',
  },
  staging: {
    deploymentEnv: 'staging',
    origin: 'https://staging.jpvbootcamp.com',
    dokploySlug: 'clients-jpv-bootcamp-preview-wjfqfd',
    dokployApplicationId: 'bZllV93NqsPZAFCsqDskb',
    databaseHost: '10.0.2.4',
    databasePort: '5433',
    database: 'jpvbootcamp_staging',
    schema: 'jpvbootcamp_staging',
    databaseRole: 'jpvbootcamp_staging_user',
    sourceRef: 'feature/* | fix/* | release/*',
  },
  legacy: {
    deploymentEnv: 'legacy',
    origin: 'https://legacy.jpvbootcamp.com',
    dokploySlug: 'web-public-jpv-bootcamp-l66egq',
    dokployApplicationId: 'aPR9SvYn_JvGdMTk3CzeI',
    databaseHost: '10.0.2.4',
    databasePort: '5433',
    database: 'jpvbootcamp_legacy',
    schema: 'jpvbootcamp',
    databaseRole: 'jpvbootcamp_user',
    sourceRef: 'frozen legacy runtime',
  },
} as const

/** Approved source refs for a staging candidate. `main` is never accepted. */
export const STAGING_SOURCE_REF_PATTERN = /^(feature|fix|release)\/[A-Za-z0-9][A-Za-z0-9._-]*$/

export function isAllowedStagingSourceRef(sourceRef: string): boolean {
  return STAGING_SOURCE_REF_PATTERN.test(sourceRef.trim())
}
