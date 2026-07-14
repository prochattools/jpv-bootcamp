import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { RELEASE_TEST_MANIFEST } from './release/releaseTestManifest'

function commandOf(id: string): string | undefined {
  const entry = RELEASE_TEST_MANIFEST.find((item) => item.id === id)
  if (!entry) return undefined
  return [entry.command.executable, ...entry.command.args].join(' ')
}

function main(): void {
  const previewReadiness = readFileSync('docs/PREVIEW_RELEASE_READINESS.md', 'utf8')
  const roadmap = readFileSync('docs/client/ROADMAP_PROGRESS_STATUS.md', 'utf8')
  const operatorHandoff = readFileSync('docs/client/OPERATOR_HANDOFF_SUMMARY.md', 'utf8')
  const architecture = readFileSync('docs/ARCHITECTURE.md', 'utf8')

  assert.match(architecture, /Canonical `\/portal` account, course, community, partner, support, and billing experience/)
  assert.match(architecture, /\| Admin CMS \| Payload \|/)

  const combined = [previewReadiness, roadmap, operatorHandoff, architecture].join('\n')

  assert.match(combined, /feature\/course-branding-and-preview/)
  assert.match(combined, /\/portal/)
  assert.match(combined, /\/admin/)
  const removedMemberNamespace = new RegExp(`/${'learn'}(?:/|\\b)`)
  assert.doesNotMatch(combined, removedMemberNamespace)

  assert.equal(commandOf('member.portal-mvp'), 'pnpm exec tsx scripts/member_portal_mvp.test.ts')
  assert.equal(commandOf('routes.no-legacy-learn-namespace'), 'pnpm exec tsx scripts/no_legacy_learn_namespace.test.ts')
  assert.ok(RELEASE_TEST_MANIFEST.some((entry) => entry.id === 'evidence.core-go-live-readiness'))
  assert.ok(RELEASE_TEST_MANIFEST.some((entry) => entry.command.args.join(' ') === 'exec tsx scripts/core_go_live_readiness.test.ts'))

  for (const doc of [previewReadiness, roadmap, operatorHandoff]) {
    assert.match(doc, /Migrations applied:\s*`?No`?|No migrations have been applied/i)
    assert.match(doc, /support-request migration remains unapplied|support_requests.*remain unapplied|support-request migration application/i)
    assert.match(doc, /programme remains preview-only|programme content is still blocked|representative programme content/i)
    assert.match(doc, /Provider\/email .*pending|provider\/email .*not executed|provider\/email verification/i)
    assert.match(doc, /staging smoke .*pending|staging smoke .*not executed/i)
    assert.match(doc, /go\/no-go/i)
  }

  assert.match(previewReadiness, /NOT READY FOR CONTROLLED STAGING RELEASE PROCESS/)
  assert.match(previewReadiness, /M2-01.*post-core/i)
  assert.match(previewReadiness, /pnpm test:release.*116\/116/i)
  assert.match(previewReadiness, /pnpm test:e2e.*56\/56/i)
  assert.match(previewReadiness, /pnpm test:release:full/)
  assert.match(previewReadiness, /pnpm staging:static-preflight/)
  assert.match(previewReadiness, /2 moderate/)
  assert.doesNotMatch(previewReadiness, /READY FOR PRODUCTION|production-ready|go-live complete/i)

  assert.match(roadmap, /Core go-live implementation and deterministic local validation are complete/i)
  assert.match(roadmap, /not ready for the controlled staging release process/i)
  assert.match(roadmap, /M0-01 through M0-09/)
  assert.match(roadmap, /M1-01 through M1-06/)
  assert.match(roadmap, /M2-01.*deferred post-core/i)

  assert.match(operatorHandoff, /Current local readiness baseline: `1e5c4ed feat: complete M1-06 launch content views`/)
  assert.match(operatorHandoff, /Deterministic non-browser release gate: `pnpm test:release` \(`116\/116`\)/)
  assert.match(operatorHandoff, /Launch browser E2E: `pnpm test:e2e` \(`56\/56`\)/)
  assert.match(operatorHandoff, /M2-01.*deferred post-core/i)

  console.log('core_go_live_readiness.test.ts passed')
}

main()
