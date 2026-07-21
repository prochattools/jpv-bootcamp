"use client"

import { useEffect, useState } from 'react'

type SponsoredCounts = {
	available: number
	enabled?: boolean
}

export default function SponsoredPayItForward() {
	const [counts, setCounts] = useState<SponsoredCounts>({
		available: 0,
		enabled: true,
	})
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState('')

	useEffect(() => {
		let mounted = true
		fetch('/api/sponsored-seats/available')
			.then((res) => res.json())
			.then((data) => {
				if (!mounted) return
				setCounts({
					available: Number(data?.available ?? 0),
					enabled: Boolean(data?.enabled ?? true),
				})
			})
			.catch(() => {
				if (!mounted) return
				setCounts({ available: 0 })
			})
		return () => {
			mounted = false
		}
	}, [])

	async function handleCheckout() {
		setLoading(true)
		setError('')
		try {
			const response = await fetch('/api/sponsored-seats/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})
			const payload = await response.json()
			if (!response.ok || !payload?.url) {
				setError(
					payload?.reason === 'missing_env'
						? 'Sponsor checkout is temporarily unavailable.'
						: 'Unable to start checkout right now.'
				)
				return
			}
			window.location.href = payload.url
		} catch (error) {
			setError('Unable to start checkout right now.')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="jpv-surface-inverse rounded-jpv-panel border border-jpv-canvas/20 p-6 shadow-jpv-card">
			<div className="space-y-3">
				<h3 className="text-xl font-semibold">Pay it forward</h3>
				<p className="jpv-surface-inverse-muted text-sm">
					Some members choose to fund JPV Bootcamp Membership for someone who
					can&apos;t pay yet.
				</p>
				<p className="jpv-surface-inverse-muted text-xs">
					{counts.available} sponsored access seats currently available
				</p>
			</div>
			<div className="mt-6 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={() => handleCheckout()}
					disabled={loading || !counts.enabled}
					className="jpv-button-accent"
				>
					Fund JPV Bootcamp Membership
				</button>
			</div>
			{error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
		</div>
	)
}
