import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')
const provider = readFileSync(resolve(root, 'src/components/theme-provider.tsx'), 'utf8')
const shell = readFileSync(resolve(root, 'src/components/portal/PortalShell.tsx'), 'utf8')
const layout = readFileSync(resolve(root, 'src/app/(frontend)/portal/layout.tsx'), 'utf8')
const toggle = readFileSync(resolve(root, 'src/components/portal/ThemeToggle.tsx'), 'utf8')
const publicProviders = readFileSync(resolve(root, 'src/components/providers.tsx'), 'utf8')
const globals = readFileSync(resolve(root, 'src/assets/styles/globals.scss'), 'utf8')

describe('portal-only theme behavior', () => {
  it('starts light and scopes dark mode to the portal wrapper', () => {
    expect(provider).toContain("useState<PortalTheme>('light')")
    expect(provider).toContain('jpv-portal-theme-root')
    expect(provider).toContain("effectiveTheme === 'dark' ? ' dark' : ''")
    expect(globals).toContain('.jpv-portal-theme-root.dark')
    expect(globals).not.toMatch(/^\.dark\s*\{/m)
  })

  it('does not persist or force a theme at the portal layout boundary', () => {
    expect(layout).not.toContain('forcedTheme')
    expect(layout).not.toContain('storageKey')
    expect(shell).toContain('PortalThemeProvider')
    expect(shell).toContain('enabled={allowPortalTheme}')
  })

  it('uses the scoped provider for the interactive toggle', () => {
    expect(toggle).toContain('usePortalTheme')
    expect(toggle).toContain('aria-pressed={isDark}')
    expect(toggle).not.toContain('useTheme')
  })

  it('clears document-level dark state for every public route', () => {
    expect(publicProviders).toContain("document.documentElement.classList.remove('dark')")
    expect(publicProviders).not.toContain("pathname?.startsWith('/portal') && !isPortalLogin")
  })
})
