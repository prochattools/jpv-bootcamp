import { notFound } from 'next/navigation'

import { MemberPublishedContentView } from '@/components/portal/MemberPublishedContentView'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getPublishedMemberPage } from '@/lib/payloadContent/memberContent'

type PageProps = {
  params: Promise<{ pageSlug: string }>
}

export default async function PortalPublishedPage({ params }: PageProps) {
  const { pageSlug } = await params
  const requestedPath = `/portal/pages/${pageSlug}`
  const { payload } = await requirePortalMember(requestedPath)
  const page = await getPublishedMemberPage(payload, pageSlug)

  if (!page) notFound()

  return <MemberPublishedContentView content={page} target='page' />
}
