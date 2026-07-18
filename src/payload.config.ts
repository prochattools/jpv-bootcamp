import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { PayloadUsers } from './collections/PayloadUsers'
import { PayloadMedia } from './collections/PayloadMedia'
import { PayloadPages } from './collections/PayloadPages'
import { PayloadPosts } from './collections/PayloadPosts'
import { PayloadCategories } from './collections/PayloadCategories'
import { PayloadLiveSession } from './collections/PayloadLiveSession'
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
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)


function getDbSchema(url: string | undefined): string {
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
          url: '/images/jpv-logo.jpg',
        },
        {
          rel: 'apple-touch-icon',
          type: 'image/jpeg',
          url: '/images/jpv-logo.jpg',
        },
      ],
    },
  },
  routes: {
    admin: '/admin',
  },
  collections: [
    PayloadUsers,
    PayloadMedia,
    PayloadPages,
    PayloadPosts,
    PayloadCategories,
    PayloadLiveSession,
    PayloadCourses,
    PayloadCourseModules,
    PayloadLessons,
    PayloadCourseAccessPreview,
    ...memberCollections,
    ...courseRuntimeCollections,
    ...accessControlCollections,
    ...affiliateCollections,
    ...partnerCollections,
    ...billingCollections,
    ...membershipSupportCollections,
    ...crmCollections,
    ...communityCollections,
    ...auditCollections,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: cleanDbUrl(process.env.DATABASE_URL),
    },
    schemaName: getDbSchema(process.env.DATABASE_URL),
    // Only expose reviewed Payload migrations to explicit migrate commands.
    prodMigrations: shouldRegisterPayloadProdMigrations() ? migrations : undefined,
  }),
  serverURL: process.env.PAYLOAD_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL,
})
