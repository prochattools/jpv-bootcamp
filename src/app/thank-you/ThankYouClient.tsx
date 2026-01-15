'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const REDIRECT_SECONDS = 7

export default function ThankYouClient() {
	const router = useRouter()
	const searchParams = useSearchParams()
	const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS)
	const hasSessionId = Boolean(searchParams.get('session_id'))

	useEffect(() => {
		const deadline = Date.now() + REDIRECT_SECONDS * 1000
		const interval = setInterval(() => {
			const remaining = Math.max(
				0,
				Math.ceil((deadline - Date.now()) / 1000)
			)
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
		<div className="space-y-4 text-sm text-jpv-gray-300">
			{hasSessionId ? (
				<p className="text-jpv-green/80">Payment confirmed.</p>
			) : null}
			<p>
				Redirecting to the home page in{' '}
				<span className="font-semibold text-jpv-gray-100">{secondsLeft}</span>{' '}
				seconds...
			</p>
			<Link
				href="/"
				className="inline-flex items-center justify-center rounded-full border border-jpv-gray-600 px-6 py-2 text-sm font-semibold text-jpv-gray-100 transition hover:border-jpv-green hover:text-white"
			>
				Go to home now
			</Link>
		</div>
	)
}
