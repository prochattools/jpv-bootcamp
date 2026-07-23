import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(path), 'utf8')

describe('Singular Membership Regression Tests', () => {
  it('hides the legacy access badge and exposes no Free/Pro/VIP options', () => {
    const source = readSource('src/collections/PayloadCoursePrototype.ts')
    const accessBadgeBlock = source.match(/name: 'accessBadge'[\s\S]*?\n    \},\n    \{ name: 'estimatedDuration'/)?.[0]

    expect(accessBadgeBlock).toBeTruthy()
    expect(accessBadgeBlock).toContain('hidden: true')
    expect(accessBadgeBlock).not.toMatch(/value: '(free|pro|vip)'/i)
  })

  it('uses only canonical membership states in the hidden preview model', () => {
    const source = readSource('src/collections/PayloadCoursePrototype.ts')
    const previewBlock = source.slice(source.indexOf('export const PayloadCourseAccessPreview'))

    expect(previewBlock).toContain("value: 'jpv_bootcamp_membership'")
    expect(previewBlock).not.toMatch(/value: '(free|pro|vip|manual)'/i)
  })

  it('does not write retired tiers from active seed or import code', () => {
    const seedSource = readSource('src/lib/payloadCourse/seedData.ts')
    const executorSource = readSource('scripts/content/programmeContentExecutor.ts')

    expect(seedSource).toContain("accessBadge: 'manual'")
    expect(seedSource).not.toMatch(/accessBadge: '(free|pro|vip)'/i)
    expect(executorSource).not.toMatch(/accessBadge: '(free|pro|vip)'/i)
  })

  it('defines the singular canonical plan type', () => {
    const source = readSource('src/lib/plans.ts')

    expect(source).toContain("export type Plan = 'jpv_bootcamp_membership'")
  })

  it('requires the canonical membership for LiveKit access', () => {
    const source = readSource('src/app/api/livekit/token/route.ts')

    expect(source).toContain("plan === 'jpv_bootcamp_membership'")
  })

  it('returns the canonical membership from entitlements', () => {
    const source = readSource('src/app/api/entitlements/route.ts')

    expect(source).toContain("found = 'jpv_bootcamp_membership'")
  })
})
