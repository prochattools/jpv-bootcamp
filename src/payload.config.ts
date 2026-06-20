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

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

// Strip Prisma-only ?schema= param — pg doesn't understand it and PostgreSQL
// rejects it as an unknown configuration parameter, causing connection failure.
// schemaName below already sets the search_path for Payload's adapter.
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
    schemaName: 'jpvbootcamp',
  }),
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
})
