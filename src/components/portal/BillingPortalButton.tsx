'use client'

import { useState } from 'react'
import { openBillingPortal } from '@/lib/actions/openBillingPortal'

export function BillingPortalButton() {
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleClick = async () => {
		setIsLoading(true)
		setError(null)

		try {
			const result = await openBillingPortal()

			if (result.ok === false) {
				const errorMap: Record<string, string> = {
					unauthenticated: 'Authentication failed. Please log in again.',
					no_stripe_customer: 'No linked Stripe customer was found yet. Your billing record is still being synchronized.',
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
				type='button'
				onClick={handleClick}
				disabled={isLoading}
				className='jpv-button-primary'
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
