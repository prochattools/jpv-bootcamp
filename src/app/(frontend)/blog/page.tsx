import config from '@/config'
import { PublicInformationCard, PublicInformationShell } from '@/components/public/PublicInformationShell'
import { getSEOTags } from '@/libs/seo'

export const metadata = getSEOTags({
  title: `${config.appName} Blog`,
  description: 'JPV Bootcamp updates and published learning resources.',
  canonicalUrlRelative: '/blog',
})

export default function BlogPage() {
  return (
    <PublicInformationShell
      description='Published articles are outside the current launch scope. Current programme information is available on the main site and in the member portal.'
      eyebrow='JPV Bootcamp'
      title='Blog and updates'
    >
      <PublicInformationCard title='Current information'>
        <p>
          Use the main website for public programme information and the member portal for published member updates and resources.
        </p>
      </PublicInformationCard>
    </PublicInformationShell>
  )
}
