import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(tsx?|scss|css)$/.test(entry.name) ? [path] : []
  })
}

const sponsored = read('src/app/(frontend)/sponsored/page.tsx')
assert.doesNotMatch(sponsored, /h-screen|lg:overflow-hidden|overflow-y-auto/, 'sponsored page must not own a forced page-level or nested form scroll')
assert.match(sponsored, /min-h-\[100dvh\]/, 'sponsored page must retain a dynamic minimum viewport')

const portalLayout = read('src/app/(frontend)/portal/layout.tsx')
const portalShell = read('src/components/portal/PortalShell.tsx')
assert.match(portalLayout, /h-\[100dvh\].*overflow-hidden/, 'portal shell must own the dynamic viewport')
assert.match(portalShell, /overflow-y-auto overscroll-contain/, 'portal main content must own vertical scrolling')
assert.match(portalShell, /min-w-0/, 'portal grid children must be shrinkable')

const authShell = read('src/components/auth/AuthShell.tsx')
assert.match(authShell, /min-h-\[100dvh\]/, 'auth must remain usable with mobile browser chrome')
assert.match(authShell, /lg:overflow-y-auto/, 'desktop auth form column must own overflow when needed')

const providers = read('src/components/providers.tsx')
assert.doesNotMatch(providers, /bg-background/, 'provider wrapper must consume the JPV canvas token')

const waitingListLayout = read('src/app/(frontend)/waiting-list/layout.tsx')
assert.doesNotMatch(waitingListLayout, /components\/(?:Header|Footer)/, 'compatibility waiting-list route must not reintroduce the legacy public shell')

const homepage = read('src/app/(frontend)/page.tsx')
assert.doesNotMatch(homepage, /max-h-\[calc\(100vh-/, 'homepage dialogs must use the dynamic viewport on mobile')
assert.match(homepage, /max-h-\[calc\(100dvh-2\.5rem\)\]/, 'homepage dialogs must retain a dynamic viewport bound')

const activeLegacyShellImport = /(?:@\/components|\.\.\/\.\.\/components)\/(?:Header|Footer|ButtonGradient|ButtonPopover|BlogCard|Hero|Features|FAQ|Comparison|SaveMoney|Review|WaitingListHero)(?:['"/]|$)/
for (const path of sourceFiles('src/app/(frontend)')) {
  const source = read(path)
  assert.doesNotMatch(source, activeLegacyShellImport, `${path} must not reactivate legacy public shell/component residue`)
}

const designNarrative = read('DESIGN.md')
for (const staleToken of ['#2F805B', '#123D2D', '#6BCF8A', '#FFFEFA', '#F5F3EC', '#E8ECE7', '#24332B', '#687068', '#DEDBD1']) {
  assert.equal(designNarrative.includes(staleToken), false, `DESIGN.md must not retain stale authority token ${staleToken}`)
}

const tailwind = read('tailwind.config.ts')
for (const alias of ['"jpv-control"', '"jpv-pill"', '"jpv-floating"']) {
  assert.match(tailwind, new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `Tailwind must expose ${alias} from the design authority`)
}
assert.match(tailwind, /primary: "var\(--jpv-brand\)"/, 'Tailwind primary compatibility alias must resolve to the JPV brand token')
assert.match(tailwind, /neutral:\s*\{[\s\S]*?50: "var\(--jpv-canvas\)"/, 'Tailwind neutral compatibility aliases must resolve to JPV surface tokens')

for (const path of [
  'src/components/portal/MemberCheckoutButtons.tsx',
  'src/components/portal/MemberContentMedia.tsx',
  'src/components/portal/LiveCallRoom.tsx',
]) {
  const source = read(path)
  assert.doesNotMatch(source, /(?:bg-white|text-neutral|border-neutral|bg-red-|text-red-|border-red-)/, `${path} must not add a competing surface palette`)
}

for (const path of ['src/components/ui/dialog.tsx', 'src/components/ui/sheet.tsx']) {
  const source = read(path)
  assert.doesNotMatch(source, /bg-background|text-foreground|text-muted-foreground|ring-offset-background/, `${path} must consume semantic JPV surface tokens`)
  assert.match(source, /100dvh|overflow-y-auto/, `${path} must define a bounded dynamic-viewport contract`)
}

console.log('UX_ARCHITECTURE_CONSOLIDATION: PASS')
