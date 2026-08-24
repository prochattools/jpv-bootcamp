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
  const presentation = await source('src/components/community/EngagementPresentation.tsx')
  const submitButton = await source('src/components/community/ReactionSubmitButton.tsx')
  const postPage = await source('src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx')
  const lessonPage = await source('src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx')
  const documentation = await source('docs/design/JPV_P2_05_REACTION_IMPLEMENTATION.md')

  for (const required of [
    'ReactionSubmitButton',
    'reactionErrorMessage',
    'errorMessage?: string | null',
    "role='alert'",
    'data-engagement-component=\'reaction-bar\'',
    'sm:flex-row',
  ]) {
    includes(presentation, required, 'engagement presentation')
  }

  for (const required of [
    "'use client'",
    'useFormStatus',
    'aria-busy={pending}',
    'aria-pressed={selected}',
    'disabled={pending}',
    'min-h-11',
    'focus-visible:ring-jpv-focus',
  ]) {
    includes(submitButton, required, 'reaction submit button')
  }

  for (const required of [
    'getSpaceCommentReactionSummaries',
    "targetKind='space_comment'",
    'reactionErrorMessage',
  ]) {
    includes(postPage, required, 'community post page')
  }
  for (const required of [
    "targetKind='lesson_comment'",
    'reactionErrorMessage',
    'reactionError={reactionError}',
  ]) {
    includes(lessonPage, required, 'lesson page')
  }

  for (const required of [
    'UI integration',
    'space comments',
    '12/12',
    'Bookmarks, sharing, notifications',
  ]) {
    includes(documentation, required, 'P2-05 implementation documentation')
  }

  assert.equal(submitButton.includes('payload.create'), false, 'reaction UI must not write directly to Payload')
  assert.equal(submitButton.includes('src/migrations'), false, 'reaction UI must not contain migration paths')
  console.log('p2_05_reaction_ui: PASS')
}

void main()
