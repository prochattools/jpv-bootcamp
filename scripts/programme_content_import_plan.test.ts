import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildProgrammeImportPlan,
  buildProgrammeImportPlanMarkdown,
  checksumText,
  parseProgrammeContentPackage,
  stablePackageJson,
  validateProgrammeContentPackage,
} from './content/programmeContentContract'

const FIXTURE_PATH = 'scripts/content/fixtures/programme-content.example.json'

function loadPlan() {
  const packageData = parseProgrammeContentPackage(JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')))
  const validation = validateProgrammeContentPackage(
    packageData,
    FIXTURE_PATH,
    FIXTURE_PATH,
    checksumText(stablePackageJson(packageData)),
  )
  return buildProgrammeImportPlan(validation)
}

function main(): void {
  const plan = loadPlan()
  const markdown = buildProgrammeImportPlanMarkdown(plan)

  assert.equal(plan.structuralValid, true)
  assert.equal(plan.releaseEligible, false)
  assert.equal(plan.operations.some((entry) => entry.action === 'create' && entry.kind === 'programme'), true)
  assert.equal(plan.operations.some((entry) => entry.kind === 'week'), true)
  assert.equal(plan.operations.some((entry) => entry.kind === 'lesson'), true)
  assert.equal(plan.operations.some((entry) => entry.kind === 'resource'), true)
  assert.equal(plan.destructiveOperationWarnings.includes('Import is blocked because the package is not release-eligible.'), true)
  assert.equal(plan.entitlementImplications.some((entry) => entry.includes('controlled Free and Pro access states only')), true)
  assert.match(markdown, /Create/)
  assert.match(markdown, /Archive or Defer/)
  assert.equal(buildProgrammeImportPlanMarkdown(plan), markdown)

  console.log('programme_content_import_plan.test.ts passed')
}

try {
  main()
} catch (error) {
  console.error('programme_content_import_plan.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
