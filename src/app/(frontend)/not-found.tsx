import Link from 'next/link'

import { PublicInformationCard, PublicInformationShell } from '@/components/public/PublicInformationShell'

export default function FrontendNotFound() {
  return (
    <PublicInformationShell
      description='The page may have moved, the link may be outdated, or the content may no longer be available.'
      eyebrow='Page not found'
      title='We could not find that page.'
    >
      <PublicInformationCard title='Continue from here'>
        <div className='flex flex-wrap gap-3'>
          <Link className='jpv-button-primary min-h-11' href='/'>
            Go to the home page
          </Link>
          <Link className='jpv-button-secondary min-h-11' href='/portal?mode=login'>
            Member sign in
          </Link>
        </div>
      </PublicInformationCard>
    </PublicInformationShell>
  )
}
