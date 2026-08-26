import assert from 'node:assert/strict'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

function request(path: string): NextRequest {
	return new NextRequest(`https://preview.jpvbootcamp.com${path}`)
}

const publicLanding = proxy(request('/partners'))
assert.equal(publicLanding.status, 200)
assert.equal(publicLanding.headers.get('location'), null)

const tokenizedLanding = proxy(request('/partners?token=invalid'))
assert.equal(tokenizedLanding.status, 307)
assert.equal(new URL(tokenizedLanding.headers.get('location') ?? '').pathname, '/partners/session')

const unauthenticatedDetail = proxy(request('/partners/health'))
assert.equal(unauthenticatedDetail.status, 307)
assert.equal(new URL(unauthenticatedDetail.headers.get('location') ?? '').pathname, '/partners')

console.log('partners proxy tests: PASS')
