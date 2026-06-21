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
import {
  PayloadCourseAccessPreview,
  PayloadCourseModules,
  PayloadCourses,
  PayloadLessons,
} from './collections/PayloadCoursePrototype'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const collectionBranding = {
  payload_users: { singular: 'Administrator', plural: 'Administrators', group: 'Administration' },
  payload_media: { singular: 'Media Item', plural: 'Media', group: 'Content' },
  payload_pages: { singular: 'Page', plural: 'Pages', group: 'Content' },
  payload_posts: { singular: 'Post', plural: 'Posts', group: 'Content' },
  payload_categories: { singular: 'Category', plural: 'Categories', group: 'Content' },
  payload_courses: { singular: 'Course', plural: 'Courses', group: 'Course Management' },
  payload_course_modules: { singular: 'Module', plural: 'Modules', group: 'Course Management' },
  payload_lessons: { singular: 'Lesson', plural: 'Lessons', group: 'Course Management' },
  payload_course_access_preview: {
    singular: 'Access Preview',
    plural: 'Access Preview',
    group: 'Course Management',
  },
} as const

for (const collection of [
  PayloadUsers,
  PayloadMedia,
  PayloadPages,
  PayloadPosts,
  PayloadCategories,
  PayloadCourses,
  PayloadCourseModules,
  PayloadLessons,
  PayloadCourseAccessPreview,
]) {
  const branding = collectionBranding[collection.slug as keyof typeof collectionBranding]

  if (branding) {
    collection.labels = {
      singular: branding.singular,
      plural: branding.plural,
    }
    collection.admin = {
      ...collection.admin,
      group: branding.group,
    }
  }
}

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
    meta: {
      title: 'JPV Bootcamp',
      titleSuffix: ' — JPV Bootcamp',
      description: 'JPV Bootcamp course and content management',
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
    admin: '/app',
  },
  collections: [
    PayloadUsers,
    PayloadMedia,
    PayloadPages,
    PayloadPosts,
    PayloadCategories,
    PayloadCourses,
    PayloadCourseModules,
    PayloadLessons,
    PayloadCourseAccessPreview,
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
    // Run pending migrations automatically on connect in production (NODE_ENV=production).
    // Idempotent: already-applied migrations are skipped via payload_migrations table.
    prodMigrations: migrations,
  }),
  serverURL: process.env.PAYLOAD_SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL,
})
