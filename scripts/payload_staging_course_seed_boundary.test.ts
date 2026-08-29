import assert from 'node:assert/strict'

import {
  assertStagingCourseSeedApplyTarget,
  createCourseSeedExecutionPlan,
} from './payload/staging-course-seed-boundary'

const stagingEnv = {
  DEPLOYMENT_ENV: 'staging',
  DATABASE_URL: 'postgresql://jpvbootcamp_staging_app:masked@10.0.2.4:5433/jpvbootcamp_staging?schema=jpvbootcamp',
}

const target = assertStagingCourseSeedApplyTarget(stagingEnv)
assert.deepEqual(target, {
  environment: 'staging',
  host: '10.0.2.4',
  port: '5433',
  database: 'jpvbootcamp_staging',
  schema: 'jpvbootcamp',
  role: 'jpvbootcamp_staging_app',
})

const dryRun = createCourseSeedExecutionPlan(false, {
  DEPLOYMENT_ENV: 'production',
  DATABASE_URL: 'not-a-url',
})
assert.deepEqual(dryRun, { mode: 'dry-run', writesEnabled: false })

const apply = createCourseSeedExecutionPlan(true, stagingEnv)
assert.equal(apply.mode, 'apply')
assert.equal(apply.writesEnabled, true)
assert.deepEqual(apply.target, target)

for (const [name, env, message] of [
  ['missing environment', { ...stagingEnv, DEPLOYMENT_ENV: '' }, /DEPLOYMENT_ENV must be exactly staging/],
  ['production environment', { ...stagingEnv, DEPLOYMENT_ENV: 'production' }, /DEPLOYMENT_ENV must be exactly staging/],
  ['legacy database', { ...stagingEnv, DATABASE_URL: 'postgresql://jpvbootcamp_user:masked@10.0.2.4:5433/jpvbootcamp_legacy?schema=jpvbootcamp' }, /Database 'jpvbootcamp_legacy' is not permitted/],
  ['production database', { ...stagingEnv, DATABASE_URL: 'postgresql://jpvbootcamp_staging_user:masked@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp' }, /Database 'jpvbootcamp' is not permitted/],
  ['wrong host', { ...stagingEnv, DATABASE_URL: 'postgresql://jpvbootcamp_staging_app:masked@10.0.2.5:5433/jpvbootcamp_staging?schema=jpvbootcamp' }, /host is not the approved staging host/],
  ['wrong role', { ...stagingEnv, DATABASE_URL: 'postgresql://jpvbootcamp_staging_user:masked@10.0.2.4:5433/jpvbootcamp_staging?schema=jpvbootcamp' }, /role is not the approved staging role/],
  ['wrong schema', { ...stagingEnv, DATABASE_URL: 'postgresql://jpvbootcamp_staging_app:masked@10.0.2.4:5433/jpvbootcamp_staging?schema=public' }, /Schema 'public' is not permitted/],
] as const) {
  assert.throws(() => assertStagingCourseSeedApplyTarget(env), message, name)
}

console.log('payload staging course seed boundary tests passed')
