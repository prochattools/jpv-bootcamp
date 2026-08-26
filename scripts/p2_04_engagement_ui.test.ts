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
  const component = await source('src/components/community/EngagementPresentation.tsx')
  const postCard = await source('src/components/community/CommunityPostCard.tsx')
  const postPage = await source('src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx')
  const lessonPage = await source('src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx')
  const documentation = await source('docs/design/JPV_P2_04_ENGAGEMENT_UI_IMPLEMENTATION.md')

  for (const name of [
    'EngagementReactionSummary',
    'EngagementReactionButton',
    'EngagementReactionBar',
    'EngagementCommentActionBar',
    'EngagementAuthorIdentity',
    'DiscussionHierarchy',
    'EngagementFutureActions',
  ]) {
    includes(component, `export function ${name}`, 'engagement presentation')
  }

  includes(component, "disabled={!interactive}", 'engagement presentation')
  includes(component, "data-reaction-state={state}", 'engagement presentation')
  includes(component, 'border-jpv-border', 'engagement presentation')
  includes(component, 'rounded-jpv-action', 'engagement presentation')
  includes(component, 'text-jpv-brand-deep', 'engagement presentation')

  includes(postCard, 'EngagementAuthorIdentity', 'community post card')
  includes(postCard, 'EngagementCommentActionBar', 'community post card')
  includes(postPage, 'EngagementReactionBar', 'community post page')
  includes(postPage, 'EngagementFutureActions', 'community post page')
  includes(postPage, 'EngagementAuthorIdentity', 'community post page')
  includes(lessonPage, 'EngagementReactionBar', 'lesson page')
  includes(lessonPage, 'DiscussionHierarchy', 'lesson page')
  includes(lessonPage, 'EngagementAuthorIdentity', 'lesson page')

  for (const forbidden of [
    'payload.create',
    'fetch(',
    'axios',
    'collection: \'payload_',
    'src/migrations',
  ]) {
    assert.equal(component.includes(forbidden), false, `engagement presentation must not introduce ${forbidden}`)
  }

  for (const required of [
    'presentation-only foundation',
    'disabled unless a future integration supplies an explicit handler',
    'No reaction, bookmark, sharing, notification, or new reply mutation was added.',
    'Deferred backend work',
  ]) {
    includes(documentation, required, 'P2-04 documentation')
  }

  console.log('p2_04_engagement_ui: PASS')
}

void main()
