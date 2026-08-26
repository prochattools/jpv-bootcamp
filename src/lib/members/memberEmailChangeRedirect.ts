export function buildMemberEmailChangeLoginResultUrl(
  request: Request,
  result: 'success' | 'invalid',
): URL {
  const url = new URL('/portal', request.url)
  url.searchParams.set('mode', 'login')
  url.searchParams.set('emailChange', result)
  return url
}
