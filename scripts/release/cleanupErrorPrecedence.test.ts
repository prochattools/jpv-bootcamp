import assert from 'node:assert/strict'

import { throwPrimaryOrCleanupError } from './cleanupErrorPrecedence'

const primaryError = new Error('primary failure')
const cleanupError = new Error('cleanup failure')

assert.doesNotThrow(() => throwPrimaryOrCleanupError(null, null))
assert.throws(() => throwPrimaryOrCleanupError(primaryError, null), (error: unknown) => error === primaryError)
assert.throws(() => throwPrimaryOrCleanupError(null, cleanupError), (error: unknown) => error === cleanupError)
assert.throws(() => throwPrimaryOrCleanupError(primaryError, cleanupError), (error: unknown) => error === primaryError)

console.log('PASS cleanup error precedence preserves the primary failure and surfaces cleanup-only failures')
