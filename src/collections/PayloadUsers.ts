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
    description: 'Payload administrator accounts. Each administrator is also linked to a member-facing portal profile; billing remains optional.',
  },
  hooks: {
    afterChange: [
      ({ doc, req }) => {
        void import('@/lib/auth/adminMemberIdentity').then(({ ensureAdministratorMemberIdentity }) =>
          ensureAdministratorMemberIdentity(req.payload as never, doc as never).catch((error) => {
            console.error('administrator_member_identity_provisioning_failed', {
              administratorId: doc.id,
              error: error instanceof Error ? error.message : 'unknown_error',
            })
          })
        )
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'portalMember',
      type: 'relationship',
      relationTo: 'payload_members',
      unique: true,
      index: true,
      admin: {
        description: 'Automatically provisioned member identity used for portal participation. It does not create a billing account.',
        readOnly: true,
      },
    },
  ],
}
