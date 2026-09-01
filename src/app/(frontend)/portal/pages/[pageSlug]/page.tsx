import { notFound } from 'next/navigation'

import { MemberPublishedContentView } from '@/components/portal/MemberPublishedContentView'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { getPublishedMemberPage } from '@/lib/payloadContent/memberContent'
import { getReactionSummary } from '@/lib/payloadCourse/reactions'

type PageProps = {
  params: Promise<{ pageSlug: string }>
}

export default async function PortalPublishedPage({ params }: PageProps) {
  const { pageSlug } = await params
  const requestedPath = `/portal/pages/${pageSlug}`
  const { actor, payload } = await requirePortalAccess(requestedPath)
  const memberId = actor.memberId ?? null
  const page = await getPublishedMemberPage(payload, pageSlug, memberId, { includeRestricted: actor.kind === 'admin' })

  if (!page) notFound()

  let reactionSummary = null
  if (actor.kind === 'member') {
    try {
      reactionSummary = await getReactionSummary(payload, memberId, { kind: 'content_page', id: page.id })
    } catch {
      // A missing optional engagement projection must not make published content unreadable.
    }
  }

  return <MemberPublishedContentView content={page} enableReactions={actor.kind === 'member'} reactionSummary={reactionSummary} target='page' />
}
