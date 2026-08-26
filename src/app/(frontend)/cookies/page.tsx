import { PublicInformationCard, PublicInformationShell } from '@/components/public/PublicInformationShell'

export default function CookiesPage() {
  return (
    <PublicInformationShell
      description='Details on how cookies are used across the JPV Bootcamp website.'
      eyebrow='JPV Bootcamp'
      title='Cookie Policy'
    >
      <PublicInformationCard title='1. Introduction'>
        <p>
          Welcome to JPV Bootcamp (“we”, “us”, “our”). We are committed...sing jpvbootcamp.com (“Website”), you agree to these policies.
        </p>
      </PublicInformationCard>

      <PublicInformationCard title='4. Cookie Policy'>
        <h3 className='font-semibold text-jpv-ink'>What Are Cookies?</h3>
        <p>
          Cookies are small files stored on your device to help websites remember preferences and improve functionality.
        </p>
        <h3 className='pt-2 font-semibold text-jpv-ink'>Types of Cookies We Use</h3>
        <h4 className='font-semibold text-jpv-ink'>Essential Cookies</h4>
        <p>
          These are necessary for the Website to operate...out our use of cookies, please contact us through the Website.
        </p>
      </PublicInformationCard>
    </PublicInformationShell>
  )
}
