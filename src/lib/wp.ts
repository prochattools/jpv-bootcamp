import 'server-only'
import crypto from 'node:crypto'
import { config } from '@/lib/config'

type WpUser = {
	id: number
	email?: string
	user_email?: string
	slug?: string
}

type WpError = {
	code?: string
	message?: string
}

type WpResponse<T> =
	| { ok: true; data: T }
	| { ok: false; status: number; data: WpError | null; text: string }

function getAuthHeader(): string {
	const token = Buffer.from(
		`${config.wp.username}:${config.wp.appPassword}`,
		'utf8'
	).toString('base64')
	return `Basic ${token}`
}

async function wpRequest<T>(path: string, init: RequestInit = {}): Promise<WpResponse<T>> {
	const url = new URL(path, config.wp.baseUrl)
	const response = await fetch(url, {
		...init,
		headers: {
			Authorization: getAuthHeader(),
			Accept: 'application/json',
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
			...init.headers,
		},
		cache: 'no-store',
	})

	const text = await response.text()
	let data: WpError | null = null
	try {
		data = text ? (JSON.parse(text) as WpError) : null
	} catch {
		data = null
	}

	if (!response.ok) {
		return { ok: false, status: response.status, data, text }
	}

	return { ok: true, data: data as T }
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase()
}

function generateUsername(email: string): string {
	const localPart = email.split('@')[0] ?? 'user'
	const base = localPart.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'
	const suffix = crypto.randomBytes(2).toString('hex')
	return `${base}-${suffix}`
}

function generatePassword(): string {
	return crypto.randomBytes(24).toString('base64url')
}

function extractErrorCode(response: WpResponse<unknown>): string | null {
	if (response.ok) return null
	return typeof response.data?.code === 'string' ? response.data.code : null
}

export async function wpFindUserByEmail(
	email: string
): Promise<{ id: number } | null> {
	const normalized = normalizeEmail(email)
	const search = encodeURIComponent(normalized)
	const response = await wpRequest<WpUser[]>(
		`/wp-json/wp/v2/users?search=${search}&context=edit&per_page=100`,
		{ method: 'GET' }
	)

	if (!response.ok) {
		console.warn('WP user search failed', { status: response.status })
		return null
	}

	const match = response.data.find((user) => {
		const userEmail = user.email ?? user.user_email
		return userEmail?.toLowerCase() === normalized
	})

	if (match) return { id: match.id }

	const localPart = normalized.split('@')[0] ?? ''
	const slugMatch = response.data.find(
		(user) => user.slug?.toLowerCase() === localPart
	)
	if (slugMatch) return { id: slugMatch.id }

	if (response.data.length === 1) {
		return { id: response.data[0].id }
	}

	return null
}

export async function wpCreateUser({
	email,
	username,
	firstName,
	lastName,
	role,
}: {
	email: string
	username?: string
	firstName?: string
	lastName?: string
	role: string
}): Promise<{ id: number }> {
	const basePayload: Record<string, unknown> = {
		email,
		username: username ?? generateUsername(email),
		password: generatePassword(),
	}

	if (firstName) basePayload.first_name = firstName
	if (lastName) basePayload.last_name = lastName

	const createWithPayload = async (payload: Record<string, unknown>) => {
		return wpRequest<WpUser>(`/wp-json/wp/v2/users?context=edit`, {
			method: 'POST',
			body: JSON.stringify(payload),
		})
	}

	let response = await createWithPayload({ ...basePayload, roles: [role] })
	if (!response.ok && extractErrorCode(response) === 'rest_invalid_param') {
		response = await createWithPayload({ ...basePayload, role })
	}

	if (!response.ok && extractErrorCode(response) === 'existing_user_login') {
		const retryPayload = { ...basePayload, username: generateUsername(email) }
		response = await createWithPayload({ ...retryPayload, roles: [role] })
		if (!response.ok && extractErrorCode(response) === 'rest_invalid_param') {
			response = await createWithPayload({ ...retryPayload, role })
		}
	}

	if (!response.ok && extractErrorCode(response) === 'existing_user_email') {
		const existing = await wpFindUserByEmail(email)
		if (existing) return existing
	}

	if (!response.ok) {
		throw new Error(`WP user create failed with status ${response.status}`)
	}

	return { id: response.data.id }
}

export async function wpSetUserRole(userId: number, role: string): Promise<void> {
	let response = await wpRequest<WpUser>(
		`/wp-json/wp/v2/users/${userId}?context=edit`,
		{
			method: 'POST',
			body: JSON.stringify({ roles: [role] }),
		}
	)

	if (response.ok) return

	console.warn('WP role update with roles failed', {
		status: response.status,
		code: extractErrorCode(response),
	})

	response = await wpRequest<WpUser>(
		`/wp-json/wp/v2/users/${userId}?context=edit`,
		{
			method: 'POST',
			body: JSON.stringify({ role }),
		}
	)

	if (!response.ok) {
		console.warn('WP role update failed', {
			status: response.status,
			code: extractErrorCode(response),
		})
	}
}

export async function wpUpdateUserMeta(
	userId: number,
	meta: Record<string, string>
): Promise<void> {
	const response = await wpRequest<WpUser>(
		`/wp-json/wp/v2/users/${userId}?context=edit`,
		{
			method: 'POST',
			body: JSON.stringify({ meta }),
		}
	)

	if (!response.ok) {
		console.warn('WP user meta update not supported', {
			status: response.status,
			code: extractErrorCode(response),
		})
	}
}
