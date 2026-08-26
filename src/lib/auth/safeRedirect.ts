const INTERNAL_ORIGIN = 'https://jpv.internal'
const ALLOWED_ROOTS = ['/admin', '/portal'] as const

function isAllowedPathname(pathname: string): boolean {
  return ALLOWED_ROOTS.some((root) => pathname === root || pathname.startsWith(`${root}/`))
}

export function sanitizeInternalDestination(
  value: string | null | undefined,
  fallback: '/admin' | '/portal' | null = null,
): string | null {
  if (!value) return fallback

  const candidate = value.trim()
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return fallback
  if (candidate.includes('\\')) return fallback

  try {
    const parsed = new URL(candidate, INTERNAL_ORIGIN)
    if (parsed.origin !== INTERNAL_ORIGIN) return fallback

    let decodedPathname: string
    try {
      decodedPathname = decodeURIComponent(parsed.pathname)
    } catch {
      return fallback
    }

    if (decodedPathname.startsWith('//') || decodedPathname.includes('\\')) return fallback
    if (!isAllowedPathname(decodedPathname)) return fallback

    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

export function isApprovedInternalDestination(value: string | null | undefined): boolean {
  return sanitizeInternalDestination(value) !== null
}
