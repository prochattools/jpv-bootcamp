import { redirect } from 'next/navigation'

type CommunitySpaceRedirectProps = {
  params: Promise<{ spaceSlug: string }>
}

export const dynamic = 'force-dynamic'

export default async function CommunitySpaceRedirect({ params }: CommunitySpaceRedirectProps) {
  const { spaceSlug } = await params
  redirect(`/portal/community/${spaceSlug}`)
}
