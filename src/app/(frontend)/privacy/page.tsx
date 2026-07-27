import { PublicInformationCard, PublicInformationShell } from '@/components/public/PublicInformationShell'

export default function PrivacyPage() {
  return (
    <PublicInformationShell
      description='Current privacy information for the JPV Bootcamp website.'
      eyebrow='JPV Bootcamp'
      title='Privacy Policy'
    >
      <PublicInformationCard title='Approval status'>
        <p>The complete privacy notice is pending client and legal approval.</p>
      </PublicInformationCard>

      <PublicInformationCard title='Website forms'>
        <p>
          The website includes account, checkout, and support forms. Checkout is handled through Stripe.
        </p>
      </PublicInformationCard>

      <PublicInformationCard title='Questions'>
        <p>
          Use the support form on the home page for questions about information submitted through this website.
        </p>
      </PublicInformationCard>
    </PublicInformationShell>
  )
}
