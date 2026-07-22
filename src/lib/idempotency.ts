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
		findUnique: (args: { where: { eventId: string } }) => Promise<{ eventId: string } | null>
		create: (args: {
			data: {
				eventId: string
				type: string
				livemode: boolean
				receivedAt?: Date
				processedAt?: Date | null
				payload?: unknown
			}
		}) => Promise<{ eventId: string }>
		deleteMany: (args: { where: { receivedAt: { lt: Date } } }) => Promise<{ count: number }>
	}
}

const prismaClient = prisma as unknown as PrismaClientLike

export type MarkProcessedResult = {
	dbAttempted: boolean
	dbSuccess: boolean
	error?: string
}

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
				where: { eventId },
			})
			return Boolean(existing)
		} catch (error) {
			console.debug('Prisma idempotency lookup failed, falling back to memory.', {
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

export type AtomicCheckAndMarkResult = {
	isNew: boolean
	dbAttempted: boolean
	dbSuccess: boolean
	error?: string
}

export async function atomicCheckAndMarkProcessed(params: {
	eventId: string
	eventType: string
	livemode: boolean
	payload?: unknown
}): Promise<AtomicCheckAndMarkResult> {
	const ttlMs = getTtlMs()
	const { eventId, eventType, livemode, payload } = params
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		try {
			const existing = await prismaClient.stripeWebhookEvent.findUnique({
				where: { eventId },
			})
			if (existing) {
				return { isNew: false, dbAttempted: true, dbSuccess: true }
			}
			await prismaClient.stripeWebhookEvent.create({
				data: {
					eventId,
					type: eventType,
					livemode,
					receivedAt: new Date(),
					processedAt: new Date(),
					payload,
				},
			})
			await prismaClient.stripeWebhookEvent.deleteMany({
				where: { receivedAt: { lt: new Date(Date.now() - ttlMs) } },
			})
			return { isNew: true, dbAttempted: true, dbSuccess: true }
		} catch (error) {
			if (isPrismaUniqueError(error)) {
				return { isNew: false, dbAttempted: true, dbSuccess: true }
			}
			console.debug('Prisma idempotency check-and-mark failed, falling back to memory.', {
				message: (error as Error).message,
			})
			const seenBefore = memoryStore.has(eventId)
			memoryStore.set(eventId, Date.now())
			return {
				isNew: !seenBefore,
				dbAttempted: true,
				dbSuccess: false,
				error: (error as Error).message,
			}
		}
	}

	const seenBefore = memoryStore.has(eventId)
	memoryStore.set(eventId, Date.now())
	return { isNew: !seenBefore, dbAttempted: false, dbSuccess: false }
}

export async function markProcessed(params: {
	eventId: string
	eventType: string
	livemode: boolean
	payload?: unknown
}): Promise<MarkProcessedResult> {
	const ttlMs = getTtlMs()
	const { eventId, eventType, livemode, payload } = params
	if (shouldUsePrisma && prismaClient.stripeWebhookEvent) {
		try {
			await prismaClient.stripeWebhookEvent.create({
				data: {
					eventId,
					type: eventType,
					livemode,
					receivedAt: new Date(),
					processedAt: new Date(),
					payload,
				},
			})
			await prismaClient.stripeWebhookEvent.deleteMany({
				where: { receivedAt: { lt: new Date(Date.now() - ttlMs) } },
			})
			return { dbAttempted: true, dbSuccess: true }
		} catch (error) {
			if (isPrismaUniqueError(error)) {
				return { dbAttempted: true, dbSuccess: true }
			}
			console.debug('Prisma idempotency write failed, falling back to memory.', {
				message: (error as Error).message,
			})
			memoryStore.set(eventId, Date.now())
			return {
				dbAttempted: true,
				dbSuccess: false,
				error: (error as Error).message,
			}
		}
	}

	memoryStore.set(eventId, Date.now())
	return { dbAttempted: false, dbSuccess: false }
}
