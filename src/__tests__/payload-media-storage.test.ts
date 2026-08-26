import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolvePayloadMediaStorageConfig } from '../lib/payload-media-storage'

const readSource = (path: string) => readFileSync(resolve(path), 'utf8')

describe('Payload media storage configuration', () => {
  it('defaults to local storage when durable storage is not required', () => {
    expect(resolvePayloadMediaStorageConfig({})).toEqual({
      mode: 'local',
      requireDurable: false,
    })
  })

  it('fails closed when durable storage is required without S3 mode', () => {
    expect(() =>
      resolvePayloadMediaStorageConfig({
        PAYLOAD_MEDIA_REQUIRE_DURABLE: 'true',
      }),
    ).toThrow(
      'PAYLOAD_MEDIA_REQUIRE_DURABLE=true requires PAYLOAD_MEDIA_STORAGE_MODE=s3',
    )
  })

  it('lists every missing required S3 setting', () => {
    expect(() =>
      resolvePayloadMediaStorageConfig({
        PAYLOAD_MEDIA_STORAGE_MODE: 's3',
      }),
    ).toThrow(
      'Missing required Payload media S3 settings: PAYLOAD_MEDIA_S3_BUCKET, PAYLOAD_MEDIA_S3_REGION, PAYLOAD_MEDIA_S3_ACCESS_KEY_ID, PAYLOAD_MEDIA_S3_SECRET_ACCESS_KEY',
    )
  })

  it('returns normalized S3 settings and optional endpoint controls', () => {
    expect(
      resolvePayloadMediaStorageConfig({
        PAYLOAD_MEDIA_STORAGE_MODE: 'S3',
        PAYLOAD_MEDIA_REQUIRE_DURABLE: '1',
        PAYLOAD_MEDIA_S3_BUCKET: ' jpv-media ',
        PAYLOAD_MEDIA_S3_REGION: ' eu-west-1 ',
        PAYLOAD_MEDIA_S3_ACCESS_KEY_ID: ' access-key ',
        PAYLOAD_MEDIA_S3_SECRET_ACCESS_KEY: ' secret-key ',
        PAYLOAD_MEDIA_S3_ENDPOINT: ' https://storage.example.com ',
        PAYLOAD_MEDIA_S3_PREFIX: ' /payload/media/ ',
        PAYLOAD_MEDIA_S3_FORCE_PATH_STYLE: 'yes',
      }),
    ).toEqual({
      mode: 's3',
      requireDurable: true,
      bucket: 'jpv-media',
      region: 'eu-west-1',
      accessKeyId: 'access-key',
      secretAccessKey: 'secret-key',
      endpoint: 'https://storage.example.com',
      prefix: 'payload/media',
      forcePathStyle: true,
    })
  })

  it('rejects unsupported modes and malformed booleans', () => {
    expect(() =>
      resolvePayloadMediaStorageConfig({
        PAYLOAD_MEDIA_STORAGE_MODE: 'blob',
      }),
    ).toThrow('PAYLOAD_MEDIA_STORAGE_MODE must be either local or s3')

    expect(() =>
      resolvePayloadMediaStorageConfig({
        PAYLOAD_MEDIA_STORAGE_MODE: 's3',
        PAYLOAD_MEDIA_S3_BUCKET: 'jpv-media',
        PAYLOAD_MEDIA_S3_REGION: 'eu-west-1',
        PAYLOAD_MEDIA_S3_ACCESS_KEY_ID: 'access-key',
        PAYLOAD_MEDIA_S3_SECRET_ACCESS_KEY: 'secret-key',
        PAYLOAD_MEDIA_S3_FORCE_PATH_STYLE: 'sometimes',
      }),
    ).toThrow(
      'PAYLOAD_MEDIA_S3_FORCE_PATH_STYLE must be one of: 1, 0, true, false, yes, no, on, off',
    )
  })

  it('registers S3 storage only for the Payload media collection', () => {
    const source = readSource('src/payload.config.ts')

    expect(source).toContain("import { s3Storage } from '@payloadcms/storage-s3'")
    expect(source).toContain("payload_media: mediaStorage.prefix ? { prefix: mediaStorage.prefix } : true")
    expect(source).toContain('plugins: mediaStoragePlugins')
    expect(source).toContain("mediaStorage.mode === 's3'")
  })
})
