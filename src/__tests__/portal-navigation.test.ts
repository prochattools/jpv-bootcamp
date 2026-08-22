import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const sidebar = readFileSync(resolve(root, 'src/components/portal/PortalSidebar.tsx'), 'utf8')
const shell = readFileSync(resolve(root, 'src/components/portal/PortalShell.tsx'), 'utf8')
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
    for (const route of routes) expect(sidebar).toContain(route)
  })

  it('uses a mobile trigger and desktop sidebar', () => {
    expect(sidebar).toContain('lg:hidden')
    expect(sidebar).toContain('lg:sticky lg:top-0 lg:flex')
  })

  it('preserves active-route indication', () => {
    expect(sidebar).toContain('usePathname')
    expect(sidebar).toContain("aria-current={active ? 'page' : undefined}")
  })

  it('closes after selection and uses accessible dialog focus behavior', () => {
    expect(sidebar).toContain('AccessibleDialog')
    expect(sidebar).toContain('onClick={onMobileClose}')
    expect(sidebar).toContain('onClose={onMobileClose}')
  })

  it('uses 44px touch targets and JPV tokens', () => {
    expect(sidebar).toContain('min-h-11')
    expect(sidebar).toContain('min-w-11')
    expect(sidebar).not.toMatch(/(?:gray|slate|blue|amber)-/)
  })

  it('keeps server-side session resolution and logout visibility', () => {
    expect(layout).toContain('resolvePayloadRequestSession')
    expect(shell).toContain('showLogout')
  })
})
