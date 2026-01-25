"use client"

import { useEffect, useState } from 'react'

type SponsoredCounts = {
	pro: number
	vip: number
	proEnabled?: boolean
	vipEnabled?: boolean
}

export default function SponsoredPayItForward() {
	const [counts, setCounts] = useState<SponsoredCounts>({
		pro: 0,
		vip: 0,
		proEnabled: true,
		vipEnabled: false,
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
					pro: Number(data?.pro ?? 0),
					vip: Number(data?.vip ?? 0),
					proEnabled: Boolean(data?.proEnabled ?? true),
					vipEnabled: Boolean(data?.vipEnabled ?? false),
				})
			})
			.catch(() => {
				if (!mounted) return
				setCounts({ pro: 0, vip: 0 })
			})
		return () => {
			mounted = false
		}
	}, [])

	async function handleCheckout(tier: 'pro' | 'vip') {
		setLoading(true)
		setError('')
		try {
			const response = await fetch('/api/sponsored-seats/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tier }),
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
		<div className="rounded-3xl border border-jpv-gray-700/50 bg-jpv-bg-dark/60 p-6 shadow-jpv-card backdrop-blur">
			<div className="space-y-3">
				<h3 className="text-xl font-semibold text-white">Pay it forward</h3>
				<p className="text-sm text-jpv-gray-300">
					Some members choose to sponsor a 1-month membership for someone who
					can&apos;t afford it yet.
				</p>
				<p className="text-xs text-jpv-gray-400">
					{counts.pro + counts.vip} sponsored memberships currently available
				</p>
			</div>
			<div className="mt-6 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={() => handleCheckout('pro')}
					disabled={loading}
					className="rounded-full border border-jpv-gray-600 px-4 py-2 text-sm font-semibold text-jpv-gray-100 hover:border-jpv-green hover:text-white"
				>
					Sponsor a Pro month
				</button>
				{counts.vipEnabled ? (
					<button
						type="button"
						onClick={() => handleCheckout('vip')}
						disabled={loading}
						className="rounded-full border border-jpv-gray-600 px-4 py-2 text-sm font-semibold text-jpv-gray-100 hover:border-jpv-green hover:text-white"
					>
						Sponsor a VIP month
					</button>
				) : null}
			</div>
			{error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
		</div>
	)
}
