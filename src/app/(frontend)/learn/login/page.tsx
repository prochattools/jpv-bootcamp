import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Member Sign In | JPV Bootcamp',
  description: 'Sign in to your JPV Bootcamp learning portal.',
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function LearnLoginPage() {
  redirect('/portal?mode=login')
}
