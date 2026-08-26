"use client"

import { useState } from 'react'

type SponsoredCounts = {
	available: number
}

type Props = {
	initialCounts: SponsoredCounts
}

export default function SponsoredApplyForm({ initialCounts }: Props) {
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [phone, setPhone] = useState('')
	const [message, setMessage] = useState('')
	const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
	const [note, setNote] = useState('')
	const [counts] = useState(initialCounts)

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault()
		setStatus('submitting')
		setNote('')
		try {
			const response = await fetch('/api/sponsored-applications', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, phone, message }),
			})
			const payload = await response.json()
			if (!response.ok) {
				setStatus('error')
				setNote(payload?.reason ?? 'Unable to submit right now.')
				return
			}
			setStatus('success')
			switch (payload?.outcome) {
				case 'updated_existing_pending':
					setNote('Application updated. Status: still pending.')
					break
				case 'already_approved':
					setNote('Your application was already approved. Check your email.')
					break
				case 'already_claimed':
					setNote('Your sponsored access is already claimed.')
					break
				case 'already_rejected':
					setNote('Your application was already reviewed. Please check your email.')
					break
				case 'created_new':
				default:
					setNote('Application submitted. Status: pending.')
					break
			}
		} catch (error) {
			setStatus('error')
			setNote('Unable to submit right now.')
		}
	}

	return (
		<div className="space-y-7">
			<div className="rounded-jpv-card border border-jpv-border bg-jpv-surface px-4 py-3 text-sm leading-6 text-jpv-ink">
				<span className="font-semibold text-jpv-green-deep">Available right now:</span>{' '}
				{counts.available} pay-it-forward-funded membership places
			</div>
			<form onSubmit={handleSubmit} className="space-y-5">
				<div>
					<label className="text-sm font-semibold text-jpv-ink" htmlFor="sponsored-name">Name</label>
					<input
						id="sponsored-name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						required
						autoComplete="name"
						className="mt-2 min-h-12 w-full rounded-jpv-action border border-jpv-border bg-jpv-canvas px-4 py-3 text-base text-jpv-ink shadow-sm outline-none placeholder:text-jpv-muted/75 focus:border-jpv-green focus:ring-2 focus:ring-jpv-green/20"
						placeholder="Your name"
					/>
				</div>
				<div>
					<label className="text-sm font-semibold text-jpv-ink" htmlFor="sponsored-email">Email</label>
					<input
						id="sponsored-email"
						type="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						required
						autoComplete="email"
						className="mt-2 min-h-12 w-full rounded-jpv-action border border-jpv-border bg-jpv-canvas px-4 py-3 text-base text-jpv-ink shadow-sm outline-none placeholder:text-jpv-muted/75 focus:border-jpv-green focus:ring-2 focus:ring-jpv-green/20"
						placeholder="you@example.com"
					/>
				</div>
				<div>
					<label className="text-sm font-semibold text-jpv-ink" htmlFor="sponsored-phone">
						Phone number
					</label>
					<input
						id="sponsored-phone"
						type="tel"
						value={phone}
						onChange={(event) => setPhone(event.target.value)}
						required
						autoComplete="tel"
						inputMode="tel"
						className="mt-2 min-h-12 w-full rounded-jpv-action border border-jpv-border bg-jpv-canvas px-4 py-3 text-base text-jpv-ink shadow-sm outline-none placeholder:text-jpv-muted/75 focus:border-jpv-green focus:ring-2 focus:ring-jpv-green/20"
						placeholder="+44 20 7946 0958"
					/>
					<p className="mt-2 text-xs leading-5 text-jpv-muted">
						Include the country code. Any international format is fine.
					</p>
				</div>
				<div>
					<label className="text-sm font-semibold text-jpv-ink" htmlFor="sponsored-message">
						Message (optional)
					</label>
					<textarea
						id="sponsored-message"
						value={message}
						onChange={(event) => setMessage(event.target.value)}
						rows={4}
						className="mt-2 w-full resize-y rounded-jpv-action border border-jpv-border bg-jpv-canvas px-4 py-3 text-base text-jpv-ink shadow-sm outline-none placeholder:text-jpv-muted/75 focus:border-jpv-green focus:ring-2 focus:ring-jpv-green/20"
						placeholder="Share a bit about your situation"
					/>
				</div>
				<button
					type="submit"
					disabled={status === 'submitting'}
					className="jpv-button-primary min-h-12 px-6"
				>
					{status === 'submitting' ? 'Submitting...' : 'Submit application'}
				</button>
			</form>
			{note ? (
				<p
					aria-live="polite"
					className={`rounded-jpv-card border px-4 py-3 text-sm ${
						status === 'error'
							? 'border-jpv-danger/30 bg-jpv-danger/5 text-jpv-danger'
							: 'border-jpv-green/25 bg-jpv-green/5 text-jpv-green-deep'
					}`}
				>
					{note}
				</p>
			) : null}
		</div>
	)
}
