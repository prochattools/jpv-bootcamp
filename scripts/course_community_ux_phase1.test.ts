import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function read(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

const postCard = read('src/components/community/CommunityPostCard.tsx')
const progressiveComments = read('src/components/community/ProgressiveCommentList.tsx')
const communitySpace = read('src/app/(frontend)/portal/community/[spaceSlug]/page.tsx')
const communityPost = read('src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx')
const lesson = read('src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx')
const media = read('src/components/portal/MemberContentMedia.tsx')
const video = read('src/components/portal/ManagedBunnyVideoPlayer.tsx')
const projection = read('src/lib/payloadCourse/communityPortal.ts')

assert.match(postCard, /authorName/)
assert.match(postCard, /commentCount/)
assert.match(postCard, /aria-label=\{`Read discussion:/)
assert.match(postCard, /focus-visible:ring-2/)
assert.match(communitySpace, /<CommunityPostCard/)

assert.match(progressiveComments, /<details/)
assert.match(progressiveComments, /Show \{remainingCount\} more/)
assert.match(communityPost, /<ProgressiveCommentList totalCount=\{post\.comments\.length\}>/)
assert.match(lesson, /<ProgressiveCommentList totalCount=\{children\.length\}>/)

assert.match(media, /aspect-\[16\/7\]/)
assert.match(media, /object-contain/)
assert.match(video, /aspect-video/)
assert.match(video, /playsInline/)

assert.match(projection, /authorName: string/)
assert.match(projection, /excerpt: string \| null/)
assert.match(projection, /richTextExcerpt\(post\.body\)/)

console.log('course_community_ux_phase1.test.ts passed')
