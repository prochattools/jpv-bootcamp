import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/libs/prisma'

export async function POST(req: NextRequest) {
	try {
		const { email, name, source } = await req.json()

		// Validate email
		if (!email || !email.includes('@')) {
			return NextResponse.json(
				{ error: 'Valid email is required' },
				{ status: 400 }
			)
		}

		// Check if email already exists
		const existingSubscriber = await prisma.emailSubscriber.findUnique({
			where: { email }
		})

		if (existingSubscriber) {
			return NextResponse.json(
				{ error: 'Email already subscribed' },
				{ status: 409 }
			)
		}

		// Create new subscriber
		const subscriber = await prisma.emailSubscriber.create({
			data: {
				email,
				name: name || null,
				source: source || 'website'
			}
		})

		// Send welcome email
		try {
			const { resendService } = await import('@/libs/resend')
			await resendService.sendWelcomeEmail(email, name)
		} catch (emailError) {
			console.error('Failed to send welcome email:', emailError)
			// Don't fail the subscription if email fails
		}

		return NextResponse.json({
			success: true,
			message: 'Successfully subscribed!',
			subscriber: {
				id: subscriber.id,
				email: subscriber.email,
				createdAt: subscriber.createdAt
			}
		})

	} catch (error) {
		console.error('Subscription error:', error)
		return NextResponse.json(
			{ error: 'Failed to subscribe. Please try again.' },
			{ status: 500 }
		)
	}
}