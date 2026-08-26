import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

const tokens = read('src/lib/brand/jpvDesignSystem.ts')
const globals = read('src/assets/styles/globals.scss')
const portalShell = read('src/components/portal/PortalShell.tsx')
const themeToggle = read('src/components/portal/ThemeToggle.tsx')
const notificationBell = read('src/components/portal/NotificationBell.tsx')
const adminNav = read('src/components/payload/JPVAdminDashboardNav.tsx')
const adminStyles = read('src/app/(payload)/jpv-admin.scss')

assert.match(tokens, /inverseMuted:/, 'JPV tokens should define inverse-muted text')
assert.match(tokens, /--jpv-inverse-muted/, 'JPV CSS variables should expose inverse-muted text')
assert.match(globals, /::-webkit-scrollbar\s*\{[\s\S]*?width:\s*10px/, 'scrollbars must remain discoverable')
assert.doesNotMatch(globals, /::-webkit-scrollbar\s*\{[\s\S]*?width:\s*0px/, 'scrollbars must not be hidden')
assert.match(globals, /\.jpv-notification-panel/, 'notification panel must have a shared narrow-viewport bound')
assert.match(portalShell, /href='#portal-main'/, 'portal must expose a skip link')
assert.match(portalShell, /id='portal-main'/, 'portal skip link must have a target')
assert.match(themeToggle, /aria-pressed=\{isDark\}/, 'theme state must be exposed to assistive technology')
assert.match(notificationBell, /aria-expanded=\{open\}/, 'notification toggle must expose expanded state')
assert.match(notificationBell, /role='tablist'/, 'notification filters must expose tab semantics')
assert.match(adminNav, /aria-label='JPV admin workspace'/, 'admin workspace navigation must be labelled')
assert.match(adminStyles, /summary:focus-visible/, 'admin disclosure must have a visible keyboard focus state')
console.log('Repository UX contract passed.')
