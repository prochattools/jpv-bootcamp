import type { GlobalConfig } from 'payload'

import { requirePayloadAdmin } from '@/lib/access/payloadAccess'
import { membershipSupportGroup } from '@/collections/membership-support/options'

export const PayItForwardSettings: GlobalConfig = {
  slug: 'payItForwardSettings',
  label: 'Pay It Forward Settings',
  admin: {
    group: membershipSupportGroup,
    description: 'Configuration for pay-it-forward sponsored membership: admin notification recipients and settings.',
  },
  access: {
    read: requirePayloadAdmin,
    update: requirePayloadAdmin,
  },
  fields: [
    {
      name: 'adminEmailsText',
      type: 'textarea',
      label: 'Admin notification emails',
      admin: {
        description: 'Comma-separated email addresses to notify when a sponsored application is submitted or a seat is purchased.',
      },
    },
  ],
}
