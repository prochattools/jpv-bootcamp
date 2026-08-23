import { redirect } from 'next/navigation'

/**
 * Preserve old affiliate links without exposing the retired placeholder
 * programme. The supported public intake is the partner-referral route.
 */
export default function AffiliateCompatibilityRedirect(): never {
  redirect('/partner-referral')
}
