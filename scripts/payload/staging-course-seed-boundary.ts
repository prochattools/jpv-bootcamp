import {
  assertStagingSchema,
  resolveDatabaseConnectionConfig,
} from '../../src/lib/databaseConnectionConfig'
import { ENVIRONMENT_TOPOLOGY } from '../../src/lib/environmentTopology'

export type StagingCourseSeedTarget = {
  environment: 'staging'
  host: string
  port: string
  database: string
  schema: string
  role: string
}

export type CourseSeedExecutionPlan = {
  mode: 'dry-run' | 'apply'
  writesEnabled: boolean
  target?: StagingCourseSeedTarget
}

/**
 * Fail closed before a course QA seed may write. This intentionally checks the
 * raw DATABASE_URL (rather than a schema override) so an apply cannot mask a
 * wrong target behind process configuration.
 */
export function assertStagingCourseSeedApplyTarget(
  env: NodeJS.ProcessEnv = process.env,
): StagingCourseSeedTarget {
  if (env.DEPLOYMENT_ENV?.trim().toLowerCase() !== ENVIRONMENT_TOPOLOGY.staging.deploymentEnv) {
    throw new Error('COURSE-SEED-DENIED: DEPLOYMENT_ENV must be exactly staging for --apply')
  }

  const rawUrl = env.DATABASE_URL
  if (!rawUrl) {
    throw new Error('COURSE-SEED-DENIED: DATABASE_URL is required for --apply')
  }

  const config = resolveDatabaseConnectionConfig(rawUrl, undefined)
  assertStagingSchema(config)

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error('COURSE-SEED-DENIED: DATABASE_URL is not a valid PostgreSQL URL')
  }

  const expected = ENVIRONMENT_TOPOLOGY.staging
  const role = decodeURIComponent(parsed.username)
  const port = parsed.port || '5432'
  if (parsed.hostname !== expected.databaseHost) {
    throw new Error('COURSE-SEED-DENIED: DATABASE_URL host is not the approved staging host')
  }
  if (port !== expected.databasePort) {
    throw new Error('COURSE-SEED-DENIED: DATABASE_URL port is not the approved staging port')
  }
  if (role !== expected.databaseRole) {
    throw new Error('COURSE-SEED-DENIED: DATABASE_URL role is not the approved staging role')
  }

  return {
    environment: 'staging',
    host: expected.databaseHost,
    port: expected.databasePort,
    database: expected.database,
    schema: expected.schema,
    role: expected.databaseRole,
  }
}

/** The dry-run mode is deliberately non-mutating and remains generally usable. */
export function createCourseSeedExecutionPlan(
  apply: boolean,
  env: NodeJS.ProcessEnv = process.env,
): CourseSeedExecutionPlan {
  if (!apply) return { mode: 'dry-run', writesEnabled: false }

  return {
    mode: 'apply',
    writesEnabled: true,
    target: assertStagingCourseSeedApplyTarget(env),
  }
}
