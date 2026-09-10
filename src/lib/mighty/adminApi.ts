import { normalizeEmail } from '@/lib/normalize-email'

import { getMightyConfig, type MightyConfig } from './config'

export type MightyMember = {
	id: number | string
	email: string
	first_name?: string | null
	last_name?: string | null
	permalink?: string | null
}

export type MightyPlan = {
	id: number | string
	name?: string | null
	status?: string | null
	pricing_type?: string | null
}

export type MightyPurchase = {
	member_id: number | string
	member_email?: string | null
	plan?: { id?: number | string | null } | null
	purchase?: { id?: number | string | null } | null
}

export type MightyAccessState = {
	memberId: string
	planId: string
	purchases: MightyPurchase[]
	memberPlanAccess: boolean
	hasAccess: boolean
}

type Paginated<T> = {
	items: T[]
	links?: { next?: string | null }
}

export class MightyApiError extends Error {
	readonly status: number

	constructor(status: number) {
		super(`mighty_api_error_${status}`)
		this.name = 'MightyApiError'
		this.status = status
	}
}

type FetchLike = typeof fetch

const MIGHTY_USER_AGENT = 'jpv-bootcamp-mighty-sync/1.0 (+https://jpvbootcamp.com)'

function numericId(value: number | string): string {
	const normalized = String(value).trim()
	if (!normalized) throw new Error('Mighty ID is required')
	return normalized
}

function firstNameFromEmail(email: string): string {
	return email.split('@', 1)[0] || 'JPV member'
}

export class MightyAdminApi {
	constructor(
		private readonly config: MightyConfig = getMightyConfig(),
		private readonly fetchImpl: FetchLike = fetch,
	) {}

	private buildUrl(path: string, params?: Record<string, string | number | undefined>): URL {
		const url = new URL(`${this.config.apiBaseUrl}/${path.replace(/^\//, '')}`)
		for (const [key, value] of Object.entries(params ?? {})) {
			if (value !== undefined) url.searchParams.set(key, String(value))
		}
		return url
	}

	private async request<T>(
		method: string,
		path: string,
		params?: Record<string, string | number | undefined>,
		body?: unknown,
		allowNotFound = false,
	): Promise<T | null> {
		const response = await this.fetchImpl(this.buildUrl(path, params), {
			method,
			headers: {
				Authorization: `Bearer ${this.config.adminApiToken}`,
				Accept: 'application/json',
				'User-Agent': MIGHTY_USER_AGENT,
				...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		})

		if (response.status === 404 && allowNotFound) return null
		if (!response.ok) throw new MightyApiError(response.status)
		if (response.status === 204) return null
		return (await response.json()) as T
	}

	private async getNextPage<T>(next: string | null | undefined): Promise<Paginated<T> | null> {
		if (!next) return null
		const nextUrl = new URL(next, this.config.apiBaseUrl)
		const baseUrl = new URL(this.config.apiBaseUrl)
		if (nextUrl.origin !== baseUrl.origin) throw new Error('Mighty pagination link escaped API origin')
		const response = await this.fetchImpl(nextUrl, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${this.config.adminApiToken}`,
				Accept: 'application/json',
				'User-Agent': MIGHTY_USER_AGENT,
			},
		})
		if (!response.ok) throw new MightyApiError(response.status)
		return (await response.json()) as Paginated<T>
	}

	private async collectPages<T>(firstPage: Paginated<T>): Promise<T[]> {
		const items = [...firstPage.items]
		let page: Paginated<T> | null = firstPage
		let pageCount = 0
		while (page?.links?.next) {
			pageCount += 1
			if (pageCount >= 100) throw new Error('Mighty pagination limit exceeded')
			page = await this.getNextPage<T>(page.links.next)
			if (page) items.push(...page.items)
		}
		return items
	}

	async listMembers(): Promise<MightyMember[]> {
		const firstPage = await this.request<Paginated<MightyMember>>(
			'GET',
			`networks/${numericId(this.config.networkId)}/members`,
			{ per_page: 100 },
		)
		return firstPage ? this.collectPages(firstPage) : []
	}

	async findMember(email: string): Promise<MightyMember | null> {
		const normalizedEmail = normalizeEmail(email)
		if (!normalizedEmail) throw new Error('A valid email is required to find a Mighty member')

		let page: Paginated<MightyMember> | null = await this.request<Paginated<MightyMember>>(
			'GET',
			`networks/${numericId(this.config.networkId)}/members`,
			{ per_page: 100 },
		)
		let pageCount = 0
		while (page) {
			const match = page.items.find((member) => normalizeEmail(member.email) === normalizedEmail)
			if (match) return match
			pageCount += 1
			if (pageCount >= 100) throw new Error('Mighty member pagination limit exceeded')
			page = await this.getNextPage<MightyMember>(page.links?.next)
		}
		return null
	}

	async createMember(params: {
		email: string
		firstName?: string | null
		lastName?: string | null
	}): Promise<MightyMember> {
		const email = normalizeEmail(params.email)
		if (!email) throw new Error('A valid email is required to create a Mighty member')
		const result = await this.request<MightyMember>(
			'POST',
			`networks/${numericId(this.config.networkId)}/members`,
			undefined,
			{
				email,
				first_name: params.firstName?.trim() || firstNameFromEmail(email),
				last_name: params.lastName?.trim() || '',
				role: 'contributor',
				send_welcome_email: false,
			},
		)
		if (!result) throw new Error('Mighty member creation returned no member')
		return result
	}

	async findPurchases(memberId: number | string, planId: number | string = this.config.accessPlanId): Promise<MightyPurchase[]> {
		const result = await this.request<Paginated<MightyPurchase>>(
			'GET',
			`networks/${numericId(this.config.networkId)}/purchases`,
			{ member_id: numericId(memberId), plan_id: planId, per_page: 100 },
		)
		return result?.items ?? []
	}

	async listMemberPlans(memberId: number | string): Promise<MightyPlan[]> {
		const firstPage = await this.request<Paginated<MightyPlan>>(
			'GET',
			`networks/${numericId(this.config.networkId)}/members/${numericId(memberId)}/plans`,
			{ per_page: 100 },
		)
		return firstPage ? this.collectPages(firstPage) : []
	}

	async findAllPurchases(): Promise<MightyPurchase[]> {
		const firstPage = await this.request<Paginated<MightyPurchase>>(
			'GET',
			`networks/${numericId(this.config.networkId)}/purchases`,
			{ per_page: 100 },
		)
		return firstPage ? this.collectPages(firstPage) : []
	}

	async getAccessState(memberId: number | string, planId: number | string = this.config.accessPlanId): Promise<MightyAccessState> {
		const normalizedMemberId = numericId(memberId)
		const normalizedPlanId = numericId(planId)
		const [purchases, memberPlans] = await Promise.all([
			this.findPurchases(normalizedMemberId, normalizedPlanId),
			this.listMemberPlans(normalizedMemberId),
		])
		const memberPlanAccess = memberPlans.some((plan) => String(plan.id) === normalizedPlanId)
		return {
			memberId: normalizedMemberId,
			planId: normalizedPlanId,
			purchases,
			memberPlanAccess,
			hasAccess: memberPlanAccess || purchases.some((purchase) => String(purchase.purchase?.id ?? '').trim().length > 0),
		}
	}

	async grantAccess(memberId: number | string, planId = this.config.accessPlanId): Promise<MightyPlan> {
		const result = await this.request<MightyPlan>(
			'POST',
			`networks/${numericId(this.config.networkId)}/plans/${numericId(planId)}/members`,
			{ user_id: numericId(memberId) },
		)
		if (!result) throw new Error('Mighty grant returned no plan')
		return result
	}

	async restoreAccess(memberId: number | string, planId = this.config.accessPlanId): Promise<MightyPlan> {
		return this.grantAccess(memberId, planId)
	}

	async revokeAccess(
		purchaseId: number | string,
		params: { immediate?: boolean } = {},
	): Promise<MightyPurchase | null> {
		return this.request<MightyPurchase>(
			'DELETE',
			`networks/${numericId(this.config.networkId)}/purchases/${numericId(purchaseId)}`,
			{ immediate: params.immediate === false ? 'false' : 'true' },
			undefined,
			true,
		)
	}

	async revokePlanAccess(memberId: number | string, planId = this.config.accessPlanId): Promise<null> {
		await this.request<null>(
			'DELETE',
			`networks/${numericId(this.config.networkId)}/plans/${numericId(planId)}/members/${numericId(memberId)}/`,
			undefined,
			undefined,
			true,
		)
		return null
	}
}

export function createMightyAdminApi(
	config: MightyConfig = getMightyConfig(),
	fetchImpl: FetchLike = fetch,
): MightyAdminApi {
	return new MightyAdminApi(config, fetchImpl)
}

export async function findMember(email: string, api = createMightyAdminApi()): Promise<MightyMember | null> {
	return api.findMember(email)
}

export async function createMember(
	params: Parameters<MightyAdminApi['createMember']>[0],
	api = createMightyAdminApi(),
): Promise<MightyMember> {
	return api.createMember(params)
}

export async function grantAccess(
	memberId: number | string,
	planId: number,
	api = createMightyAdminApi(),
): Promise<MightyPlan> {
	return api.grantAccess(memberId, planId)
}

export async function restoreAccess(
	memberId: number | string,
	planId: number,
	api = createMightyAdminApi(),
): Promise<MightyPlan> {
	return api.restoreAccess(memberId, planId)
}

export async function revokeAccess(
	purchaseId: number | string,
	api = createMightyAdminApi(),
): Promise<MightyPurchase | null> {
	return api.revokeAccess(purchaseId, { immediate: true })
}

export async function getAccessState(
	memberId: number | string,
	planId: number | string,
	api = createMightyAdminApi(),
): Promise<MightyAccessState> {
	return api.getAccessState(memberId, planId)
}
