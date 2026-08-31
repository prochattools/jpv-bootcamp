import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

const homepage = source('src/app/(frontend)/page.tsx')
assert.match(homepage, /autoplay=false/)
assert.equal(homepage.includes('IntersectionObserver'), false)
assert.equal(homepage.includes('startedVideos'), false)

const support = source('src/app/api/support/route.ts')
assert.match(support, /getPayloadAdministratorRecipients/)
assert.match(support, /requesterQuestion/)
assert.match(support, /queueAndAttemptEmailEvent/)

const sponsored = source('src/app/api/sponsored-applications/route.ts')
assert.match(sponsored, /SPONSORED_APPLICATION_ADMIN_NOTIFICATION_TEMPLATE_KEY/)
assert.match(sponsored, /getPayloadAdministratorRecipients/)
assert.match(sponsored, /sponsored-application-admin-notification:/)

const templates = source('src/lib/payloadCourse/systemEmailTemplates.ts')
assert.match(templates, /Question: \{\{requesterQuestion\}\}/)
assert.match(templates, /Message: \{\{applicantMessage\}\}/)
assert.match(templates, /\{\{approveUrl\}\}/)

const upgrade = source('src/app/(frontend)/upgrade/page.tsx')
assert.match(upgrade, /grid items-stretch/)
assert.match(upgrade, /flex h-full flex-col/)

const resources = source('src/app/(frontend)/portal/resources/page.tsx')
assert.match(resources, /getAdminResourceLibrary/)

const community = source('src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx')
assert.match(community, /resolveMemberCommunityAttachment/)
assert.match(community, /allowAdministrator: true/)
assert.match(community, /imagePreviewUrl/)

const communityCard = source('src/components/community/CommunityPostCard.tsx')
assert.match(communityCard, /post\.attachments/)
assert.match(communityCard, /previewUrl/)
assert.match(communityCard, /loading='lazy'/)

const communityFileRoute = source('src/app/(frontend)/portal/community/files/[fileId]/route.ts')
assert.match(communityFileRoute, /administratorAccess/)
assert.match(communityFileRoute, /inlineImage/)
assert.match(communityFileRoute, /Content-Disposition/)

console.log('six-fix hotfix contracts passed')
