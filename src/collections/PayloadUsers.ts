import type { CollectionConfig } from 'payload'

export const PayloadUsers: CollectionConfig = {
  slug: 'payload_users',
  dbName: 'payload_users',
  auth: {
    logout: {
      url: '/',
    },
  },
  admin: {
    useAsTitle: 'email',
  },
  fields: [],
}
