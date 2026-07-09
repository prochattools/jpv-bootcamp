import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function mustInclude(source: string, phrase: string, label: string): void {
  assert.ok(source.toLowerCase().includes(phrase.toLowerCase()), `${label} should include: ${phrase}`)
}

function escapedPattern(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
}

function main(): void {
  const templatePath = 'docs/client/FRONTEND_ACCEPTANCE_EVIDENCE_TEMPLATE.md'
  const readmePath = 'docs/client/README.md'
  const handoffPath = 'docs/client/OPERATOR_HANDOFF_SUMMARY.md'
  const roadmapPath = 'docs/client/ROADMAP_PROGRESS_STATUS.md'

  assert.ok(existsSync(templatePath), `${templatePath} should exist`)

  const template = readFileSync(templatePath, 'utf8')
  const readme = readFileSync(readmePath, 'utf8')
  const handoff = readFileSync(handoffPath, 'utf8')
  const roadmap = readFileSync(roadmapPath, 'utf8')
  const testSource = readFileSync(__filename, 'utf8')

  for (const phrase of [
    'Version 3.4',
    'feature/course-branding-and-preview',
    '15 July 2026',
    '22 July 2026',
    '23 July 2026',
    '24 July 2026',
    'Migrations applied',
    'No',
    '£80',
    '£880',
    'support/pay-it-forward',
    'manual front-end website acceptance evidence',
    'does **not** approve migrations',
    'does **not** confirm full platform cutover',
  ]) {
    mustInclude(template, phrase, templatePath)
  }

  assert.match(template, /- \[ \] Landing page loads on desktop\./)
  assert.match(template, /- \[ \] Landing page loads on mobile\./)
  assert.match(template, /- \[ \] Pricing shows £80\/month with 12-month commitment\./)
  assert.match(template, /- \[ \] Pricing shows £880 upfront annual option\./)
  assert.match(template, /- \[ \] Support\/pay-it-forward path is visible\./)

  mustInclude(readme, 'FRONTEND_ACCEPTANCE_EVIDENCE_TEMPLATE.md', readmePath)
  mustInclude(handoff, 'FRONTEND_ACCEPTANCE_EVIDENCE_TEMPLATE.md', handoffPath)
  mustInclude(roadmap, 'FRONTEND_ACCEPTANCE_EVIDENCE_TEMPLATE.md', roadmapPath)

  const forbidden = [
    'prisma ' + 'migrate',
    'payload ' + 'migrate',
    'db ' + 'push',
    'fet' + 'ch(',
    'ax' + 'ios',
    'http' + '.request',
    'https' + '.request',
    '.e' + 'nv',
    'DATA' + 'BASE_URL',
  ]

  for (const value of forbidden) {
    assert.doesNotMatch(template, escapedPattern(value), `${templatePath} should not mention ${value}`)
    assert.doesNotMatch(testSource, escapedPattern(value), `${__filename} should not contain ${value}`)
  }

  console.log('frontend_acceptance_evidence_static.test.ts passed')
}

main()
