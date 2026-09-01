import { describe, expect, it } from 'vitest'

import { cleanLegacyResourceTitle } from '@/lib/payloadCourse/lessonResources'
import { isResourcesLibraryCourse } from '@/lib/payloadCourse/resourceLibrary'

describe('resource library presentation', () => {
  it('keeps the portal resource page limited to the dedicated Resources Library course', () => {
    expect(isResourcesLibraryCourse({ title: 'RESOURCES LIBRARY', slug: 'resources-library' })).toBe(true)
    expect(isResourcesLibraryCourse({ title: 'Property Investment Training - UK', slug: 'propertytraining_uk' })).toBe(false)
  })

  it('removes only the legacy Fluent provider prefix from learner-facing titles', () => {
    expect(cleanLegacyResourceTitle('fluentcom-326ffa044db967e73484e80616601e03-fluentcom-JPV_Bootcamp_Deal_Analysis.xlsx'))
      .toBe('JPV_Bootcamp_Deal_Analysis.xlsx')
    expect(cleanLegacyResourceTitle('Property inspection checklist.pdf')).toBe('Property inspection checklist.pdf')
  })
})
