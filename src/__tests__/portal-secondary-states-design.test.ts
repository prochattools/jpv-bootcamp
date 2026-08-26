import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

const paths = {
  statusPill: 'src/components/portal/StatusPill.tsx',
  bunny: 'src/components/portal/ManagedBunnyVideoPlayer.tsx',
  programme: 'src/app/(frontend)/portal/programme/page.tsx',
  referral: 'src/app/(frontend)/portal/partner-referral/page.tsx',
  submissions: 'src/app/(frontend)/portal/community/submissions/page.tsx',
  moderation: 'src/app/(frontend)/portal/community/moderation/page.tsx',
  discussion: 'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
} as const

const sources = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [key, read(path)]),
) as Record<keyof typeof paths, string>

const scopedSource = Object.values(sources).join('\n')
const prohibited = /(?:bg|text|border)-(?:amber|blue|gray|slate|sky|orange)-|bg-neutral-950|max-w-7xl|(?:bg|text|border)-\[var\(--jpv|bg-white|text-white/

describe('secondary portal state coherence', () => {
  it('preserves Bunny fetch, entitlement, and fail-closed state handling', () => {
    expect(sources.bunny).toContain("fetch(`/api/bunny/video?${query.toString()}`)")
    expect(sources.bunny).toContain("case 'not_entitled':")
    expect(sources.bunny).toContain("case 'unauthorized':")
    expect(sources.bunny).toContain("case 'video_not_ready':")
    expect(sources.bunny).toContain("setState({ status: 'error' })")
    expect(sources.bunny).toContain('if (cancelled) return')
    expect(sources.bunny).toContain('controls')
    expect(sources.bunny).toContain('playsInline')
  })

  it('preserves programme, submission, and member authorization boundaries', () => {
    expect(sources.programme).toContain("requirePortalAccess('/portal/programme')")
    expect(sources.programme).toContain('getAllWeeks()')
    expect(sources.programme).toContain('getProgrammeSummary()')
    expect(sources.submissions).toContain("requirePortalAccess('/portal/community/submissions')")
    expect(sources.submissions).toContain('getMemberCommunitySubmissions(payload, memberId)')
    expect(sources.submissions).toContain('href={item.downloadUrl}')
  })

  it('keeps the partner referral surface preview-only and non-submitting', () => {
    expect(sources.referral).toContain('this form does not submit')
    expect(sources.referral).toContain('disabled')
    expect(sources.referral).toContain("type='button'")
    expect(sources.referral).not.toContain("'use server'")
    expect(sources.referral).not.toContain('action=')
  })

  it('preserves moderation validation, authorization, audit actor, and redirects', () => {
    expect(sources.moderation).toContain('async function submitModerationDecision(formData: FormData)')
    expect(sources.moderation).toContain('action={submitModerationDecision}')
    expect(sources.moderation).toContain('moderatePendingCommunityItem(payload as unknown as PayloadCourseWriteAPI')
    expect(sources.moderation).toContain("{ type: 'member' as const, id: memberId }")
    expect(sources.moderation).toContain("decision === 'reject' && !reason")
    expect(sources.moderation).toContain('if (!result.allowed)')
    expect(sources.moderation).toContain('if (!inbox.actorRole) notFound()')
    expect(sources.moderation).toContain("new Intl.DateTimeFormat('en-US'")
  })

  it('preserves discussion authorization, not-found, attachments, and reply action', () => {
    expect(sources.discussion).toContain('requirePortalAccess(')
    expect(sources.discussion).toContain('memberResult.allowed')
    expect(sources.discussion).toContain('notFound()')
    expect(sources.discussion).toContain('post.attachments')
    expect(sources.discussion).toContain('post.locked')
    expect(sources.discussion).toContain('post.canComment')
    expect(sources.discussion).toContain('<CommunityCommentComposer')
  })

  it('uses distinguishable canonical status and notice states', () => {
    expect(sources.statusPill).toContain("tone?: 'good' | 'warn' | 'neutral'")
    expect(sources.statusPill).toContain('bg-emerald-50')
    expect(sources.statusPill).toContain('bg-jpv-surface')
    expect(sources.statusPill).toContain('bg-jpv-canvas')
    expect(sources.bunny).toContain('jpv-notice')
    expect(sources.bunny).toContain('jpv-notice-danger')
    expect(sources.moderation).toContain('jpv-notice-danger')
    expect(sources.discussion).toContain('jpv-notice-danger')
  })

  it('enforces scoped token compliance and responsive control hierarchy', () => {
    expect(scopedSource).not.toMatch(prohibited)
    expect(sources.programme).toContain('md:grid-cols-2')
    expect(sources.referral).toContain('sm:grid-cols-2')
    expect(sources.submissions).toContain('lg:grid-cols-2')
    expect(sources.programme).toContain('min-h-11')
    expect(sources.referral).toContain('min-h-11')
    expect(sources.submissions).toContain('min-h-11')
    expect(sources.moderation).toContain('min-h-11')
    expect(sources.discussion).toContain('min-h-11')
  })
})
