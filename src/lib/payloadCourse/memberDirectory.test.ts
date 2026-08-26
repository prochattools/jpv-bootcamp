import assert from 'node:assert/strict'

import type { MemberDirectoryItem, MemberProfileDetail } from './memberDirectory'

function run(): void {
  const item: MemberDirectoryItem = {
    memberId: 'test-id',
    displayName: 'Test Member',
    avatarUrl: null,
  }
  assert.equal(item.memberId, 'test-id')
  assert.equal(item.displayName, 'Test Member')
  assert.equal(item.avatarUrl, null)

  const detail: MemberProfileDetail = {
    memberId: 'test-id',
    displayName: 'Test Member',
    avatarUrl: 'https://cdn.example/avatar.jpg',
    coverImageUrl: null,
    biography: null,
    website: 'https://example.com',
    socialLinks: {
      instagram: null,
      twitter: 'https://x.com/test',
      linkedin: null,
      facebook: null,
      youtube: null,
    },
  }
  assert.equal(detail.memberId, 'test-id')
  assert.equal(detail.website, 'https://example.com')
  assert.equal(detail.socialLinks.twitter, 'https://x.com/test')
  assert.equal(Object.prototype.hasOwnProperty.call(detail, 'email'), false, 'email must not be on safe DTO')
  assert.equal(Object.prototype.hasOwnProperty.call(detail, 'phone'), false, 'phone must not be on safe DTO')
  assert.equal(Object.prototype.hasOwnProperty.call(detail, 'timezone'), false, 'timezone must not be on safe DTO')
  assert.equal(Object.prototype.hasOwnProperty.call(detail, 'marketingConsent'), false, 'marketingConsent must not be on safe DTO')
  assert.equal(Object.prototype.hasOwnProperty.call(detail, 'billingHoldReason'), false)

  process.stdout.write('memberDirectory.test.ts: all assertions passed\n')
}

run()
