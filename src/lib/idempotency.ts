import 'server-only'
import prisma from '@/libs/prisma'
import { getOpsConfig } from '@/lib/config'

// In-memory fallback is only suitable for development; use DB/Redis in production.
const memoryStore = new Map<string, number>()
const shouldUsePrisma = Boolean(process.env.DATABASE_URL)
let cachedTtlMs: number | null = null

function getTtlMs(): number {
	if (cachedTtlMs === null) {
		const ops = getOpsConfig()
		cachedTtlMs = ops.idempotencyTtlHours * 60 * 60 * 1000
	}
	return cachedTtlMs
}

type PrismaClientLike = {
	stripeWebhookEvent?: {
		findUnique: (args: {
			where: { stripeEventId: string }
		}) => Promise<{ stripeEventId: string } | null>
		create: (args: {
			data: {
				stripeEventId: string
				eventType: string
				livemode?: boolean
				receivedAt?: Date
				processedAt?: Date | null
				payload?: unknown
			}
		}) => Promise<{ stripeEventId: string }>
		deleteMany: (args: { where: { receivedAt: { lt: Date } } }) => Promise<{ count: number }>
	}
}

const prismaClient = prisma as unknown as PrismaClientLike

function pruneMemoryStore(now: number, ttlMs: number) {
	memoryStore.forEach((timestamp, eventId) => {
		if (now - timestamp > ttlMs) {
			memoryStore.delete(eventId)
		}
	})
}

function isPrismaUniqueError(error: unknown): boolean {
	return Boolean(
		typeof error === 'object' &&
			error &&
			'code' in error &&
			(error as { code?: string }).code === 'P2002'
	)
}

export async function hasProcessed(eventId: string): Promise<boolean> {
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		try {
			const existing = await prismaClient.stripeWebhookEvent.findUnique({
				where: { stripeEventId: eventId },
			})
			return Boolean(existing)
		} catch (error) {
			console.warn('Prisma idempotency lookup failed, falling back to memory.', {
				message: (error as Error).message,
			})
		}
	}

	const now = Date.now()
	const ttlMs = getTtlMs()
	pruneMemoryStore(now, ttlMs)
	const seenAt = memoryStore.get(eventId)
	return typeof seenAt === 'number' && now - seenAt <= ttlMs
}

export async function markProcessed(params: {
	eventId: string
	eventType: string
	livemode?: boolean
	payload?: unknown
}): Promise<void> {
	const ttlMs = getTtlMs()
	const { eventId, eventType, livemode, payload } = params
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		try {
			await prismaClient.stripeWebhookEvent.create({
				data: {
					stripeEventId: eventId,
					eventType,
					livemode: Boolean(livemode),
					receivedAt: new Date(),
					processedAt: new Date(),
					payload,
				},
			})
			await prismaClient.stripeWebhookEvent.deleteMany({
				where: { receivedAt: { lt: new Date(Date.now() - ttlMs) } },
			})
			return
		} catch (error) {
			if (isPrismaUniqueError(error)) return
			console.warn('Prisma idempotency write failed, falling back to memory.', {
				message: (error as Error).message,
			})
		}
	}

	memoryStore.set(eventId, Date.now())
}
