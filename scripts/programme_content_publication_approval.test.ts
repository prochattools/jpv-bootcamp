import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function main(): void {
  const decision = readFileSync('docs/decisions/PROGRAMME_CONTENT_PUBLICATION_APPROVAL.md', 'utf8')
  const approvalRecord = readFileSync('docs/client/PROGRAMME_CONTENT_APPROVAL_RECORD.md', 'utf8')
  const portalProgramme = readFileSync('src/app/(frontend)/portal/programme/page.tsx', 'utf8')
  const readiness = readFileSync('docs/PREVIEW_RELEASE_READINESS.md', 'utf8')

  assert.match(decision, /Decision ID: `programme-content-publication`/)
  assert.match(decision, /Current status: `AWAITING_CLIENT_CONTENT`/)
  assert.match(decision, /PROGRAMME_CONTENT_INTAKE_TEMPLATE\.md/)
  assert.match(decision, /PROGRAMME_CONTENT_APPROVAL_RECORD\.md/)
  assert.match(decision, /content:programme:validate/)
  assert.match(decision, /exact missing client deliverable/i)
  assert.match(approvalRecord, /Status: `NOT APPROVED`/)
  assert.match(portalProgramme, /Preview only/)
  assert.match(readiness, /programme remains preview-only/i)
  assert.doesNotMatch(decision, /Current status: `APPROVED`/)

  console.log('programme_content_publication_approval.test.ts passed')
}

main()

