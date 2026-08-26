"use client"

import { useEffect, useState } from 'react'

type SponsoredCounts = {
	available: number
	enabled?: boolean
}

export default function SponsoredPayItForward() {
	const [counts, setCounts] = useState<SponsoredCounts>({
		available: 0,
		enabled: false,
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
		<div className="rounded-3xl bg-jpv-ink p-6 shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
			<div className="space-y-3">
				<h3 className="text-xl font-semibold text-jpv-canvas">Give a membership place</h3>
				<p className="text-sm text-jpv-canvas">
					Fund one JPV Bootcamp membership for someone who is ready to learn but cannot pay yet.
				</p>
				<div className="mt-4 rounded-2xl border border-jpv-canvas/25 bg-jpv-canvas/10 px-4 py-3">
					<p className="text-xs font-semibold uppercase tracking-[0.14em] text-jpv-canvas/75">Available now</p>
					<p className="mt-1 text-5xl font-bold leading-none tabular-nums text-jpv-canvas">
						{counts.available}
						<span className="ml-2 text-base font-medium align-middle">funded membership {counts.available === 1 ? 'place' : 'places'}</span>
					</p>
				</div>
			</div>
			<div className="mt-6 flex flex-wrap gap-3">
				<button
					type="button"
					onClick={() => handleCheckout()}
					disabled={loading || !counts.enabled}
					className="min-h-11 rounded-jpv-action border border-jpv-canvas/70 px-4 py-2 text-sm font-semibold text-jpv-canvas transition-colors hover:border-jpv-canvas hover:bg-jpv-canvas hover:text-jpv-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-jpv-canvas"
				>
					{loading ? 'Opening secure checkout…' : 'Fund JPV Bootcamp Membership'}
				</button>
			</div>
			{!counts.enabled ? (
				<p className="mt-3 text-xs leading-5 text-jpv-canvas">
					Funding checkout is temporarily unavailable while the sponsored-support price is configured.
				</p>
			) : null}
			{error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
		</div>
	)
}
