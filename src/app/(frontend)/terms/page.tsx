import { PublicInformationCard, PublicInformationShell } from '@/components/public/PublicInformationShell'

export default function TermsPage() {
  return (
    <PublicInformationShell
      description='Current terms information for the JPV Bootcamp website and membership.'
      eyebrow='JPV Bootcamp'
      title='Terms of Use'
    >
      <PublicInformationCard title='Approval status'>
        <p>
          Final cancellation, renewal, refund, guarantee, and commitment wording is pending client and legal approval.
        </p>
      </PublicInformationCard>

      <PublicInformationCard title='Membership and payments'>
        <p>
          JPV Bootcamp offers one paid JPV Bootcamp Membership. Voucher-funded and pay-it-forward-funded access use the same Stripe subscription flow. Current prices and checkout options are shown on the website. Card payments are processed through Stripe.
        </p>
      </PublicInformationCard>

      <PublicInformationCard title='Questions'>
        <p>Use the support form on the home page for questions about the current terms.</p>
      </PublicInformationCard>
    </PublicInformationShell>
  )
}
