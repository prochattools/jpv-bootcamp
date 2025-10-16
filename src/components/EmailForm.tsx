'use client'

import { useState } from 'react'
import { toast } from 'react-hot-toast'

interface EmailFormProps {
	source?: string
	placeholder?: string
	buttonText?: string
	showNameField?: boolean
	className?: string
}

export default function EmailForm({
	source = 'website',
	placeholder = 'Enter your email address',
	buttonText = 'Get Started',
	showNameField = false,
	className = ''
}: EmailFormProps) {
	const [email, setEmail] = useState('')
	const [name, setName] = useState('')
	const [isLoading, setIsLoading] = useState(false)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		
		if (!email || !email.includes('@')) {
			toast.error('Please enter a valid email address')
			return
		}

		setIsLoading(true)

		try {
			const response = await fetch('/api/subscribe', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					email,
					name: showNameField ? name : null,
					source
				})
			})

			const data = await response.json()

			if (response.ok) {
				toast.success(data.message || 'Successfully subscribed!')
				setEmail('')
				setName('')
			} else {
				toast.error(data.error || 'Failed to subscribe')
			}
		} catch (error) {
			console.error('Subscription error:', error)
			toast.error('Something went wrong. Please try again.')
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<form onSubmit={handleSubmit} className={`w-full max-w-md ${className}`}>
			<div className="flex flex-col gap-3">
				{showNameField && (
					<input
						type="text"
						placeholder="Your name (optional)"
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="input input-bordered w-full"
						disabled={isLoading}
					/>
				)}
				
				<div className="flex flex-col sm:flex-row gap-2">
					<input
						type="email"
						placeholder={placeholder}
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="input input-bordered flex-1"
						required
						disabled={isLoading}
					/>
					
					<button
						type="submit"
						disabled={isLoading || !email}
						className="btn btn-primary whitespace-nowrap"
					>
						{isLoading ? (
							<>
								<span className="loading loading-spinner loading-sm"></span>
								Subscribing...
							</>
						) : (
							buttonText
						)}
					</button>
				</div>
			</div>
		</form>
	)
}