#!/usr/bin/env -S npx tsx

/**
 * Local-only evidence artifact validator.
 *
 * Validates evidence files for safety, branch consistency, and secret-leakage.
 * Does not apply migrations, touch databases, or access network.
 * Passes when evidence folder is empty (evidence may not exist yet).
 */

import * as fs from 'fs'
import * as path from 'path'

const EVIDENCE_DIR = 'docs/client/evidence'
const EXPECTED_BRANCH = 'feature/course-branding-and-preview'

// Secret patterns to reject
const SECRET_PATTERNS = [
  /sk_live_/i,
  /sk_test_/i,
  /pk_live_/i,
  /pk_test_/i,
  /whsec_/i,
  /dokploy_/i,
  /api_key\s*=/i,
  /password\s*=/i,
  /BEGIN PRIVATE KEY/,
  /BEGIN RSA PRIVATE KEY/,
]

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

function checkSecretsInContent(content: string, fileName: string): string[] {
  const issues: string[] = []
  const lines = content.split('\n')

  lines.forEach((line, idx) => {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        issues.push(
          `${fileName}:${idx + 1} - Found potential secret pattern: ${pattern.source}`
        )
      }
    }
  })

  return issues
}

function validateEvidenceFile(filePath: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const fileName = path.basename(filePath)

    // Check for branch name
    if (!content.includes(EXPECTED_BRANCH)) {
      result.errors.push(
        `${fileName}: Branch not recorded as '${EXPECTED_BRANCH}'`
      )
      result.valid = false
    }

    // Check migrations applied is No (unless separate approved migration record referenced)
    const hasMigrationsApplied =
      /migrations\s+applied\s*:\s*yes/i.test(content)
    const hasApprovedMigrationRef =
      /approved migration|migration approval|migration_approval|MIGRATION_APPROVAL/i.test(
        content
      )

    if (hasMigrationsApplied && !hasApprovedMigrationRef) {
      result.errors.push(
        `${fileName}: Claims migrations applied but no separate approved migration record referenced`
      )
      result.valid = false
    }

    // Check for secrets
    const secretIssues = checkSecretsInContent(content, fileName)
    if (secretIssues.length > 0) {
      result.errors.push(...secretIssues)
      result.valid = false
    }

    // Check for required fields (operator, date, environment)
    const hasOperator = /operator\s*:/i.test(content)
    const hasDate = /date|time/i.test(content)
    const hasEnvironment = /environment\s*:/i.test(content)

    if (!hasOperator) {
      result.warnings.push(`${fileName}: No operator field found`)
    }
    if (!hasDate) {
      result.warnings.push(`${fileName}: No date/time field found`)
    }
    if (!hasEnvironment) {
      result.warnings.push(`${fileName}: No environment field found`)
    }

    // Check for pass/fail or blocker fields
    const hasResult =
      /result\s*:|pass|fail|blocker/i.test(content)
    if (!hasResult) {
      result.warnings.push(`${fileName}: No result/pass/fail/blocker found`)
    }

    // Check for database connection patterns (should not exist)
    if (
      /\bconnect\(|database|db\.|prisma\|sql\(|query\(|execute\(/i.test(
        content
      )
    ) {
      result.warnings.push(
        `${fileName}: Contains database-like patterns (may be false positive)`
      )
    }
  } catch (err) {
    result.errors.push(`Failed to read ${filePath}: ${err}`)
    result.valid = false
  }

  return result
}

function main() {
  console.log(`\nValidating staging evidence artifacts in: ${EVIDENCE_DIR}`)

  if (!fs.existsSync(EVIDENCE_DIR)) {
    console.log(`✓ Evidence directory does not yet exist (OK)`)
    process.exit(0)
  }

  const files = fs.readdirSync(EVIDENCE_DIR)
  const mdFiles = files.filter((f) => f.endsWith('.md'))

  if (mdFiles.length === 0) {
    console.log(
      `✓ Evidence directory is empty except .gitkeep (OK — evidence may not exist yet)`
    )
    process.exit(0)
  }

  let allValid = true
  const allErrors: string[] = []
  const allWarnings: string[] = []

  mdFiles.forEach((file) => {
    const filePath = path.join(EVIDENCE_DIR, file)
    const result = validateEvidenceFile(filePath)

    if (!result.valid) {
      allValid = false
      console.error(`✗ ${file}`)
      result.errors.forEach((e) => console.error(`  ERROR: ${e}`))
    } else {
      console.log(`✓ ${file}`)
    }

    result.warnings.forEach((w) => console.warn(`  WARN: ${w}`))
    allErrors.push(...result.errors)
    allWarnings.push(...result.warnings)
  })

  console.log(`\n---`)
  console.log(
    `Checked: ${mdFiles.length} file(s) | Errors: ${allErrors.length} | Warnings: ${allWarnings.length}`
  )

  if (!allValid) {
    console.error(`\n✗ Validation failed`)
    process.exit(1)
  }

  console.log(`✓ Validation passed`)
  process.exit(0)
}

main()
