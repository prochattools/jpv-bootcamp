import assert from 'node:assert/strict'

import { PayloadCourses, normalizeLegacyAccessBadge } from '../src/collections/PayloadCoursePrototype'

const accessBadgeField = PayloadCourses.fields?.find(
  (field) => typeof field === 'object' && 'name' in field && field.name === 'accessBadge',
)
assert(accessBadgeField && typeof accessBadgeField === 'object' && 'options' in accessBadgeField)
const configuredValues = (accessBadgeField.options as Array<{ value: string }>).map((option) => option.value)

assert.deepEqual(configuredValues, ['manual'])
for (const value of configuredValues) {
  assert.equal(normalizeLegacyAccessBadge({ value }), value)
}
for (const legacyValue of ['free', 'pro', 'vip']) {
  assert.equal(normalizeLegacyAccessBadge({ value: legacyValue }), 'manual')
}
assert.equal(normalizeLegacyAccessBadge({ value: 'private' }), 'private')
assert.equal(normalizeLegacyAccessBadge({ value: 'unsupported-new-value' }), 'unsupported-new-value')

const legacyCourse = {
  id: 3,
  title: 'Legacy course title',
  accessBadge: 'pro',
  visibility: 'restricted',
  featured: true,
}
const titleOnlyUpdate = {
  ...legacyCourse,
  title: 'Renamed course',
  accessBadge: normalizeLegacyAccessBadge({ value: legacyCourse.accessBadge }),
}
assert.equal(titleOnlyUpdate.title, 'Renamed course')
assert.equal(titleOnlyUpdate.accessBadge, 'manual')
assert.equal(configuredValues.includes(titleOnlyUpdate.accessBadge), true)
assert.equal(titleOnlyUpdate.visibility, legacyCourse.visibility)
assert.equal(titleOnlyUpdate.featured, legacyCourse.featured)

console.log('payload_course_legacy_access_badge.test.ts passed')
