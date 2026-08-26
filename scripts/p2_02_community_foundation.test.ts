import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(root, relativePath), 'utf8')
}

function includes(sourceText: string, expected: string, file: string): void {
  assert.ok(sourceText.includes(expected), `${file} must contain ${expected}`)
}

async function main(): Promise<void> {
  const dashboard = await source('src/app/(frontend)/portal/community/page.tsx')
  const space = await source('src/app/(frontend)/portal/community/[spaceSlug]/page.tsx')
  const post = await source('src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx')
  const postCard = await source('src/components/community/CommunityPostCard.tsx')
  const progressiveComments = await source('src/components/community/ProgressiveCommentList.tsx')
  const richText = await source('src/components/community/CommunityRichText.tsx')
  const loadingState = await source('src/components/community/CommunityLoadingState.tsx')
  const dashboardLoading = await source('src/app/(frontend)/portal/community/loading.tsx')
  const spaceLoading = await source('src/app/(frontend)/portal/community/[spaceSlug]/loading.tsx')
  const postLoading = await source('src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/loading.tsx')

  includes(dashboard, 'max-w-6xl', 'community dashboard')
  includes(dashboard, "aria-label='Community navigation'", 'community dashboard')
  includes(dashboard, "id='community-resources-heading'", 'community dashboard')
  includes(dashboard, "id='community-announcements-heading'", 'community dashboard')
  includes(dashboard, "id='community-spaces-heading'", 'community dashboard')
  includes(dashboard, "role='status'", 'community dashboard')

  includes(space, "aria-label='Community path'", 'community space')
  includes(space, 'detail.linkedCourseSlug', 'community space')
  includes(space, "id='community-composer-heading'", 'community space')
  includes(space, "id='community-discussions-heading'", 'community space')
  includes(space, "aria-live='polite'", 'community space')
  includes(space, 'No visible discussions yet.', 'community space')

  includes(post, "aria-label='Discussion path'", 'community post')
  includes(post, "id='community-post-heading'", 'community post')
  includes(post, 'initials(post.authorName)', 'community post')
  includes(post, "id='community-comments-heading'", 'community post')
  includes(post, '<ProgressiveCommentList totalCount={post.comments.length}>', 'community post')
  includes(post, "id='community-reply-heading'", 'community post')

  includes(postCard, 'authorName', 'community post card')
  includes(postCard, 'commentCount', 'community post card')
  includes(postCard, 'aria-label={`Read discussion:', 'community post card')
  includes(progressiveComments, '<details', 'progressive comments')
  includes(progressiveComments, 'Show {remainingCount} more', 'progressive comments')
  includes(progressiveComments, 'min-h-11', 'progressive comments')
  includes(richText, 'max-w-3xl space-y-4', 'community rich text')
  includes(loadingState, "aria-busy='true'", 'community loading state')
  includes(loadingState, 'Loading community content', 'community loading state')
  includes(dashboardLoading, "variant='dashboard'", 'community dashboard loading')
  includes(spaceLoading, "variant='space'", 'community space loading')
  includes(postLoading, "variant='post'", 'community post loading')

  // The post-detail route now includes the separately approved P2-05 reaction
  // surface. Keep this foundation gate focused on dashboard/space mechanics;
  // P2-05 has its own UI and architecture coverage.
  for (const [file, sourceText] of Object.entries({ dashboard, space })) {
    assert.doesNotMatch(sourceText, /\b(?:likes|reactions|bookmarks|sharing|notifications)\b/i, `${file} must not add engagement mechanics in P2-02`)
  }

  console.log('p2_02_community_foundation: PASS')
}

void main()
