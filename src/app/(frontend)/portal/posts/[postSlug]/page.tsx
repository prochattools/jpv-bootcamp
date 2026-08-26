import { notFound } from 'next/navigation'

import { MemberPublishedContentView } from '@/components/portal/MemberPublishedContentView'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getPublishedMemberPost } from '@/lib/payloadContent/memberContent'
import { getReactionSummary } from '@/lib/payloadCourse/reactions'

type PageProps = {
  params: Promise<{ postSlug: string }>
}

export default async function PortalPublishedPost({ params }: PageProps) {
  const { postSlug } = await params
  const requestedPath = `/portal/posts/${postSlug}`
  const { memberId, payload } = await requirePortalMember(requestedPath)
  const post = await getPublishedMemberPost(payload, postSlug, memberId)

  if (!post) notFound()

  let reactionSummary = null
  try {
    reactionSummary = await getReactionSummary(payload, memberId, { kind: 'content_post', id: post.id })
  } catch {
    // A missing optional engagement projection must not make published content unreadable.
  }

  return <MemberPublishedContentView content={post} reactionSummary={reactionSummary} target='post' />
}
