'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

const REDIRECT_SECONDS = 7

export default function ThankYouClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS)
  const hasSessionId = Boolean(searchParams.get('session_id'))

  useEffect(() => {
    const deadline = Date.now() + REDIRECT_SECONDS * 1000
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }, 1000)

    const timeout = setTimeout(() => {
      router.push('/')
    }, REDIRECT_SECONDS * 1000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [router])

  return (
    <div className='space-y-4 text-sm text-jpv-muted'>
      {hasSessionId ? <p className='jpv-notice'>Payment confirmed.</p> : null}
      <p>
        Redirecting to the home page in <span className='font-semibold text-jpv-ink'>{secondsLeft}</span> seconds…
      </p>
      <Link className='jpv-button-secondary min-h-11' href='/'>
        Go to home now
      </Link>
    </div>
  )
}
