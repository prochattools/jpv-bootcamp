import { notFound } from 'next/navigation'

import { MemberPublishedContentView } from '@/components/portal/MemberPublishedContentView'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { getPublishedMemberPost } from '@/lib/payloadContent/memberContent'
import { getReactionSummary } from '@/lib/payloadCourse/reactions'

type PageProps = {
  params: Promise<{ postSlug: string }>
}

export default async function PortalPublishedPost({ params }: PageProps) {
  const { postSlug } = await params
  const requestedPath = `/portal/posts/${postSlug}`
  const { actor, payload } = await requirePortalAccess(requestedPath)
  const memberId = actor.memberId ?? null
  const post = await getPublishedMemberPost(payload, postSlug, memberId, { includeRestricted: actor.kind === 'admin' })

  if (!post) notFound()

  let reactionSummary = null
  if (actor.kind === 'member') {
    try {
      reactionSummary = await getReactionSummary(payload, memberId, { kind: 'content_post', id: post.id })
    } catch {
      // A missing optional engagement projection must not make published content unreadable.
    }
  }

  return <MemberPublishedContentView content={post} enableReactions={actor.kind === 'member'} reactionSummary={reactionSummary} target='post' />
}
