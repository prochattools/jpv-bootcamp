import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { RELEASE_TEST_MANIFEST } from './release/releaseTestManifest'

function main(): void {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> }
  const readiness = readFileSync('docs/PREVIEW_RELEASE_READINESS.md', 'utf8')
  const handoff = readFileSync('docs/client/OPERATOR_HANDOFF_SUMMARY.md', 'utf8')
  const portalProgramme = readFileSync('src/app/(frontend)/portal/programme/page.tsx', 'utf8')
  const e2eSpec = readFileSync('e2e/portal-courses-community.spec.ts', 'utf8')
  const runtimeSource = walk('src')
    .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
  const removedRoot = `/${'learn'}`

  const requiredFiles = [
    'scripts/content/programmeContentContract.ts',
    'scripts/content/validateProgrammeContent.ts',
    'scripts/content/buildProgrammeAcceptanceReport.ts',
    'scripts/content/buildProgrammeImportPlan.ts',
    'scripts/content/fixtures/programme-content.example.json',
    'docs/client/PROGRAMME_CONTENT_INTAKE_TEMPLATE.md',
    'docs/client/PROGRAMME_CONTENT_APPROVAL_RECORD.md',
  ]

  for (const file of requiredFiles) {
    assert.equal(existsSync(file), true, `${file} must exist`)
  }

  assert.equal(
    packageJson.scripts?.['content:programme:validate'],
    'tsx scripts/content/validateProgrammeContent.ts',
  )
  assert.equal(
    packageJson.scripts?.['content:programme:acceptance'],
    'tsx scripts/content/buildProgrammeAcceptanceReport.ts',
  )
  assert.equal(
    packageJson.scripts?.['content:programme:import-plan'],
    'tsx scripts/content/buildProgrammeImportPlan.ts',
  )

  const manifestEntry = RELEASE_TEST_MANIFEST.find((entry) => entry.id === 'content.programme-readiness')
  assert.ok(manifestEntry, 'release manifest must include content.programme-readiness')
  assert.equal(manifestEntry?.command.args.join(' '), 'exec tsx scripts/programme_content_readiness.test.ts')

  assert.match(readiness, /programme content intake template/i)
  assert.match(readiness, /content:programme:validate/i)
  assert.match(readiness, /content:programme:acceptance/i)
  assert.match(readiness, /content:programme:import-plan/i)
  assert.match(readiness, /PROGRAMME_CONTENT_APPROVAL_RECORD\.md/)
  assert.match(readiness, /programme remains preview-only/i)

  assert.match(handoff, /PROGRAMME_CONTENT_INTAKE_TEMPLATE\.md/)
  assert.match(handoff, /PROGRAMME_CONTENT_APPROVAL_RECORD\.md/)
  assert.match(handoff, /content:programme:validate/)
  assert.match(handoff, /content:programme:acceptance/)
  assert.match(handoff, /content:programme:import-plan/)

  assert.match(portalProgramme, /Preview only/)
  assert.match(portalProgramme, /href=['"]\/portal\/billing['"]/)
  assert.match(portalProgramme, /approved content package/i)
  assert.doesNotMatch(portalProgramme, /scripts\/content\//)
  assert.doesNotMatch(portalProgramme, /programme-content\.example\.json/)
  assert.doesNotMatch(portalProgramme, /PROGRAMME_CONTENT_INTAKE_TEMPLATE\.md/)
  assert.doesNotMatch(runtimeSource, /programme-content\.example\.json/)
  assert.doesNotMatch(runtimeSource, /PROGRAMME_CONTENT_INTAKE_TEMPLATE\.md/)
  assert.doesNotMatch(runtimeSource, /PROGRAMME_CONTENT_APPROVAL_RECORD\.md/)
  assert.doesNotMatch(runtimeSource, /scripts\/content\/fixtures/)

  assert.match(e2eSpec, /programme preview remains explicit and non-publishable/i)
  assert.equal(e2eSpec.includes(removedRoot), false)

  console.log('programme_content_readiness.test.ts passed')
}

function walk(root: string): string[] {
  const output: string[] = []
  for (const entry of readdirSync(root)) {
    const absolute = path.join(root, entry)
    const stats = statSync(absolute)
    if (stats.isDirectory()) {
      output.push(...walk(absolute))
    } else {
      output.push(absolute)
    }
  }
  return output
}

try {
  main()
} catch (error) {
  console.error('programme_content_readiness.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
