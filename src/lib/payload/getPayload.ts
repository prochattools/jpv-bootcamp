import 'server-only'

import { cache } from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Returns the Payload instance, deduplicating the initialization call within a
 * single server request. React's cache() ensures getPayload({ config }) runs at
 * most once per request regardless of how many modules call getCachedPayload().
 */
export const getCachedPayload = cache(() => getPayload({ config }))
