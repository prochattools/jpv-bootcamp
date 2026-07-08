export function parseAdminAccountIds(raw: string | undefined): Set<number> {
	if (!raw) return new Set()
	return new Set(
		raw
			.split(',')
			.map((value) => Number(value.trim()))
			.filter((value) => Number.isInteger(value) && value > 0)
	)
}

export function isSponsoredSeatsAdmin(accountId: number): boolean {
	const admins = parseAdminAccountIds(process.env.SPONSORED_SEATS_ADMIN_ACCOUNT_IDS)
	return admins.has(accountId)
}
