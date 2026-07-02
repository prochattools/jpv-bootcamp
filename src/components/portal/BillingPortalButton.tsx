'use client'

import { useState } from 'react'
import { openBillingPortal } from '@/lib/actions/openBillingPortal'

export type BillingPortalButtonProps = {
	memberId: string
	memberEmail: string
}

export function BillingPortalButton({
	memberId,
	memberEmail,
}: BillingPortalButtonProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleClick = async () => {
		setIsLoading(true)
		setError(null)

		try {
			const result = await openBillingPortal(memberId, memberEmail)

			if (result.ok === false) {
				const errorMap: Record<string, string> = {
					unauthenticated: 'Authentication failed. Please log in again.',
					no_stripe_customer: 'No billing account found for this member.',
					stripe_error: 'Billing service is temporarily unavailable.',
					unexpected_error: 'An unexpected error occurred. Please try again.',
				}
				setError(errorMap[result.error] || 'An error occurred.')
				return
			}

			window.location.href = result.portalUrl
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<div className='space-y-4'>
			<button
				onClick={handleClick}
				disabled={isLoading}
				className='inline-flex items-center rounded-lg bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 hover:enabled:bg-neutral-800'
			>
				{isLoading ? 'Opening...' : 'Manage billing'}
			</button>

			{error && (
				<p className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'>
					{error}
				</p>
			)}
		</div>
	)
}
