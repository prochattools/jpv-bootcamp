import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const files = {
  community: 'src/app/(frontend)/portal/community/page.tsx',
  communityDetail: 'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
  content: 'src/app/(frontend)/portal/content/page.tsx',
  liveSessions: 'src/app/(frontend)/portal/live-sessions/page.tsx',
  support: 'src/app/(frontend)/portal/support/page.tsx',
  partners: 'src/app/(frontend)/portal/partners/page.tsx',
  partnerDetail: 'src/app/(frontend)/portal/partners/[partnerSlug]/page.tsx',
  publishedContent: 'src/components/portal/MemberPublishedContentView.tsx',
} as const

const sources = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, readFileSync(resolve(root, path), 'utf8')]),
) as Record<keyof typeof files, string>

const scopedSource = Object.values(sources).join('\n')
const prohibited = /(?:bg|text|border)-(?:amber|blue|gray|slate|sky|orange)-|bg-neutral-950|max-w-7xl|(?:bg|text|border)-\[var\(--jpv/

describe('portal Phase D design coherence', () => {
  it('preserves member route and data boundaries', () => {
    expect(sources.content).toContain("requirePortalMember('/portal/content')")
    expect(sources.content).toContain('listPublishedMemberContent(payload)')
    expect(sources.liveSessions).toContain("requirePortalMember('/portal/live-sessions')")
    expect(sources.liveSessions).toContain('listMemberLiveSessions(payload, memberId)')
    expect(sources.communityDetail).toContain('getMemberCommunitySpaceDetail(payload, memberId, spaceSlug)')
    expect(sources.partners).toContain('listActivePartners(payload as never)')
    expect(sources.partners).toContain('listMemberApplications(payload as never, memberId)')
    expect(sources.partners).toContain('getAffiliateSummary(payload as never, memberId)')
  })

  it('preserves community and partner submission actions', () => {
    expect(sources.communityDetail).toContain("import { submitCommunityPost } from '../actions'")
    expect(sources.communityDetail).toContain('action={submitCommunityPost.bind(null, spaceSlug)}')
    expect(sources.partnerDetail).toContain('submitPartnerApplication(payload as never')
    expect(sources.partnerDetail).toContain('action={submitAction}')
    expect(sources.partnerDetail).toContain('consentAccepted: formData.get(\'consentAccepted\') === \'on\'')
  })

  it('uses portal-shell widths and responsive hierarchy', () => {
    expect(scopedSource).not.toContain('max-w-7xl')
    expect(sources.community).toContain("<div className='space-y-10'>")
    expect(sources.communityDetail).toContain("<div className='space-y-8'>")
    expect(sources.content).toContain('md:grid-cols-2')
    expect(sources.support).toContain('lg:grid-cols-2')
    expect(sources.partners).toContain('md:grid-cols-2')
    expect(sources.partnerDetail).toContain('sm:grid-cols-2')
  })

  it('uses canonical JPV tokens and actions', () => {
    expect(scopedSource).not.toMatch(prohibited)
    expect(sources.content).toContain('jpv-button-primary')
    expect(sources.liveSessions).toContain('jpv-button-primary min-h-11')
    expect(sources.support).toContain('jpv-button-secondary min-h-11')
    expect(sources.communityDetail).toContain('jpv-button-primary min-h-11')
    expect(sources.partnerDetail).toContain('jpv-button-primary min-h-11')
    expect(sources.publishedContent).toContain('text-jpv-brand-deep')
  })

  it('maintains 44px touch and control targets', () => {
    expect(sources.community).toContain('min-h-11')
    expect(sources.communityDetail).toContain('min-h-11')
    expect(sources.content).toContain('min-h-11')
    expect(sources.liveSessions).toContain('min-h-11')
    expect(sources.support).toContain('min-h-11')
    expect(sources.partners).toContain('min-h-11')
    expect(sources.partnerDetail).toContain('min-h-11')
  })

  it('formats partner commissions with stored currency', () => {
    expect(sources.partners).toContain('new Intl.NumberFormat(\'en-US\'')
    expect(sources.partners).toContain('currency: currency.toUpperCase()')
    expect(sources.partners).toContain('pendingCommissionTotalMinor')
    expect(sources.partners).toContain('approvedCommissionTotalMinor')
  })
})
