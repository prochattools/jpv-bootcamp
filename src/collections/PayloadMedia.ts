import type { CollectionConfig } from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export const PayloadMedia: CollectionConfig = {
  slug: 'payload_media',
  dbName: 'payload_media',
  labels: {
    singular: 'Media Item',
    plural: 'Media',
  },
  upload: {
    staticDir: path.resolve(dirname, '../../public/media'),
  },
  fields: [
    { name: 'alt', type: 'text', required: true },
  ],
}
