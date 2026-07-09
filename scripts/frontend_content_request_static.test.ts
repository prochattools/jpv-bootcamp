import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function mustInclude(source: string, phrase: string, label: string): void {
  assert.ok(source.toLowerCase().includes(phrase.toLowerCase()), `${label} should include: ${phrase}`)
}

function main(): void {
  const requestPath = 'docs/client/CLIENT_CONTENT_REQUEST_15_JULY.md'
  const trackerPath = 'docs/client/FRONTEND_CONTENT_STATUS_TRACKER.md'
  const readmePath = 'docs/client/README.md'
  const copyPacketPath = 'docs/client/FRONTEND_COPY_APPROVAL_PACKET.md'
  const intakeChecklistPath = 'docs/client/FRONTEND_CONTENT_INTAKE_CHECKLIST.md'

  assert.ok(existsSync(requestPath), 'content request should exist')
  assert.ok(existsSync(trackerPath), 'content tracker should exist')

  const request = readFileSync(requestPath, 'utf8')
  const tracker = readFileSync(trackerPath, 'utf8')
  const readme = readFileSync(readmePath, 'utf8')
  const copyPacket = readFileSync(copyPacketPath, 'utf8')
  const intakeChecklist = readFileSync(intakeChecklistPath, 'utf8')

  mustInclude(request, '15 July 2026', requestPath)
  mustInclude(request, '22 July 2026', requestPath)
  mustInclude(request, '23 July 2026', requestPath)
  mustInclude(request, '24 July 2026', requestPath)
  mustInclude(request, '£80', requestPath)
  mustInclude(request, '£880', requestPath)
  mustInclude(request, 'support/pay-it-forward', requestPath)
  mustInclude(request, 'Front-end approval does **not** approve migrations', requestPath)

  mustInclude(tracker, 'Version 3.4', trackerPath)
  mustInclude(tracker, 'feature/course-branding-and-preview', trackerPath)
  mustInclude(tracker, 'Migrations applied', trackerPath)
  mustInclude(tracker, 'No', trackerPath)
  mustInclude(tracker, 'Hero headline', trackerPath)
  mustInclude(tracker, 'Hero subheading', trackerPath)
  mustInclude(tracker, 'Membership short description', trackerPath)
  mustInclude(tracker, '£80/month wording', trackerPath)
  mustInclude(tracker, '£880 annual wording', trackerPath)
  mustInclude(tracker, 'Support/pay-it-forward wording', trackerPath)
  mustInclude(tracker, 'Sponsor/pay-it-forward CTA', trackerPath)
  mustInclude(tracker, 'FAQ answers', trackerPath)
  mustInclude(tracker, 'Testimonials/proof/trust', trackerPath)
  mustInclude(tracker, 'Partner logos/credibility points', trackerPath)
  mustInclude(tracker, 'Contact/support wording', trackerPath)
  mustInclude(tracker, 'Representative 8-week course outline', trackerPath)
  mustInclude(tracker, 'Video/storage usage details', trackerPath)
  mustInclude(tracker, 'Pending', trackerPath)
  mustInclude(tracker, 'Approved', trackerPath)
  mustInclude(tracker, 'Replacement received', trackerPath)

  mustInclude(readme, 'CLIENT_CONTENT_REQUEST_15_JULY.md', readmePath)
  mustInclude(readme, 'FRONTEND_CONTENT_STATUS_TRACKER.md', readmePath)
  mustInclude(copyPacket, 'CLIENT_CONTENT_REQUEST_15_JULY.md', copyPacketPath)
  mustInclude(copyPacket, 'FRONTEND_CONTENT_STATUS_TRACKER.md', copyPacketPath)
  mustInclude(intakeChecklist, 'CLIENT_CONTENT_REQUEST_15_JULY.md', intakeChecklistPath)
  mustInclude(intakeChecklist, 'FRONTEND_CONTENT_STATUS_TRACKER.md', intakeChecklistPath)

  console.log('frontend_content_request_static.test.ts passed')
}

main()
