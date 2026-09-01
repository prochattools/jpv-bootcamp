import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import type { EmailAdapter, SendEmailOptions } from 'payload'
import { Resend } from 'resend'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { BlocksFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { PayloadUsers } from './collections/PayloadUsers'
import { PayloadPortalNavItems } from './collections/PayloadPortalNavItems'
import { PayloadMedia } from './collections/PayloadMedia'
import { PayloadPages } from './collections/PayloadPages'
import { PayloadPosts } from './collections/PayloadPosts'
import { PayloadCategories } from './collections/PayloadCategories'
import { PayloadLiveSession } from './collections/PayloadLiveSession'
import { PayloadRoomCategories } from './collections/PayloadRoomCategories'
import { PayloadRoomAccess } from './collections/PayloadRoomAccess'
import { PayloadBunnyVideo } from './collections/PayloadBunnyVideo'
import {
  PayloadCourseAccessPreview,
  PayloadCourseModules,
  PayloadCourses,
  PayloadLessons,
  PayloadLessonComments,
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
import { resolveJpvLogoUrl } from './lib/brand/jpvDesignSystem'
import { getPublicBaseUrl } from './lib/public-base-url'
import {
  resolveDatabaseConnectionConfig,
  assertProductionSchema,
  assertStagingSchema,
} from './lib/databaseConnectionConfig'
import { legacyMigrationRichTextBlocks } from './richtext/LegacyMigrationBlocks'
import { PortalSettings } from './globals/PortalSettings'
import { PayItForwardSettings } from './globals/PayItForwardSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const mediaStorage = resolvePayloadMediaStorageConfig()

function configuredFromAddress(): string {
  const configured = process.env.RESEND_FROM?.trim() || process.env.EMAIL_FROM?.trim()
  if (!configured) return 'notifications@jpvmindset.com'
  const bracketed = configured.match(/<([^>]+)>/)
  return (bracketed?.[1] || configured).trim()
}

function normalizeEmailRecipients(value: SendEmailOptions['to']): string[] {
  if (!value) return []
  const entries = Array.isArray(value) ? value : [value]
  return entries.flatMap((entry) => {
    if (typeof entry === 'string') return entry.split(',').map((item) => item.trim()).filter(Boolean)
    if (entry && typeof entry === 'object' && 'address' in entry && typeof entry.address === 'string') {
      return [entry.address]
    }
    return []
  })
}

// Payload requires `email` to be an adapter factory, not an initialized object.
// Authentication emails are sent immediately through Resend; application events
// continue to use the durable payload_email_events outbox and queue worker.
const buildPayloadEmailAdapter: EmailAdapter = () => {
  const defaultFromAddress = configuredFromAddress()
  const defaultFromName = process.env.EMAIL_FROM_NAME?.trim() || 'JPV Bootcamp'

  return {
    name: 'jpv-resend',
    defaultFromAddress,
    defaultFromName,
    sendEmail: async (message) => {
      const apiKey = process.env.RESEND_API_KEY?.trim()
      if (!apiKey) throw new Error('RESEND_API_KEY is required for Payload authentication email')

      const to = normalizeEmailRecipients(message.to)
      if (to.length === 0) throw new Error('Payload authentication email requires at least one recipient')

      const from = typeof message.from === 'string' && message.from.trim()
        ? message.from
        : `${defaultFromName} <${defaultFromAddress}>`
      const replyTo = normalizeEmailRecipients(message.replyTo)
      const html = typeof message.html === 'string' ? message.html : undefined
      const text = typeof message.text === 'string' ? message.text : undefined

      const resend = new Resend(apiKey)
      const common = {
        from,
        to,
        subject: String(message.subject || 'JPV Bootcamp notification'),
        ...(replyTo.length > 0 ? { replyTo } : {}),
      }
      const result = html
        ? await resend.emails.send({ ...common, html, ...(text ? { text } : {}) })
        : await resend.emails.send({ ...common, text: text || 'JPV Bootcamp notification' })

      if (result.error) {
        throw new Error(`Payload authentication email failed: ${result.error.message}`)
      }
      return result.data
    },
  }
}
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

const databaseConnection = resolveDatabaseConnectionConfig(
  process.env.DATABASE_URL,
  process.env.PAYLOAD_MIGRATION_SCHEMA,
)
// Fail closed when running in the Docker runtime environment if the schema is wrong.
// DEPLOYMENT_RUNTIME=docker is set in the runner stage (not the builder stage), so this guard
// fires at server startup but not during Next.js page-data collection at build time.
if (process.env.DEPLOYMENT_RUNTIME === 'docker') {
  if ((process.env.DEPLOYMENT_ENV ?? '').trim().toLowerCase() === 'production') {
    assertProductionSchema(databaseConnection)
  } else {
    assertStagingSchema(databaseConnection)
  }
}

export default buildConfig({
  admin: {
    user: 'payload_users',
    theme: 'light',
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      graphics: {
        Logo: './components/payload/JPVAdminBranding#JPVAdminLogo',
        Icon: './components/payload/JPVAdminBranding#JPVAdminIcon',
      },
      beforeNavLinks: ['./components/payload/JPVAdminDashboardNav#JPVAdminDashboardNav'],
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
          url: resolveJpvLogoUrl(getPublicBaseUrl()),
        },
        {
          rel: 'apple-touch-icon',
          type: 'image/jpeg',
          url: resolveJpvLogoUrl(getPublicBaseUrl()),
        },
      ],
    },
  },
  routes: {
    admin: '/admin',
  },
  globals: [PortalSettings, PayItForwardSettings],
  collections: [
    // Community
    ...communityCollections,
    // Courses
    PayloadLiveSession,
    PayloadRoomCategories,
    PayloadRoomAccess,
    PayloadCourses,
    PayloadCourseModules,
    PayloadLessons,
    PayloadLessonComments,
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
    // Settings
    PayloadPortalNavItems,
  ],
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      BlocksFeature({ blocks: legacyMigrationRichTextBlocks }),
    ],
  }),
  plugins: mediaStoragePlugins,
  secret: process.env.PAYLOAD_SECRET || '',
  email: buildPayloadEmailAdapter,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: databaseConnection.connectionString,
      // TCP keepalive: prevents Docker NAT/firewall from silently dropping idle connections
      keepAlive: true,
      keepAliveInitialDelayMillis: 60_000,
      // Recycle idle connections before the NAT idle timeout (~15-30 min on Docker networks)
      idleTimeoutMillis: 600_000,
      // Fail fast on new connection attempts instead of hanging for the OS TCP timeout (~75 s)
      connectionTimeoutMillis: 10_000,
    },
    schemaName: databaseConnection.schema,
    // Only expose reviewed Payload migrations to explicit migrate commands.
    prodMigrations: shouldRegisterPayloadProdMigrations() ? migrations : undefined,
  }),
  serverURL: process.env.PAYLOAD_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL,
  onInit: async (payload) => {
    await stagingAutoProvision(payload)
  },
})
