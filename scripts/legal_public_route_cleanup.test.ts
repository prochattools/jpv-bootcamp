import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import sitemap from '../src/app/sitemap'
import {
  getMvpRoutes,
  getPublicNavigationRoutes,
} from '../src/lib/navigation/mvpRouteRegistry'

const OBSOLETE_REDIRECTS = [
  {
    path: 'src/app/(frontend)/tos/page.tsx',
    target: '/terms',
  },
  {
    path: 'src/app/(frontend)/privacy-policy/page.tsx',
    target: '/privacy',
  },
  {
    path: 'src/app/(frontend)/waiting-list/page.tsx',
    target: '/',
  },
]

const FORBIDDEN_PUBLIC_COPY = [
  'MicroSassFast',
  'micro.st',
  'marc@micro.st',
  'How to launch your MicroSaaS',
]

function collectRouteSourceFiles(directory: string): string[] {
  const files: string[] = []

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectRouteSourceFiles(entryPath))
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(entryPath)
    }
  }

  return files
}

function testObsoleteRoutesRedirectCanonically(): void {
  for (const route of OBSOLETE_REDIRECTS) {
    const content = readFileSync(route.path, 'utf8')
    assert.ok(
      content.includes("import { redirect } from 'next/navigation'"),
      `${route.path} must use the repository redirect convention`,
    )
    assert.ok(
      content.includes(`redirect('${route.target}')`),
      `${route.path} must redirect to ${route.target}`,
    )
    assert.equal(content.includes('getSEOTags'), false, `${route.path} must not publish obsolete metadata`)
    assert.equal(content.includes('WaitingListHero'), false, `${route.path} must not render template UI`)
  }
}

function testCanonicalLegalRoutesRemainApproved(): void {
  const terms = readFileSync('src/app/(frontend)/terms/page.tsx', 'utf8')
  const privacy = readFileSync('src/app/(frontend)/privacy/page.tsx', 'utf8')
  const homepage = readFileSync('src/app/(frontend)/page.tsx', 'utf8')

  assert.ok(terms.includes('JPV Bootcamp'), '/terms must retain approved JPV content')
  assert.ok(privacy.includes('JPV Bootcamp'), '/privacy must retain approved JPV content')
  assert.ok(homepage.includes('href="/terms"'), 'homepage must link to /terms')
  assert.ok(homepage.includes('href="/privacy"'), 'homepage must link to /privacy')
}

async function testSitemapContainsOnlyCanonicalLegalRoutes(): Promise<void> {
  const previousAppUrl = process.env.APP_PUBLIC_URL
  const previousNextPublicUrl = process.env.NEXT_PUBLIC_APP_URL
  process.env.APP_PUBLIC_URL = 'https://jpv.example'
  delete process.env.NEXT_PUBLIC_APP_URL

  try {
    const entries = await sitemap()
    const urls = entries.map((entry) => entry.url)

    assert.deepEqual(urls, [
      'https://jpv.example',
      'https://jpv.example/terms',
      'https://jpv.example/privacy',
    ])
    assert.equal(urls.some((url) => url.endsWith('/tos')), false)
    assert.equal(urls.some((url) => url.endsWith('/privacy-policy')), false)
    assert.equal(urls.some((url) => url.endsWith('/waiting-list')), false)
  } finally {
    if (previousAppUrl === undefined) delete process.env.APP_PUBLIC_URL
    else process.env.APP_PUBLIC_URL = previousAppUrl

    if (previousNextPublicUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = previousNextPublicUrl
  }
}

function testObsoleteRoutesAreNotRegisteredForNavigation(): void {
  const obsoleteHrefs = new Set(['/tos', '/privacy-policy', '/waiting-list'])
  const registeredHrefs = getMvpRoutes().map((route) => route.href)
  const publicHrefs = getPublicNavigationRoutes().map((route) => route.href)

  for (const href of obsoleteHrefs) {
    assert.equal(registeredHrefs.includes(href), false, `${href} must not be registered`)
    assert.equal(publicHrefs.includes(href), false, `${href} must not appear in public navigation`)
  }
}

function testNoForbiddenTemplateCopyRemainsInPublicRouteModules(): void {
  const routeFiles = collectRouteSourceFiles('src/app/(frontend)')

  for (const routeFile of routeFiles) {
    const content = readFileSync(routeFile, 'utf8')
    for (const forbiddenCopy of FORBIDDEN_PUBLIC_COPY) {
      assert.equal(
        content.includes(forbiddenCopy),
        false,
        `${routeFile} contains forbidden public template copy: ${forbiddenCopy}`,
      )
    }
  }
}

async function main(): Promise<void> {
  testObsoleteRoutesRedirectCanonically()
  testCanonicalLegalRoutesRemainApproved()
  await testSitemapContainsOnlyCanonicalLegalRoutes()
  testObsoleteRoutesAreNotRegisteredForNavigation()
  testNoForbiddenTemplateCopyRemainsInPublicRouteModules()
  console.log('legal_public_route_cleanup.test.ts passed')
}

main().catch((error) => {
  console.error(
    'legal_public_route_cleanup.test.ts failed',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
})
