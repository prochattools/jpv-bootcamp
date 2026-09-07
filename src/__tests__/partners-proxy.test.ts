import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { proxy } from '@/proxy'

function request(path: string): NextRequest {
	return new NextRequest(`https://preview.jpvbootcamp.com${path}`)
}

describe('partners proxy routing', () => {
  it('keeps the public partners landing accessible', () => {
    const response = proxy(request('/partners'))
    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('routes tokenized partner links through the session boundary', () => {
    const response = proxy(request('/partners?token=invalid'))
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/partners/session')
  })

  it('redirects unauthenticated partner detail access to the landing page', () => {
    const response = proxy(request('/partners/health'))
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/partners')
  })
})
