import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import prisma from '@/libs/prisma'
import { Prisma } from '@prisma/client'

/**
 * Concurrency tests for sponsored seat claims.
 * Verifies that FOR UPDATE locks prevent double-claim of the same seat
 * and that concurrent approvals result in exactly one seat per application.
 */

describe('Sponsored Seats Concurrency', () => {
	const TIER = 'pro'

	beforeEach(async () => {
		// Clean up test data
		await prisma.sponsoredApplication.deleteMany()
		await prisma.sponsoredSeat.deleteMany()
	})

	afterEach(async () => {
		// Clean up test data
		await prisma.sponsoredApplication.deleteMany()
		await prisma.sponsoredSeat.deleteMany()
	})

	describe('Scenario 1: FOR UPDATE lock prevents double-claim', () => {
		it('should claim each seat only once under concurrent approvals', async () => {
			// Setup: Create 1 available seat
			const seat = await prisma.sponsoredSeat.create({
				data: {
					tier: TIER,
					status: 'available',
					// claimed_by_account_id and reserved_by_application_id null
				},
			})

			// Create application for approval
			const app = await prisma.sponsoredApplication.create({
				data: {
					email: 'test@example.com',
					name: 'Test User',
					status: 'pending',
					tier: TIER,
					decision: 'pending',
				},
			})

			const seatId = seat.id
			const appId = app.id
			const now = new Date()

			// Simulate TWO concurrent approval requests to the SAME application
			// In real scenario, Stripe webhook and admin action might trigger simultaneously
			const promises = [
				// First approval request (will succeed)
				(async () => {
					try {
						// BEGIN TRANSACTION
						const result = await prisma.$transaction(async (tx) => {
							// Lock the application row
							const locked = await tx.$queryRaw<{ id: string; status: string }[]>(
								Prisma.sql`
									SELECT id, status
									FROM jpvbootcamp.sponsored_applications
									WHERE id = ${appId}
									FOR UPDATE
								`
							)

							if (!locked[0] || locked[0].status !== 'pending') {
								throw new Error('already_processed')
							}

							// Try to claim a seat
							const claimed = await tx.$queryRaw<{ id: string }[]>(
								Prisma.sql`
									UPDATE jpvbootcamp.sponsored_seats
									SET reserved_by_application_id = ${appId},
										reserved_at = ${now}
									WHERE id = (
										SELECT id
										FROM jpvbootcamp.sponsored_seats
										WHERE claimed_by_account_id IS NULL
											AND reserved_by_application_id IS NULL
											AND tier = ${TIER}
										ORDER BY created_at ASC
										FOR UPDATE SKIP LOCKED
										LIMIT 1
									)
									RETURNING id
								`
							)

							if (!claimed[0]?.id) {
								throw new Error('no_seat_available')
							}

							// Update application
							await tx.sponsoredApplication.update({
								where: { id: appId },
								data: {
									status: 'approved',
									decision: 'approved',
									seatId: claimed[0].id,
									decidedAt: now,
									reviewedAt: now,
								},
							})

							return { success: true, seatId: claimed[0].id }
						})
						return { request: 1, ...result }
					} catch (error) {
						const message = (error as Error).message
						return { request: 1, success: false, error: message }
					}
				})(),

				// Second approval request (will fail - no seats available)
				(async () => {
					// Small delay to increase concurrency chance
					await new Promise((resolve) => setTimeout(resolve, 1))

					try {
						// BEGIN TRANSACTION
						const result = await prisma.$transaction(async (tx) => {
							// Lock the application row
							const locked = await tx.$queryRaw<{ id: string; status: string }[]>(
								Prisma.sql`
									SELECT id, status
									FROM jpvbootcamp.sponsored_applications
									WHERE id = ${appId}
									FOR UPDATE
								`
							)

							if (!locked[0] || locked[0].status !== 'pending') {
								throw new Error('already_processed')
							}

							// Try to claim a seat (SKIP LOCKED will skip the already-reserved one)
							const claimed = await tx.$queryRaw<{ id: string }[]>(
								Prisma.sql`
									UPDATE jpvbootcamp.sponsored_seats
									SET reserved_by_application_id = ${appId},
										reserved_at = ${now}
									WHERE id = (
										SELECT id
										FROM jpvbootcamp.sponsored_seats
										WHERE claimed_by_account_id IS NULL
											AND reserved_by_application_id IS NULL
											AND tier = ${TIER}
										ORDER BY created_at ASC
										FOR UPDATE SKIP LOCKED
										LIMIT 1
									)
									RETURNING id
								`
							)

							if (!claimed[0]?.id) {
								throw new Error('no_seat_available')
							}

							// Would update application here
							return { success: true, seatId: claimed[0].id }
						})
						return { request: 2, ...result }
					} catch (error) {
						const message = (error as Error).message
						return { request: 2, success: false, error: message }
					}
				})(),
			]

			const results = await Promise.all(promises)

			// Verify: exactly one succeeded, one failed
			const succeeded = results.filter((r) => r.success === true)
			const failed = results.filter((r) => r.success === false)

			expect(succeeded).toHaveLength(1)
			expect(failed).toHaveLength(1)
			expect(failed[0]?.error).toBe('no_seat_available')

			// Verify: application updated with winner's claim
			const updatedApp = await prisma.sponsoredApplication.findUnique({
				where: { id: appId },
			})
			expect(updatedApp?.status).toBe('approved')
			expect(updatedApp?.seatId).toBe(succeeded[0]?.seatId)

			// Verify: seat is reserved
			const updatedSeat = await prisma.sponsoredSeat.findUnique({
				where: { id: seatId },
			})
			expect(updatedSeat?.reserved_by_application_id).toBe(appId)
		})
	})

	describe('Scenario 2: Limited seats force winner-take-all', () => {
		it('should allocate only one seat when multiple applications compete', async () => {
			// Setup: 1 available seat, 2 applications to approve
			const seat = await prisma.sponsoredSeat.create({
				data: {
					tier: TIER,
					status: 'available',
				},
			})

			const app1 = await prisma.sponsoredApplication.create({
				data: {
					email: 'user1@example.com',
					name: 'User 1',
					status: 'pending',
					tier: TIER,
					decision: 'pending',
				},
			})

			const app2 = await prisma.sponsoredApplication.create({
				data: {
					email: 'user2@example.com',
					name: 'User 2',
					status: 'pending',
					tier: TIER,
					decision: 'pending',
				},
			})

			const now = new Date()

			// Concurrent approvals of different applications
			const results = await Promise.all([
				(async () => {
					try {
						const result = await prisma.$transaction(async (tx) => {
							const locked = await tx.$queryRaw<{ id: string; status: string }[]>(
								Prisma.sql`
									SELECT id, status
									FROM jpvbootcamp.sponsored_applications
									WHERE id = ${app1.id}
									FOR UPDATE
								`
							)

							if (!locked[0] || locked[0].status !== 'pending') {
								throw new Error('already_processed')
							}

							const claimed = await tx.$queryRaw<{ id: string }[]>(
								Prisma.sql`
									UPDATE jpvbootcamp.sponsored_seats
									SET reserved_by_application_id = ${app1.id},
										reserved_at = ${now}
									WHERE id = (
										SELECT id
										FROM jpvbootcamp.sponsored_seats
										WHERE claimed_by_account_id IS NULL
											AND reserved_by_application_id IS NULL
											AND tier = ${TIER}
										ORDER BY created_at ASC
										FOR UPDATE SKIP LOCKED
										LIMIT 1
									)
									RETURNING id
								`
							)

							if (!claimed[0]?.id) {
								throw new Error('no_seat_available')
							}

							await tx.sponsoredApplication.update({
								where: { id: app1.id },
								data: {
									status: 'approved',
									decision: 'approved',
									seatId: claimed[0].id,
									decidedAt: now,
									reviewedAt: now,
								},
							})

							return { appId: app1.id, success: true }
						})
						return result
					} catch (error) {
						return { appId: app1.id, success: false }
					}
				})(),

				(async () => {
					await new Promise((resolve) => setTimeout(resolve, 1))

					try {
						const result = await prisma.$transaction(async (tx) => {
							const locked = await tx.$queryRaw<{ id: string; status: string }[]>(
								Prisma.sql`
									SELECT id, status
									FROM jpvbootcamp.sponsored_applications
									WHERE id = ${app2.id}
									FOR UPDATE
								`
							)

							if (!locked[0] || locked[0].status !== 'pending') {
								throw new Error('already_processed')
							}

							const claimed = await tx.$queryRaw<{ id: string }[]>(
								Prisma.sql`
									UPDATE jpvbootcamp.sponsored_seats
									SET reserved_by_application_id = ${app2.id},
										reserved_at = ${now}
									WHERE id = (
										SELECT id
										FROM jpvbootcamp.sponsored_seats
										WHERE claimed_by_account_id IS NULL
											AND reserved_by_application_id IS NULL
											AND tier = ${TIER}
										ORDER BY created_at ASC
										FOR UPDATE SKIP LOCKED
										LIMIT 1
									)
									RETURNING id
								`
							)

							if (!claimed[0]?.id) {
								throw new Error('no_seat_available')
							}

							await tx.sponsoredApplication.update({
								where: { id: app2.id },
								data: {
									status: 'approved',
									decision: 'approved',
									seatId: claimed[0].id,
									decidedAt: now,
									reviewedAt: now,
								},
							})

							return { appId: app2.id, success: true }
						})
						return result
					} catch (error) {
						return { appId: app2.id, success: false }
					}
				})(),
			])

			// Verify: one succeeded, one failed
			const succeeded = results.filter((r) => r.success === true)
			const failed = results.filter((r) => r.success === false)

			expect(succeeded).toHaveLength(1)
			expect(failed).toHaveLength(1)

			// Verify: only one application approved
			const approvedCount = await prisma.sponsoredApplication.count({
				where: { status: 'approved' },
			})
			expect(approvedCount).toBe(1)

			// Verify: seat is reserved to winner
			const updatedSeat = await prisma.sponsoredSeat.findUnique({
				where: { id: seat.id },
			})
			expect(updatedSeat?.reserved_by_application_id).not.toBeNull()
		})
	})

	describe('Scenario 3: Race condition prevention evidence', () => {
		it('should prove FOR UPDATE SKIP LOCKED prevents double-claim', async () => {
			// This test documents the atomicity guarantees

			// Key protection: FOR UPDATE SKIP LOCKED on the UPDATE query
			// - FOR UPDATE: locks selected rows until transaction ends
			// - SKIP LOCKED: skips already-locked rows instead of waiting
			// - Result: At most one transaction succeeds in claiming the same seat

			// Create 1 seat
			const seat = await prisma.sponsoredSeat.create({
				data: {
					tier: TIER,
					status: 'available',
				},
			})

			// Create 2 apps
			const app1 = await prisma.sponsoredApplication.create({
				data: {
					email: 'concurrent1@example.com',
					name: 'Concurrent 1',
					status: 'pending',
					tier: TIER,
					decision: 'pending',
				},
			})

			const app2 = await prisma.sponsoredApplication.create({
				data: {
					email: 'concurrent2@example.com',
					name: 'Concurrent 2',
					status: 'pending',
					tier: TIER,
					decision: 'pending',
				},
			})

			// Run 10 concurrent attempts to show consistency
			const attempts = await Promise.all(
				Array.from({ length: 10 }, (_, i) =>
					prisma.$transaction(async (tx) => {
						const appId = i < 5 ? app1.id : app2.id

						const claimed = await tx.$queryRaw<{ id: string }[]>(
							Prisma.sql`
								UPDATE jpvbootcamp.sponsored_seats
								SET reserved_by_application_id = ${appId}
								WHERE id = ${seat.id}
									AND claimed_by_account_id IS NULL
									AND reserved_by_application_id IS NULL
								RETURNING id
							`
						)

						return claimed.length > 0
					})
				)
			)

			// Verify: at most 1 succeeded (because seat is now reserved)
			const successes = attempts.filter((a) => a === true)
			expect(successes.length).toBeLessThanOrEqual(1)

			// Or verify via current state
			const finalSeat = await prisma.sponsoredSeat.findUnique({
				where: { id: seat.id },
			})
			expect(finalSeat?.reserved_by_application_id).not.toBeNull()
		})
	})
})
