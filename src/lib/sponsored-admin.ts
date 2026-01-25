export function parseAdminWpUserIds(raw: string | undefined): Set<number> {
	if (!raw) return new Set()
	return new Set(
		raw
			.split(',')
			.map((value) => Number(value.trim()))
			.filter((value) => Number.isInteger(value) && value > 0)
	)
}

export function isSponsoredSeatsAdmin(wpUserId: number): boolean {
	const admins = parseAdminWpUserIds(process.env.SPONSORED_SEATS_ADMIN_WP_USER_IDS)
	return admins.has(wpUserId)
}
