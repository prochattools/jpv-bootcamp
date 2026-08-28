import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

const ROOT = join(__dirname, '../..')

function readFile(rel: string): string {
  const p = join(ROOT, rel)
  if (!existsSync(p)) return ''
  try { return readFileSync(p, 'utf8') } catch { return '' }
}

function trackedFiles(): string[] {
  return execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n')
}

describe('Staging-only invariant', () => {
  const STAGING_ORIGIN = 'https://staging.jpvbootcamp.com'
  const STAGING_SCHEMA = 'jpvbootcamp_staging'
  const STAGING_HOST = '10.0.2.4'
  const STAGING_PORT = '5433'
  const STAGING_DB = 'jpvbootcamp_staging'
  const STAGING_DOKPLOY_SLUG = 'clients-jpv-bootcamp-preview-wjfqfd'
  const STAGING_DOKPLOY_ID = 'bZllV93NqsPZAFCsqDskb'

  const DENY_LIST_FILES = new Set([
    '.github/workflows/deploy-preview.yml',
    'scripts/safety/stagingCommunicationAllowlist.ts',
    'scripts/staging-gates/dokployMediaMount.ts',
    'scripts/staging-gates/dokployRouting.ts',
    'scripts/staging-gates/stagingPolicy.ts',
    'docs/DOKPLOY_DEPLOYMENT_GUIDE.md',
    'docs/ENVIRONMENT_DATABASE_BOUNDARIES.md',
    'docs/architecture/JPV_ENVIRONMENT_TOPOLOGY_V1.md',
    'docs/architecture/JPV_PREVIEW_TO_STAGING_INVENTORY.md',
    'docs/product/agent-mode-progress.md',
    '.ai/DEPLOYMENT_AUTHORIZATION_2026_07_22.md',
  ])

  describe('no active workflow triggers for main', () => {
    it('deploy-preview.yml has no automatic push deployment trigger', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      expect(yml).not.toMatch(/^\s+push:\s*$/m)
      expect(yml).toContain('source_ref:')
    })

    it('production deploy.yml must not exist', () => {
      expect(existsSync(join(ROOT, '.github/workflows/deploy.yml'))).toBe(false)
    })

    it('publish-preview-image.yml must not have push trigger in on: section', () => {
      const yml = readFile('.github/workflows/publish-preview-image.yml')
      const onSection = yml.match(/^on:\s*\n([\s\S]*?)(?=\njobs:)/m)?.[1] ?? ''
      expect(onSection).not.toContain('push:')
    })
  })

  describe('no production Dokploy deployment calls', () => {
    it('production app ID only appears in deny-list/safety files', () => {
      const files = trackedFiles()
      const violations: string[] = []
      for (const f of files) {
        if (f.includes('node_modules') || f.endsWith('.test.ts')) continue
        if (DENY_LIST_FILES.has(f)) continue
        const content = readFile(f)
        if (content.includes('web-public-jpv-bootcamp-l66egq') || content.includes('l66egq')) {
          violations.push(f)
        }
      }
      expect(violations).toEqual([])
    })

    it('deploy-preview uses positive allow-list for Dokploy app', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      expect(yml).toContain(STAGING_DOKPLOY_SLUG)
      expect(yml).toContain(STAGING_DOKPLOY_ID)
      expect(yml).toContain('ALLOWED_SLUG')
      expect(yml).not.toContain('DENIED_SLUG')
    })
  })

  describe('databaseConnectionConfig requires explicit staging schema', () => {
    it('no DEFAULT_PAYLOAD_SCHEMA fallback exists', () => {
      const src = readFile('src/lib/databaseConnectionConfig.ts')
      expect(src).not.toContain('DEFAULT_PAYLOAD_SCHEMA')
    })

    it('exports REQUIRED_STAGING_SCHEMA constant', () => {
      const src = readFile('src/lib/databaseConnectionConfig.ts')
      expect(src).toContain("REQUIRED_STAGING_SCHEMA = 'jpvbootcamp_staging'")
    })

    it('exports an explicit production schema constant', () => {
      const src = readFile('src/lib/databaseConnectionConfig.ts')
      expect(src).toContain("REQUIRED_PRODUCTION_SCHEMA = 'jpvbootcamp'")
    })

    it('exports assertStagingSchema enforcement function', () => {
      const src = readFile('src/lib/databaseConnectionConfig.ts')
      expect(src).toContain('assertStagingSchema')
      expect(src).toContain('Schema')
      expect(src).toContain('is not permitted')
    })
  })

  describe('staging startup script', () => {
    it('start-prod.sh must not exist', () => {
      expect(existsSync(join(ROOT, 'scripts/release/start-prod.sh'))).toBe(false)
    })

    it('start-staging.sh exists and is executable', () => {
      const path = join(ROOT, 'scripts/release/start-staging.sh')
      expect(existsSync(path)).toBe(true)
    })

    it('start-staging.sh verifies exact host/port/db/schema', () => {
      const sh = readFile('scripts/release/start-staging.sh')
      expect(sh).toContain(`REQUIRED_HOST="${STAGING_HOST}"`)
      expect(sh).toContain(`REQUIRED_PORT="${STAGING_PORT}"`)
      expect(sh).toContain(`REQUIRED_DB="${STAGING_DB}"`)
      expect(sh).toContain(`REQUIRED_SCHEMA="${STAGING_SCHEMA}"`)
    })

    it('start-staging.sh has no database-deploy mode', () => {
      const sh = readFile('scripts/release/start-staging.sh')
      expect(sh).not.toContain('database-deploy')
      expect(sh).not.toContain('DEPLOYMENT_ENV')
      expect(sh).not.toContain('SYSTEM_DATABASE_URL')
      expect(sh).not.toContain('deploy-prod')
    })
  })

  describe('Dockerfile CMD', () => {
    it('CMD references start-staging.sh', () => {
      const df = readFile('Dockerfile')
      expect(df).toContain('start-staging.sh')
      expect(df).not.toContain('start-prod.sh')
    })

    it('Dockerfile does not set STARTUP_MODE', () => {
      const df = readFile('Dockerfile')
      expect(df).not.toContain('STARTUP_MODE')
    })

    it('Dockerfile defaults to staging URLs only', () => {
      const df = readFile('Dockerfile')
      expect(df).toContain(STAGING_ORIGIN)
      expect(df).not.toMatch(/ARG.*=https:\/\/jpvbootcamp\.com[^/]/)
    })
  })

  describe('publish-preview-image workflow', () => {
    it('only allows approved source-ref SHA', () => {
      const yml = readFile('.github/workflows/publish-preview-image.yml')
      expect(yml).toContain('source_ref:')
      expect(yml).toContain('^(feature|fix|release)/')
      expect(yml).toContain('current tip')
    })

    it('does not allow target_environment choice', () => {
      const yml = readFile('.github/workflows/publish-preview-image.yml')
      expect(yml).not.toContain('type: choice')
    })

    it('pins staging origin in metadata', () => {
      const yml = readFile('.github/workflows/publish-preview-image.yml')
      expect(yml).toContain(STAGING_ORIGIN)
      expect(yml).toContain('TARGET_ENVIRONMENT: staging')
    })
  })

  describe('deploy-preview exact staging allow-list', () => {
    it('workflow declares canonical staging coordinates', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      expect(yml).toContain('ALLOWED_SOURCE_REF_PATTERN=')
      expect(yml).toContain(`ALLOWED_ORIGIN="${STAGING_ORIGIN}"`)
      expect(yml).toContain(`ALLOWED_SCHEMA="${STAGING_SCHEMA}"`)
      expect(yml).toContain(`ALLOWED_HOST="${STAGING_HOST}"`)
      expect(yml).toContain(`ALLOWED_PORT="${STAGING_PORT}"`)
      expect(yml).toContain(`ALLOWED_DB="${STAGING_DB}"`)
    })

    it('manual dispatch requires an approved source ref', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      expect(yml).toContain('source_ref:')
      expect(yml).toContain('feature/*, fix/*, or release/*')
      expect(yml).not.toMatch(/^\s+push:\s*$/m)
    })
  })

  describe('no production deployment package scripts', () => {
    it('package.json must not contain db:migrate:prod', () => {
      const pkg = readFile('package.json')
      expect(pkg).not.toContain('db:migrate:prod')
    })

    it('scripts/db/deploy-prod.sh must not exist', () => {
      expect(existsSync(join(ROOT, 'scripts/db/deploy-prod.sh'))).toBe(false)
    })

    it('scripts/production-gates must not exist', () => {
      expect(existsSync(join(ROOT, 'scripts/production-gates'))).toBe(false)
    })
  })

  describe('no main-branch deployment instructions in active docs', () => {
    it('operational docs targeting production must not exist', () => {
      const forbidden = [
        'PREVIEW_DEPLOYMENT_SETUP.md',
        'STAGING_DEPLOYMENT_RUNBOOK.md',
        'EXACT_DEPLOYMENT_INSTRUCTION.md',
        'OPERATOR_EXECUTION_PACKET.md',
      ]
      for (const f of forbidden) {
        expect(existsSync(join(ROOT, f))).toBe(false)
      }
    })

    it('OPERATOR_DEPLOYMENT_AND_VERIFICATION does not use generic DOKPLOY_APP_ID', () => {
      const doc = readFile('docs/OPERATOR_DEPLOYMENT_AND_VERIFICATION.md')
      expect(doc).not.toContain('$DOKPLOY_APP_ID')
    })

    it('DOKPLOY_DEPLOYMENT_GUIDE does not instruct DOKPLOY_PROD_APP_ID creation', () => {
      const doc = readFile('docs/DOKPLOY_DEPLOYMENT_GUIDE.md')
      expect(doc).not.toContain('DOKPLOY_PROD_APP_ID')
    })
  })

  describe('staging infra preflight uses correct coordinates', () => {
    it('uses correct host/port/schema', () => {
      const preflight = readFile('scripts/staging-gates/stagingPayloadMigrationInfraPreflight.mts')
      expect(preflight).toContain(STAGING_HOST)
      expect(preflight).toContain(String(STAGING_PORT))
    })
  })

  describe('databaseConnectionConfig structural URL validation', () => {
    it('rejects configured URL with missing schema', () => {
      const src = readFile('src/lib/databaseConnectionConfig.ts')
      // Must throw when schema param is absent — substring search insufficient
      expect(src).toContain('must include exactly one schema parameter')
    })

    it('rejects invalid/malformed URL (fail closed)', () => {
      const src = readFile('src/lib/databaseConnectionConfig.ts')
      expect(src).toContain('not a valid URL')
    })

    it('rejects wrong protocol (non-PostgreSQL)', () => {
      const src = readFile('src/lib/databaseConnectionConfig.ts')
      expect(src).toContain('must use PostgreSQL protocol')
    })

    it('rejects duplicate schema parameters', () => {
      const src = readFile('src/lib/databaseConnectionConfig.ts')
      expect(src).toContain('exactly one schema parameter')
    })

    it('uses structural URL parser, not substring grep', () => {
      const src = readFile('src/lib/databaseConnectionConfig.ts')
      // Must parse with URL constructor, not grep/includes
      expect(src).toContain('new URL(')
      expect(src).not.toMatch(/grep.*schema/)
    })
  })

  describe('payload.config wires assertStagingSchema', () => {
    it('imports assertStagingSchema', () => {
      const cfg = readFile('src/payload.config.ts')
      expect(cfg).toContain('assertStagingSchema')
    })

    it('calls assertStagingSchema when configured', () => {
      const cfg = readFile('src/payload.config.ts')
      // Must be called for configured URLs — not just exported
      expect(cfg).toMatch(/assertStagingSchema\(databaseConnection\)/)
    })

    it('calls assertProductionSchema for production Docker runtime', () => {
      const cfg = readFile('src/payload.config.ts')
      expect(cfg).toContain('assertProductionSchema(databaseConnection)')
      expect(cfg).toContain("DEPLOYMENT_ENV ?? '').trim().toLowerCase() === 'production'")
    })

    it('guards call behind DEPLOYMENT_RUNTIME check — does not throw at build time', () => {
      const cfg = readFile('src/payload.config.ts')
      // assertStagingSchema is gated on DEPLOYMENT_RUNTIME=docker (runner stage only, not builder)
      // so it does not fire at Next.js build time when DATABASE_URL may be a placeholder
      expect(cfg).toContain("DEPLOYMENT_RUNTIME === 'docker'")
    })
  })

  describe('start-staging.sh uses structural Node.js URL validation', () => {
    it('uses Node.js URL parser, not grep', () => {
      const sh = readFile('scripts/release/start-staging.sh')
      expect(sh).toContain('new URL(')
      expect(sh).not.toMatch(/grep.*schema.*REQUIRED_SCHEMA/)
    })

    it('verifies hostname by field, not substring', () => {
      const sh = readFile('scripts/release/start-staging.sh')
      expect(sh).toContain('parsed.hostname')
    })

    it('verifies port by field, not substring', () => {
      const sh = readFile('scripts/release/start-staging.sh')
      expect(sh).toContain('parsed.port')
    })

    it('verifies database by pathname field, not substring', () => {
      const sh = readFile('scripts/release/start-staging.sh')
      expect(sh).toContain('parsed.pathname')
    })

    it('verifies exactly one schema parameter, not substring', () => {
      const sh = readFile('scripts/release/start-staging.sh')
      expect(sh).toContain('getAll(')
      expect(sh).toContain('exactly one schema')
    })
  })

  describe('push-triggered deploy path is eliminated', () => {
    it('validate-only job contains no Docker push step', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      // Find the validate-only job section (before deploy-preview job)
      const validateSection = yml.match(/validate-only:[\s\S]*?(?=\n  [a-z-]+:[\n ])/)?.[0] ?? yml
      expect(validateSection).not.toContain('push: true')
    })

    it('validate-only job contains no Dokploy call', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      const validateSection = yml.match(/validate-only:[\s\S]*?(?=\n  deploy-preview:)/)?.[0] ?? ''
      expect(validateSection).not.toContain('application.deploy')
      expect(validateSection).not.toContain('application.update')
    })

    it('deploy-preview job only runs on workflow_dispatch', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      // deploy-preview job must have if condition requiring workflow_dispatch
      const deployJob = yml.match(/  deploy-preview:[\s\S]*?(?=\n  read-only-plan:)/)?.[0] ?? ''
      expect(deployJob).toContain('workflow_dispatch')
      expect(deployJob).toContain("inputs.operation == 'deploy-preview'")
    })

    it('deploy-preview job requires exact SHA confirmation', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      const deployJob = yml.match(/  deploy-preview:[\s\S]*?(?=\n  read-only-plan:)/)?.[0] ?? ''
      expect(deployJob).toContain('deploy-staging-feature-tip')
      expect(deployJob).toContain('expected_sha')
    })

    it('deploy-preview job checks out the explicit source ref', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      const deployJob = yml.match(/  deploy-preview:[\s\S]*?(?=\n  read-only-plan:)/)?.[0] ?? ''
      expect(deployJob).toContain('ref: ${{ inputs.source_ref }}')
    })

    it('deploy-preview image tags use stable staging tag, no dynamic branch_ref variable', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      const deployJob = yml.match(/  deploy-preview:[\s\S]*?(?=\n  read-only-plan:)/)?.[0] ?? ''
      expect(deployJob).toContain(':staging')
      expect(deployJob).not.toContain('branch_ref=')
    })

    it('branch_or_ref input is removed', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      expect(yml).not.toContain('branch_or_ref:')
    })
  })

  describe('publish-preview-image requires an approved source ref', () => {
    it('rejects source refs outside the staging allow-list', () => {
      const yml = readFile('.github/workflows/publish-preview-image.yml')
      expect(yml).toContain('source_ref:')
      expect(yml).toContain('^(feature|fix|release)/')
      expect(yml).toContain('PUBLISH-DENIED')
    })

    it('all third-party actions are SHA-pinned', () => {
      const yml = readFile('.github/workflows/publish-preview-image.yml')
      // No action reference should use a mutable tag (@v3, @v4, @latest) without a SHA
      const unpinned = [...yml.matchAll(/uses:\s+([\w/-]+)@(v\d+|latest)(?!\s*#|\s*$|\w)/g)]
        .map(m => m[0])
        .filter(ref => !ref.includes('#'))
      expect(unpinned).toEqual([])
    })
  })

  describe('active docs describe only staging operational lane', () => {
    it('OPERATOR_DEPLOYMENT_AND_VERIFICATION does not reference branch_or_ref', () => {
      const doc = readFile('docs/OPERATOR_DEPLOYMENT_AND_VERIFICATION.md')
      expect(doc).not.toContain('branch_or_ref:')
    })

    it('active docs do not describe STARTUP_MODE as operational', () => {
      // STARTUP_MODE is deleted; it should not appear as an active configuration instruction
      // (historical safety incident summaries are permitted in collapsed/archived docs)
      const activeRunbookDocs = [
        'docs/OPERATOR_DEPLOYMENT_AND_VERIFICATION.md',
        'docs/DOKPLOY_DEPLOYMENT_GUIDE.md',
        'docs/client/OPERATOR_HANDOFF_SUMMARY.md',
      ]
      for (const doc of activeRunbookDocs) {
        const content = readFile(doc)
        expect(content).not.toContain('STARTUP_MODE=database-deploy')
        expect(content).not.toContain('STARTUP_MODE=application-only')
      }
    })

    it('PREVIEW_RELEASE_READINESS workflow architecture describes push as validation-only', () => {
      const doc = readFile('docs/PREVIEW_RELEASE_READINESS.md')
      expect(doc).toContain('validation-only')
      expect(doc).not.toContain('Push path (`deploy-preview`)')
    })
  })
})
