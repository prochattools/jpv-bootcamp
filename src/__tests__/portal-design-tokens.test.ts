/**
 * Static enforcement: portal design token compliance.
 *
 * Asserts:
 *   - No bg-amber-* or bg-blue-* classes remain in scoped portal files
 *   - Primary portal CTA files use jpv-button-primary (not raw bg-neutral-950)
 *   - Scoped portal pages use jpv-eyebrow (not ad-hoc eyebrow classes)
 *   - No business logic (conditions, auth, entitlement checks) was altered
 *
 * Run with: pnpm exec vitest run src/__tests__/portal-design-tokens.test.ts
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '../..')

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8')
}

const LESSON_PAGE = 'src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx'
const COURSE_PAGE = 'src/app/(frontend)/portal/courses/[courseSlug]/page.tsx'
const PORTAL_PAGE = 'src/app/(frontend)/portal/page.tsx'
const COURSES_PAGE = 'src/app/(frontend)/portal/courses/page.tsx'
const BILLING_BUTTON = 'src/components/portal/BillingPortalButton.tsx'
const CHECKOUT_BUTTONS = 'src/components/portal/MemberCheckoutButtons.tsx'

describe('portal design token compliance', () => {
  describe('no off-token amber or blue classes', () => {
    const amberBlueFiles = [LESSON_PAGE, COURSE_PAGE]

    for (const file of amberBlueFiles) {
      it(`${file} has no bg-amber-* classes`, () => {
        expect(read(file)).not.toMatch(/bg-amber-/)
      })

      it(`${file} has no border-amber-* classes`, () => {
        expect(read(file)).not.toMatch(/border-amber-/)
      })

      it(`${file} has no text-amber-* classes`, () => {
        expect(read(file)).not.toMatch(/text-amber-/)
      })

      it(`${file} has no bg-blue-* classes`, () => {
        expect(read(file)).not.toMatch(/bg-blue-/)
      })

      it(`${file} has no text-blue-* classes`, () => {
        expect(read(file)).not.toMatch(/text-blue-/)
      })
    }
  })

  describe('primary CTAs use jpv-button-primary', () => {
    const ctaFiles = [
      PORTAL_PAGE,
      COURSES_PAGE,
      COURSE_PAGE,
      LESSON_PAGE,
      BILLING_BUTTON,
      CHECKOUT_BUTTONS,
    ]

    for (const file of ctaFiles) {
      it(`${file} uses jpv-button-primary`, () => {
        expect(read(file)).toContain('jpv-button-primary')
      })
    }

    const primaryCtaFiles = [
      PORTAL_PAGE,
      COURSES_PAGE,
      COURSE_PAGE,
      LESSON_PAGE,
      BILLING_BUTTON,
    ]

    for (const file of primaryCtaFiles) {
      it(`${file} has no raw bg-neutral-950 primary action`, () => {
        expect(read(file)).not.toMatch(/className='[^']*bg-neutral-950[^']*'/)
      })
    }
  })

  describe('eyebrow standardization', () => {
    const eyebrowFiles = [PORTAL_PAGE, COURSES_PAGE, COURSE_PAGE, LESSON_PAGE]

    for (const file of eyebrowFiles) {
      it(`${file} uses jpv-eyebrow`, () => {
        expect(read(file)).toContain('jpv-eyebrow')
      })

      it(`${file} has no ad-hoc eyebrow tracking-[0.2em] pattern`, () => {
        expect(read(file)).not.toMatch(/tracking-\[0\.2em\]/)
      })

      it(`${file} has no ad-hoc eyebrow tracking-[0.18em] pattern`, () => {
        expect(read(file)).not.toMatch(/tracking-\[0\.18em\]/)
      })
    }
  })

  describe('business logic preserved', () => {
    it('lesson page still checks detail.allowed', () => {
      expect(read(LESSON_PAGE)).toContain('detail.allowed')
    })

    it('lesson page still checks detail.lesson.lockState', () => {
      expect(read(LESSON_PAGE)).toContain("detail.lesson.lockState")
    })

    it('lesson page still calls completeLesson server action', () => {
      expect(read(LESSON_PAGE)).toContain('completeLesson')
    })

    it('lesson page still checks previousLesson.completed', () => {
      expect(read(LESSON_PAGE)).toContain('detail.previousLesson.completed')
    })

    it('course page still checks course.allowed', () => {
      expect(read(COURSE_PAGE)).toContain('course.allowed')
    })

    it('course page still passes lesson lockState through the course projection', () => {
      expect(read(COURSE_PAGE)).toContain('lockState')
    })

    it('portal page still resolves authenticated portal access', () => {
      expect(read(PORTAL_PAGE)).toContain('requirePortalAccess')
    })

    it('courses page still resolves authenticated portal access', () => {
      expect(read(COURSES_PAGE)).toContain('requirePortalAccess')
    })

    it('billing button still calls openBillingPortal', () => {
      expect(read(BILLING_BUTTON)).toContain('openBillingPortal')
    })

    it('checkout buttons still calls startMemberCheckout', () => {
      expect(read(CHECKOUT_BUTTONS)).toContain('startMemberCheckout')
    })

    it('checkout buttons still has recurring payment consent gate', () => {
      expect(read(CHECKOUT_BUTTONS)).toContain('recurringPaymentAccepted')
    })

    it('checkout buttons preserves monthly/annual hierarchy (secondary for annual)', () => {
      const content = read(CHECKOUT_BUTTONS)
      expect(content).toContain('jpv-button-primary')
      expect(content).toContain('jpv-button-secondary')
    })
  })
})
