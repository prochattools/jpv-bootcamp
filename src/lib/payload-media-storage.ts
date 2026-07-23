export type PayloadMediaStorageMode = 'local' | 's3'

export type PayloadMediaStorageEnvironment = Record<string, string | undefined>

export type LocalPayloadMediaStorageConfig = {
  mode: 'local'
  requireDurable: boolean
}

export type S3PayloadMediaStorageConfig = {
  mode: 's3'
  requireDurable: boolean
  bucket: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  endpoint?: string
  prefix?: string
  forcePathStyle: boolean
}

export type PayloadMediaStorageConfig =
  | LocalPayloadMediaStorageConfig
  | S3PayloadMediaStorageConfig

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on'])
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off'])

function readTrimmed(environment: PayloadMediaStorageEnvironment, key: string): string | undefined {
  const value = environment[key]?.trim()
  return value ? value : undefined
}

function parseBoolean(
  environment: PayloadMediaStorageEnvironment,
  key: string,
  defaultValue: boolean,
): boolean {
  const raw = readTrimmed(environment, key)
  if (raw === undefined) return defaultValue

  const normalized = raw.toLowerCase()
  if (TRUE_VALUES.has(normalized)) return true
  if (FALSE_VALUES.has(normalized)) return false

  throw new Error(`${key} must be one of: 1, 0, true, false, yes, no, on, off`)
}

function resolveMode(environment: PayloadMediaStorageEnvironment): PayloadMediaStorageMode {
  const raw = readTrimmed(environment, 'PAYLOAD_MEDIA_STORAGE_MODE')?.toLowerCase() ?? 'local'
  if (raw === 'local' || raw === 's3') return raw

  throw new Error('PAYLOAD_MEDIA_STORAGE_MODE must be either local or s3')
}

function normalizePrefix(value: string | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value.replace(/^\/+|\/+$/g, '')
  return normalized || undefined
}

export function resolvePayloadMediaStorageConfig(
  environment: PayloadMediaStorageEnvironment = process.env,
): PayloadMediaStorageConfig {
  const mode = resolveMode(environment)
  const requireDurable = parseBoolean(environment, 'PAYLOAD_MEDIA_REQUIRE_DURABLE', false)

  if (requireDurable && mode !== 's3') {
    throw new Error(
      'PAYLOAD_MEDIA_REQUIRE_DURABLE=true requires PAYLOAD_MEDIA_STORAGE_MODE=s3',
    )
  }

  if (mode === 'local') {
    return { mode, requireDurable }
  }

  const requiredKeys = [
    'PAYLOAD_MEDIA_S3_BUCKET',
    'PAYLOAD_MEDIA_S3_REGION',
    'PAYLOAD_MEDIA_S3_ACCESS_KEY_ID',
    'PAYLOAD_MEDIA_S3_SECRET_ACCESS_KEY',
  ] as const
  const missingKeys = requiredKeys.filter((key) => !readTrimmed(environment, key))

  if (missingKeys.length > 0) {
    throw new Error(`Missing required Payload media S3 settings: ${missingKeys.join(', ')}`)
  }

  return {
    mode,
    requireDurable,
    bucket: readTrimmed(environment, 'PAYLOAD_MEDIA_S3_BUCKET')!,
    region: readTrimmed(environment, 'PAYLOAD_MEDIA_S3_REGION')!,
    accessKeyId: readTrimmed(environment, 'PAYLOAD_MEDIA_S3_ACCESS_KEY_ID')!,
    secretAccessKey: readTrimmed(environment, 'PAYLOAD_MEDIA_S3_SECRET_ACCESS_KEY')!,
    endpoint: readTrimmed(environment, 'PAYLOAD_MEDIA_S3_ENDPOINT'),
    prefix: normalizePrefix(readTrimmed(environment, 'PAYLOAD_MEDIA_S3_PREFIX')),
    forcePathStyle: parseBoolean(environment, 'PAYLOAD_MEDIA_S3_FORCE_PATH_STYLE', false),
  }
}
