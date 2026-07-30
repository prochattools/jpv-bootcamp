import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import type { EmailAdapter, SendEmailOptions } from 'payload'
import { Resend } from 'resend'
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
  email: buildPayloadEmailAdapter,
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
