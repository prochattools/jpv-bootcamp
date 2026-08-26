import 'server-only'

/**
 * LiveKit server-side configuration.
 *
 * Reads LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_WS_URL from the environment.
 * Throws at call-time (not module-load time) so the build does not fail when env vars
 * are absent.
 *
 * The JWT builder is in livekit-jwt.ts (no server-only guard) so it can be tested
 * directly without the Next.js server runtime.
 */

// Re-export types and builder for convenience — callers can import from either file.
export { buildLiveKitToken, type LiveKitConfig, type LiveKitGrant, type LiveKitTokenOptions } from './livekit-jwt'

let cached: import('./livekit-jwt').LiveKitConfig | null = null

export function getLiveKitConfig(): import('./livekit-jwt').LiveKitConfig {
  if (cached) return cached

  const apiKey = (process.env.LIVEKIT_API_KEY ?? '').trim()
  const apiSecret = (process.env.LIVEKIT_API_SECRET ?? '').trim()
  // LIVEKIT_WS_URL is canonical; LIVEKIT_URL is the name used in some deploy platforms.
  const wsUrl = (process.env.LIVEKIT_WS_URL ?? process.env.LIVEKIT_URL ?? '').trim()

  if (!apiKey) throw new Error('Missing required env var: LIVEKIT_API_KEY')
  if (!apiSecret) throw new Error('Missing required env var: LIVEKIT_API_SECRET')
  if (!wsUrl) throw new Error('Missing required env var: LIVEKIT_WS_URL (or LIVEKIT_URL)')

  cached = { apiKey, apiSecret, wsUrl }
  return cached
}
