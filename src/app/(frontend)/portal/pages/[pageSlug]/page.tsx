import { notFound } from 'next/navigation'

import { MemberPublishedContentView } from '@/components/portal/MemberPublishedContentView'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getPublishedMemberPage } from '@/lib/payloadContent/memberContent'
import { getReactionSummary } from '@/lib/payloadCourse/reactions'

type PageProps = {
  params: Promise<{ pageSlug: string }>
}

export default async function PortalPublishedPage({ params }: PageProps) {
  const { pageSlug } = await params
  const requestedPath = `/portal/pages/${pageSlug}`
  const { memberId, payload } = await requirePortalMember(requestedPath)
  const page = await getPublishedMemberPage(payload, pageSlug, memberId)

  if (!page) notFound()

  let reactionSummary = null
  try {
    reactionSummary = await getReactionSummary(payload, memberId, { kind: 'content_page', id: page.id })
  } catch {
    // A missing optional engagement projection must not make published content unreadable.
  }

  return <MemberPublishedContentView content={page} reactionSummary={reactionSummary} target='page' />
}
