"use client"

import { useState } from 'react'

type SponsoredCounts = {
	pro: number
	vip: number
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
		<div className="space-y-6">
			<div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm text-neutral-700">
				Available right now: {counts.pro} Pro / {counts.vip} VIP
			</div>
			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label className="text-sm font-medium text-neutral-900">Name</label>
					<input
						value={name}
						onChange={(event) => setName(event.target.value)}
						required
						className="mt-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
						placeholder="Your name"
					/>
				</div>
				<div>
					<label className="text-sm font-medium text-neutral-900">Email</label>
					<input
						type="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						required
						className="mt-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
						placeholder="you@example.com"
					/>
				</div>
				<div>
					<label className="text-sm font-medium text-neutral-900">
						Phone number
					</label>
					<input
						type="tel"
						value={phone}
						onChange={(event) => setPhone(event.target.value)}
						required
						autoComplete="tel"
						inputMode="tel"
						className="mt-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
						placeholder="+44 20 7946 0958"
					/>
					<p className="mt-1 text-xs text-neutral-500">
						Include the country code. Any international format is fine.
					</p>
				</div>
				<div>
					<label className="text-sm font-medium text-neutral-900">
						Message (optional)
					</label>
					<textarea
						value={message}
						onChange={(event) => setMessage(event.target.value)}
						rows={4}
						className="mt-2 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
						placeholder="Share a bit about your situation"
					/>
				</div>
				<button
					type="submit"
					disabled={status === 'submitting'}
					className="inline-flex items-center rounded bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
				>
					{status === 'submitting' ? 'Submitting...' : 'Submit application'}
				</button>
			</form>
			{note ? (
				<p
					className={`text-sm ${
						status === 'error' ? 'text-red-600' : 'text-emerald-600'
					}`}
				>
					{note}
				</p>
			) : null}
		</div>
	)
}
