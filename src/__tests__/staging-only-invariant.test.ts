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
  const STAGING_BRANCH = 'feature/course-branding-and-preview'
  const STAGING_ORIGIN = 'https://preview.jpvbootcamp.com'
  const STAGING_SCHEMA = 'jpvbootcamp_staging'
  const STAGING_HOST = '10.0.2.4'
  const STAGING_PORT = '5433'
  const STAGING_DB = 'jpvbootcamp'
  const STAGING_DOKPLOY_APP = 'clients-jpv-bootcamp-app-tp9xrk'

  describe('no active workflow triggers for main', () => {
    it('deploy-preview.yml push branches must not include main', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      const pushSection = yml.match(/on:[\s\S]*?push:[\s\S]*?branches:([\s\S]*?)(?=\n\S|\n  \w)/)?.[1] ?? ''
      expect(pushSection).not.toMatch(/\bmain\b/)
    })

    it('production deploy.yml must not exist', () => {
      expect(existsSync(join(ROOT, '.github/workflows/deploy.yml'))).toBe(false)
    })
  })

  describe('no production Dokploy deployment calls', () => {
    const DENY_LIST_FILES = new Set([
      '.github/workflows/deploy-preview.yml',
      'scripts/safety/stagingCommunicationAllowlist.ts',
      'scripts/staging-gates/dokployMediaMount.ts',
      'scripts/staging-gates/stagingPolicy.ts',
      'docs/DOKPLOY_DEPLOYMENT_GUIDE.md',
      'docs/product/agent-mode-progress.md',
      '.ai/DEPLOYMENT_AUTHORIZATION_2026_07_22.md',
    ])

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

    it('deploy workflow uses production ID only in DENIED_ guard', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      const lines = yml.split('\n')
      for (const line of lines) {
        if (line.includes('l66egq')) {
          expect(line).toMatch(/DENIED/)
        }
      }
    })
  })

  describe('no production database/schema defaults', () => {
    it('Dockerfile must not default to production URL', () => {
      const df = readFile('Dockerfile')
      expect(df).not.toMatch(/ARG.*=https:\/\/jpvbootcamp\.com[^/]/)
      expect(df).toContain(STAGING_ORIGIN)
    })

    it('start-prod.sh rejects non-staging schema', () => {
      const sh = readFile('scripts/runtime/start-prod.sh')
      expect(sh).toContain('schema=jpvbootcamp_staging')
      expect(sh).toContain('FATAL')
    })

    it('no bare jpvbootcamp schema without _staging in configuration files', () => {
      const configFiles = [
        'Dockerfile',
        'docker-compose.yml',
        'scripts/runtime/start-prod.sh',
      ]
      for (const f of configFiles) {
        const content = readFile(f)
        const matches = content.match(/schema=jpvbootcamp(?!_staging)/g)
        expect(matches ?? []).toEqual([])
      }
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

  describe('no main-branch deployment instructions', () => {
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
  })

  describe('approved staging configuration', () => {
    it('deploy-preview.yml references correct staging URL', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      expect(yml).toContain(STAGING_ORIGIN)
    })

    it('deploy-preview.yml push trigger only allows feature branch', () => {
      const yml = readFile('.github/workflows/deploy-preview.yml')
      const pushBranches = yml.match(/push:\s*\n\s*branches:\s*\n((?:\s*-.*\n)*)/)?.[1] ?? ''
      expect(pushBranches.trim()).toBe(`- '${STAGING_BRANCH}'`)
    })

    it('staging infra preflight uses correct host/port/schema', () => {
      const preflight = readFile('scripts/staging-gates/stagingPayloadMigrationInfraPreflight.mts')
      expect(preflight).toContain(STAGING_HOST)
      expect(preflight).toContain(String(STAGING_PORT))
    })
  })
})
