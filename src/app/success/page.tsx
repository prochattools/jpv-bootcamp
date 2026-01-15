import { redirect } from 'next/navigation'

type SuccessPageProps = {
  searchParams?: {
    session_id?: string
  }
}

export default function SuccessPage({ searchParams }: SuccessPageProps) {
  const sessionId = searchParams?.session_id
  const target = sessionId ? `/thank-you?session_id=${sessionId}` : '/thank-you'
  redirect(target)
}
