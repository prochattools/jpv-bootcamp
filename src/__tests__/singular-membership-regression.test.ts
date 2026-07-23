import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('Singular Membership Regression Tests', () => {
  it('should NOT expose Free/Pro/VIP options in course accessBadge field', () => {
    const courseFile = readFileSync(resolve('src/collections/PayloadCoursePrototype.ts'), 'utf-8')
    
    // accessBadge field definition
    const accessBadgeMatch = courseFile.match(/accessBadge:[\s\S]*?options:\s*\[([\s\S]*?)\]/m)
    expect(accessBadgeMatch).toBeTruthy()
    
    if (accessBadgeMatch) {
      const options = accessBadgeMatch[1]
      // Should NOT include free, pro, vip values
      expect(options).not.toMatch(/'free'|'pro'|'vip'/i)
      // Should include manual
      expect(options).toMatch(/'manual'/)
    }
  })

  it('should define singular canonical plan type', () => {
    const plansFile = readFileSync(resolve('src/lib/plans.ts'), 'utf-8')
    
    // Must export the single plan type
    expect(plansFile).toContain("'jpv_bootcamp_membership'")
    expect(plansFile).toContain('export')
  })

  it('should use jpv_bootcamp_membership in LiveKit token generation', () => {
    const livekitFile = readFileSync(resolve('src/app/api/livekit/token/route.ts'), 'utf-8')
    
    // Must check for jpv_bootcamp_membership
    expect(livekitFile).toContain('jpv_bootcamp_membership')
  })

  it('should use jpv_bootcamp_membership in course access control', () => {
    const courseFile = readFileSync(resolve('src/collections/PayloadCoursePrototype.ts'), 'utf-8')
    
    // Must reference membership in access logic
    expect(courseFile).toContain('jpv_bootcamp_membership')
  })

  it('should have entitlements endpoint returning singular membership', () => {
    const entitlementsFile = readFileSync(resolve('src/app/api/entitlements/route.ts'), 'utf-8')
    
    // Must return jpv_bootcamp_membership
    expect(entitlementsFile).toContain('jpv_bootcamp_membership')
  })
})
