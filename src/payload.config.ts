import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { PayloadUsers } from './collections/PayloadUsers'
import { PayloadMedia } from './collections/PayloadMedia'
import { PayloadPages } from './collections/PayloadPages'
import { PayloadPosts } from './collections/PayloadPosts'
import { PayloadCategories } from './collections/PayloadCategories'
import { PayloadLiveSession } from './collections/PayloadLiveSession'
import { PayloadBunnyVideo } from './collections/PayloadBunnyVideo'
import {
  PayloadCourseAccessPreview,
  PayloadCourseModules,
  PayloadCourses,
  PayloadLessons,
} from './collections/PayloadCoursePrototype'
import { accessControlCollections } from './collections/access'
import { affiliateCollections } from './collections/affiliates'
import { auditCollections } from './collections/audit'
import { billingCollections } from './collections/billing'
import { communityCollections } from './collections/community'
import { courseRuntimeCollections } from './collections/courses'
import { crmCollections } from './collections/crm'
import { memberCollections } from './collections/members'
import { membershipSupportCollections } from './collections/membership-support'
import { partnerCollections } from './collections/partners'
import { shouldRegisterPayloadProdMigrations } from './lib/payloadMigrations'
import { resolvePayloadMediaStorageConfig } from './lib/payload-media-storage'
import { stagingAutoProvision } from './lib/staging-auto-provision'
import { migrations } from './migrations'
import { jpvBrand } from './lib/brand/jpvDesignSystem'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const mediaStorage = resolvePayloadMediaStorageConfig()
const mediaStoragePlugins =
  mediaStorage.mode === 's3'
    ? [
        s3Storage({
          bucket: mediaStorage.bucket,
          collections: {
            payload_media: mediaStorage.prefix ? { prefix: mediaStorage.prefix } : true,
          },
          config: {
            credentials: {
              accessKeyId: mediaStorage.accessKeyId,
              secretAccessKey: mediaStorage.secretAccessKey,
            },
            region: mediaStorage.region,
            forcePathStyle: mediaStorage.forcePathStyle,
            ...(mediaStorage.endpoint ? { endpoint: mediaStorage.endpoint } : {}),
          },
        }),
      ]
    : []

function getDbSchema(url: string | undefined): string {
  const generationOverride = process.env.PAYLOAD_MIGRATION_SCHEMA?.trim()
  if (generationOverride) return generationOverride
  if (!url) return 'jpvbootcamp'
  try {
    return new URL(url).searchParams.get('schema') || 'jpvbootcamp'
  } catch {
    return 'jpvbootcamp'
  }
}

function cleanDbUrl(url: string | undefined): string {
  if (!url) return ''
  try {
    const u = new URL(url)
    u.searchParams.delete('schema')
    return u.toString()
  } catch {
    return url
  }
}

export default buildConfig({
  admin: {
    user: 'payload_users',
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      graphics: {
        Logo: './components/payload/JPVAdminBranding#JPVAdminLogo',
        Icon: './components/payload/JPVAdminBranding#JPVAdminIcon',
      },
      views: {
        dashboard: {
          Component: './components/payload/JPVAdminDashboard#JPVAdminDashboard',
        },
      },
    },
    meta: {
      title: 'JPV Bootcamp Portal',
      titleSuffix: ' — JPV Bootcamp Portal',
      description: 'JPV Bootcamp Portal administration',
      icons: [
        {
          rel: 'icon',
          type: 'image/jpeg',
          url: jpvBrand.logoPath,
        },
        {
          rel: 'apple-touch-icon',
          type: 'image/jpeg',
          url: jpvBrand.logoPath,
        },
      ],
    },
  },
  routes: {
    admin: '/admin',
  },
  collections: [
    // Community
    ...communityCollections,
    // Courses
    PayloadLiveSession,
    PayloadCourses,
    PayloadCourseModules,
    PayloadLessons,
    PayloadCourseAccessPreview,
    ...courseRuntimeCollections,
    // Content (including Bunny Videos)
    PayloadMedia,
    PayloadPages,
    PayloadPosts,
    PayloadCategories,
    PayloadBunnyVideo,
    // Members & Access
    ...memberCollections,
    ...accessControlCollections,
    // Partners & Affiliates
    ...affiliateCollections,
    ...partnerCollections,
    // Billing
    ...billingCollections,
    // Administration
    PayloadUsers,
    ...auditCollections,
    ...crmCollections,
    // Membership Support
    ...membershipSupportCollections,
  ],
  editor: lexicalEditor(),
  plugins: mediaStoragePlugins,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: cleanDbUrl(process.env.DATABASE_URL),
      // TCP keepalive: prevents Docker NAT/firewall from silently dropping idle connections
      keepAlive: true,
      keepAliveInitialDelayMillis: 60_000,
      // Recycle idle connections before the NAT idle timeout (~15-30 min on Docker networks)
      idleTimeoutMillis: 600_000,
      // Fail fast on new connection attempts instead of hanging for the OS TCP timeout (~75 s)
      connectionTimeoutMillis: 10_000,
    },
    schemaName: getDbSchema(process.env.DATABASE_URL),
    // Only expose reviewed Payload migrations to explicit migrate commands.
    prodMigrations: shouldRegisterPayloadProdMigrations() ? migrations : undefined,
  }),
  serverURL: process.env.PAYLOAD_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL,
  onInit: async (payload) => {
    await stagingAutoProvision(payload)
  },
})
