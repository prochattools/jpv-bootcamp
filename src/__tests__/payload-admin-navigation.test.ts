import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const nav = readFileSync(resolve(root, 'src/components/payload/JPVAdminDashboardNav.tsx'), 'utf8')
const config = readFileSync(resolve(root, 'src/payload.config.ts'), 'utf8')
const styles = readFileSync(resolve(root, 'src/app/(payload)/jpv-admin.scss'), 'utf8')

describe('Payload administrator workspace navigation', () => {
  it('provides an operational workspace and preserves direct CMS record access', () => {
    expect(nav).toContain('data-jpv-admin-shortcuts')
    expect(nav).toContain("href: '/portal'")
    expect(nav).toContain("href: '/admin/collections/payload_members'")
    expect(nav).toContain("href: '/admin/collections/payload_billing_accounts'")
    expect(nav).toContain("href: '/admin/collections/payload_membership_support_records'")
    expect(nav).toContain("href: '/admin/collections/payload_courses'")
    expect(nav).toContain("href: '/admin/collections/payload_spaces'")
    expect(nav).toContain("href: '/admin/globals/portalSettings'")
    expect(nav).toContain('<details')
  })

  it('registers the custom navigation and scopes the cleanup styles', () => {
    expect(config).toContain('JPVAdminDashboardNav#JPVAdminDashboardNav')
    expect(styles).toContain('.jpv-admin-nav')
    expect(styles).toContain('.nav:has([data-jpv-admin-shortcuts])')
    expect(styles).toContain("a[href*='/collections/payload_courses']")
  })
})
