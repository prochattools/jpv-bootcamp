#!/usr/bin/env -S npx tsx

/**
 * Local-only evidence artifact generator.
 *
 * Creates DRAFT evidence files from templates for operator use.
 * Does not apply migrations, touch databases, or access network.
 * Does not mark checks as passed — operator fills evidence manually.
 */

import * as fs from 'fs'
import * as path from 'path'

const EVIDENCE_DIR = 'docs/client/evidence'
const STAGING_SMOKE_TEMPLATE = 'docs/client/STAGING_SMOKE_EVIDENCE_TEMPLATE.md'
const PROVIDER_EMAIL_TEMPLATE = 'docs/client/PROVIDER_EMAIL_EVIDENCE_TEMPLATE.md'

function showHelp() {
  console.log(`Usage: pnpm evidence:create
   or: tsx scripts/create_staging_evidence_artifacts.ts

Generate local DRAFT evidence files for operator use.

This command is local-only:
- no migrations are applied
- no database access occurs
- no network access occurs
- no .env files are read
- generated drafts do not prove checks passed
- operator must fill evidence manually during actual staging smoke/provider checks
`)
}

const DRAFT_HEADER = `<!-- DRAFT ONLY -->
<!-- This file is a template draft and does not represent actual evidence. -->
<!-- Operator must fill in results manually during actual staging smoke and provider checks. -->
<!-- Migrations applied: No -->
<!-- Branch: feature/course-branding-and-preview -->
<!-- Do not paste secrets, API keys, or private keys into this document. -->
<!-- Do not touch main branch. -->

`

function ensureDir() {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true })
    console.log(`✓ Created evidence directory: ${EVIDENCE_DIR}`)
  }
}

function validateTemplates(): boolean {
  if (!fs.existsSync(STAGING_SMOKE_TEMPLATE)) {
    console.error(`✗ Template not found: ${STAGING_SMOKE_TEMPLATE}`)
    return false
  }
  if (!fs.existsSync(PROVIDER_EMAIL_TEMPLATE)) {
    console.error(`✗ Template not found: ${PROVIDER_EMAIL_TEMPLATE}`)
    return false
  }
  return true
}

function createDraftFile(templatePath: string, outputFileName: string): boolean {
  try {
    const templateContent = fs.readFileSync(templatePath, 'utf-8')
    const draftContent = DRAFT_HEADER + templateContent
    const outputPath = path.join(EVIDENCE_DIR, outputFileName)
    fs.writeFileSync(outputPath, draftContent, 'utf-8')
    console.log(`✓ Generated: ${outputPath}`)
    return true
  } catch (err) {
    console.error(`✗ Failed to create ${outputFileName}:`, err)
    return false
  }
}

function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    showHelp()
    process.exit(0)
  }

  ensureDir()

  if (!validateTemplates()) {
    console.error('✗ Template validation failed')
    process.exit(1)
  }

  let success = true

  // Generate staging smoke evidence draft
  success = createDraftFile(
    STAGING_SMOKE_TEMPLATE,
    'staging-smoke-evidence-DRAFT.md'
  ) && success

  // Generate provider/email evidence draft
  success = createDraftFile(
    PROVIDER_EMAIL_TEMPLATE,
    'provider-email-evidence-DRAFT.md'
  ) && success

  if (!success) {
    console.error('✗ One or more draft files failed to generate')
    process.exit(1)
  }

  console.log(`\n✓ Evidence artifact generation complete.`)
  console.log(`  Location: ${path.resolve(EVIDENCE_DIR)}`)
  console.log(`  Remember: These are DRAFT files only.`)
  console.log(`  Operator must fill in actual results during staging smoke/provider checks.`)
  console.log(`  No migrations have been applied.`)
}

main()
