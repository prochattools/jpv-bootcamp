import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

const paths = {
  shell: 'src/components/public/PublicInformationShell.tsx',
  upgrade: 'src/app/(frontend)/upgrade/page.tsx',
  thankYou: 'src/app/(frontend)/thank-you/ThankYouClient.tsx',
  error: 'src/app/(frontend)/error.tsx',
  loading: 'src/app/(frontend)/loading.tsx',
  notFound: 'src/app/(frontend)/not-found.tsx',
  privacy: 'src/app/(frontend)/privacy/page.tsx',
  terms: 'src/app/(frontend)/terms/page.tsx',
  cookies: 'src/app/(frontend)/cookies/page.tsx',
  blog: 'src/app/(frontend)/blog/page.tsx',
  preview: 'src/app/(frontend)/course-preview/page.tsx',
  previewCourse: 'src/app/(frontend)/course-preview/[courseSlug]/page.tsx',
  previewLesson: 'src/app/(frontend)/course-preview/[courseSlug]/[lessonSlug]/page.tsx',
} as const

const sources = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [key, read(path)]),
) as Record<keyof typeof paths, string>

const previewSource = [sources.preview, sources.previewCourse, sources.previewLesson].join('\n')
const prohibited = /(?:bg|text|border)-\[var\(--jpv|bg-white|text-white|max-w-7xl|bg-neutral-950|bg-black\/20|border-white/

describe('frontend Phase E coherence', () => {
  it('uses the shared public information shell across public utility pages', () => {
    expect(sources.privacy).toContain('PublicInformationShell')
    expect(sources.terms).toContain('PublicInformationShell')
    expect(sources.cookies).toContain('PublicInformationShell')
    expect(sources.blog).toContain('PublicInformationShell')
    expect(sources.notFound).toContain('PublicInformationShell')
    expect(sources.shell).toContain('jpv-editorial-heading')
    expect(sources.shell).toContain('max-w-4xl')
  })

  it('preserves checkout consent and both checkout URL contracts', () => {
    expect(sources.upgrade).toContain("billing=monthly&recurring_payment_accepted=${accepted}")
    expect(sources.upgrade).toContain("billing=annual&recurring_payment_accepted=${accepted}")
    expect(sources.upgrade).toContain('aria-disabled={!accepted}')
    expect(sources.upgrade).toContain('href={accepted ? monthlyHref : undefined}')
    expect(sources.upgrade).toContain('href={accepted ? annualHref : undefined}')
  })

  it('preserves thank-you redirect timing and session confirmation', () => {
    expect(sources.thankYou).toContain('const REDIRECT_SECONDS = 7')
    expect(sources.thankYou).toContain("router.push('/')")
    expect(sources.thankYou).toContain("searchParams.get('session_id')")
    expect(sources.thankYou).toContain('Payment confirmed.')
  })

  it('preserves error reset behavior and accessible loading semantics', () => {
    expect(sources.error).toContain('onClick={reset}')
    expect(sources.error).toContain("type='button'")
    expect(sources.loading).toContain("role='status'")
    expect(sources.loading).toContain("aria-busy='true'")
    expect(sources.loading).toContain("aria-live='polite'")
    expect(sources.loading).toContain('Loading page')
  })

  it('preserves Course Preview gates, routes, states, and content contracts', () => {
    for (const source of [sources.preview, sources.previewCourse, sources.previewLesson]) {
      expect(source).toContain('PAYLOAD_COURSE_PROTOTYPE_ENABLED')
      expect(source).toContain('notFound()')
      expect(source).toContain('PAYLOAD_COURSE_PROTOTYPE_BANNER')
    }
    expect(sources.previewCourse).toContain("params: Promise<{ courseSlug: string }>")
    expect(sources.previewLesson).toContain("params: Promise<{ courseSlug: string; lessonSlug: string }>")
    expect(sources.previewLesson).toContain('courseLessons')
    expect(sources.previewLesson).toContain('lessonContent')
  })

  it('enforces mapped tokens, max-w-6xl shells, and canonical actions', () => {
    expect(previewSource).not.toMatch(prohibited)
    expect(sources.preview).toContain('max-w-6xl')
    expect(sources.previewCourse).toContain('max-w-6xl')
    expect(sources.previewLesson).toContain('max-w-6xl')
    expect(sources.preview).toContain('jpv-button-primary')
    expect(sources.preview).toContain('jpv-button-secondary')
    expect(sources.previewCourse).toContain('jpv-button-secondary')
    expect(sources.previewLesson).toContain('jpv-button-primary')
    expect(sources.previewLesson).toContain('jpv-button-secondary')
  })

  it('maintains 44px targets on active public actions', () => {
    expect(sources.shell).toContain('min-h-11')
    expect(sources.upgrade).toContain('min-h-11')
    expect(sources.thankYou).toContain('min-h-11')
    expect(sources.error).toContain('min-h-11')
    expect(sources.notFound).toContain('min-h-11')
    expect(sources.preview).toContain('min-h-11')
    expect(sources.previewCourse).toContain('min-h-11')
    expect(sources.previewLesson).toContain('min-h-11')
  })
})
