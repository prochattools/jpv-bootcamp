export type CommunityAccessLabel = 'pro' | 'free_and_pro' | 'admin_preview'

export type CommunityStatus = 'preview' | 'placeholder' | 'locked'

export type CommunityPreviewThread = {
  id: string
  title: string
  authorLabel: string
  replyCount: number
  isPlaceholder: boolean
}

export type CommunitySpace = {
  slug: string
  title: string
  summary: string
  description: string
  accessLabel: CommunityAccessLabel
  status: CommunityStatus
  lockReason: string | null
  previewThreads: CommunityPreviewThread[]
}

export type CommunityPreviewSummary = {
  spaceCount: number
  publicSpaceCount: number
  proSpaceCount: number
  isPreview: boolean
}

const SPACES: CommunitySpace[] = [
  {
    slug: 'announcements',
    title: 'Announcements',
    summary: 'Platform updates, programme news, and community announcements.',
    description: 'Official announcements from the JPV Bootcamp team covering programme updates, feature releases, schedule changes, and community milestones.',
    accessLabel: 'free_and_pro',
    status: 'preview',
    lockReason: null,
    previewThreads: [
      {
        id: 'announcement-1',
        title: 'Welcome to the JPV Bootcamp Community',
        authorLabel: 'JPV Team',
        replyCount: 0,
        isPlaceholder: true,
      },
      {
        id: 'announcement-2',
        title: 'Platform Preview Now Available',
        authorLabel: 'JPV Team',
        replyCount: 0,
        isPlaceholder: true,
      },
    ],
  },
  {
    slug: 'pro-community',
    title: 'Pro Community',
    summary: 'Member forum for Pro-level discussions, deal sourcing, and networking.',
    description: 'A private forum for Pro members to discuss strategy, share deal opportunities, ask questions, and network with peers. Full access requires an active Pro membership.',
    accessLabel: 'pro',
    status: 'preview',
    lockReason: null,
    previewThreads: [
      {
        id: 'pro-thread-1',
        title: 'Introduce Yourself',
        authorLabel: 'Pro member',
        replyCount: 0,
        isPlaceholder: true,
      },
      {
        id: 'pro-thread-2',
        title: 'Deal Sourcing Strategies',
        authorLabel: 'Pro member',
        replyCount: 0,
        isPlaceholder: true,
      },
    ],
  },
  {
    slug: 'qa-forum',
    title: 'Q&A Forum',
    summary: 'Ask questions and get answers from mentors and the community.',
    description: 'A structured Q&A space where Pro members can ask course-related questions, get answers from mentors, and help peers. Each thread can be categorized by module or topic.',
    accessLabel: 'pro',
    status: 'preview',
    lockReason: null,
    previewThreads: [
      {
        id: 'qa-thread-1',
        title: 'How to evaluate a multi-family deal?',
        authorLabel: 'Pro member',
        replyCount: 0,
        isPlaceholder: true,
      },
      {
        id: 'qa-thread-2',
        title: 'Understanding cap rates vs cash-on-cash',
        authorLabel: 'Pro member',
        replyCount: 0,
        isPlaceholder: true,
      },
    ],
  },
  {
    slug: 'private-mastermind',
    title: 'Private Mastermind',
    summary: 'Exclusive mastermind group for advanced Pro members.',
    description: 'An invite-only mastermind room for experienced investors. Access is granted by administrator invitation or application review.',
    accessLabel: 'pro',
    status: 'locked',
    lockReason: 'Invite or application required. Upgrade to Pro and request access through the member portal.',
    previewThreads: [],
  },
  {
    slug: 'resource-library',
    title: 'Resource Library',
    summary: 'Shared templates, tools, and reference materials.',
    description: 'A collection of templates, calculators, checklists, and reference documents contributed by the JPV Bootcamp team and community members.',
    accessLabel: 'free_and_pro',
    status: 'preview',
    lockReason: null,
    previewThreads: [
      {
        id: 'resource-1',
        title: 'Deal Analysis Spreadsheet Template',
        authorLabel: 'JPV Team',
        replyCount: 0,
        isPlaceholder: true,
      },
      {
        id: 'resource-2',
        title: 'Property Inspection Checklist',
        authorLabel: 'Community',
        replyCount: 0,
        isPlaceholder: true,
      },
    ],
  },
]

export function getAllSpaces(): CommunitySpace[] {
  return SPACES
}

export function getSpaceBySlug(slug: string): CommunitySpace | undefined {
  return SPACES.find((space) => space.slug === slug)
}

export function getPublicSafeSummary(): CommunityPreviewSummary {
  return {
    spaceCount: SPACES.length,
    publicSpaceCount: SPACES.filter((s) => s.accessLabel === 'free_and_pro').length,
    proSpaceCount: SPACES.filter((s) => s.accessLabel === 'pro').length,
    isPreview: true,
  }
}
