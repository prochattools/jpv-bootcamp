import { notFound } from 'next/navigation'

import { MemberPublishedContentView } from '@/components/portal/MemberPublishedContentView'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getPublishedMemberPost } from '@/lib/payloadContent/memberContent'

type PageProps = {
  params: Promise<{ postSlug: string }>
}

export default async function PortalPublishedPost({ params }: PageProps) {
  const { postSlug } = await params
  const requestedPath = `/portal/posts/${postSlug}`
  const { payload } = await requirePortalMember(requestedPath)
  const post = await getPublishedMemberPost(payload, postSlug)

  if (!post) notFound()

  return <MemberPublishedContentView content={post} target='post' />
}
