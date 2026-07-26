import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const navigation = readFileSync(resolve(root, 'src/components/portal/PortalNavigation.tsx'), 'utf8')
const layout = readFileSync(resolve(root, 'src/app/(frontend)/portal/layout.tsx'), 'utf8')

const routes = [
  '/portal',
  '/portal/courses',
  '/portal/live-sessions',
  '/portal/content',
  '/portal/community',
  '/portal/partners',
  '/portal/account',
  '/portal/billing',
]

describe('responsive portal navigation', () => {
  it('keeps every existing member route available', () => {
    for (const route of routes) expect(navigation).toContain(route)
  })

  it('uses a mobile trigger and desktop navigation', () => {
    expect(navigation).toContain("aria-label='Open member portal navigation'")
    expect(navigation).toContain('lg:hidden')
    expect(navigation).toContain('hidden items-center gap-3 lg:flex')
  })

  it('preserves active-route indication', () => {
    expect(navigation).toContain('usePathname')
    expect(navigation).toContain("aria-current={active ? 'page' : undefined}")
  })

  it('closes after selection and uses accessible dialog focus behavior', () => {
    expect(navigation).toContain('AccessibleDialog')
    expect(navigation).toContain('onClick={() => setMobileOpen(false)}')
    expect(navigation).toContain('onClose={() => setMobileOpen(false)}')
  })

  it('uses 44px touch targets and JPV tokens', () => {
    expect(navigation).toContain('min-h-11')
    expect(navigation).toContain('min-w-11')
    expect(navigation).not.toMatch(/(?:gray|slate|blue|amber)-/)
  })

  it('keeps server-side session resolution and logout visibility', () => {
    expect(layout).toContain('resolvePayloadRequestSession')
    expect(layout).toContain('<PortalNavigation showLogout={showLogout} />')
  })
})
