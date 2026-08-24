import type { CollectionConfig } from 'payload'

export const PayloadUsers: CollectionConfig = {
  slug: 'payload_users',
  dbName: 'payload_users',
  labels: {
    singular: 'Administrator',
    plural: 'Administrators',
  },
  auth: true,
  admin: {
    useAsTitle: 'email',
    group: 'System',
    description: 'Payload administrator accounts. These are separate from student and client member accounts.',
  },
  fields: [],
}
