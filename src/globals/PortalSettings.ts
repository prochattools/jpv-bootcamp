import type { GlobalConfig } from 'payload'

import { requirePayloadAdmin } from '@/lib/access/payloadAccess'

export const PortalSettings: GlobalConfig = {
  slug: 'portalSettings',
  label: 'Portal Settings',
  admin: {
    group: 'Settings',
    description: 'JPV member portal branding and sign-in presentation. Migrated from source-proven FluentCommunity settings.',
  },
  access: {
    read: requirePayloadAdmin,
    update: requirePayloadAdmin,
  },
  fields: [
    {
      name: 'siteTitle',
      type: 'text',
      required: true,
      defaultValue: 'JPV Bootcamp',
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'payload_media',
      admin: {
        description: 'Primary portal logo.',
      },
    },
    {
      name: 'whiteLogo',
      type: 'upload',
      relationTo: 'payload_media',
      admin: {
        description: 'Alternate/light portal logo where a dark surface needs it.',
      },
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'payload_media',
      admin: {
        description: 'Portal/social featured image from the legacy community settings.',
      },
    },
    {
      name: 'loginBanner',
      type: 'group',
      fields: [
        { name: 'title', type: 'text', defaultValue: 'Welcome to JPV Bootcamp - Portal' },
        { name: 'description', type: 'textarea', defaultValue: 'Join our community and start your journey to success' },
        { name: 'titleColor', type: 'text', defaultValue: '#19283a' },
        { name: 'textColor', type: 'text', defaultValue: '#525866' },
        { name: 'backgroundColor', type: 'text', defaultValue: '#F5F7FA' },
        { name: 'logo', type: 'upload', relationTo: 'payload_media' },
        { name: 'backgroundImage', type: 'upload', relationTo: 'payload_media' },
      ],
    },
    {
      name: 'loginForm',
      type: 'group',
      fields: [
        { name: 'title', type: 'text', defaultValue: 'Login to JPV Bootcamp - Portal' },
        { name: 'description', type: 'textarea', defaultValue: 'Enter your email and password to login' },
        { name: 'titleColor', type: 'text', defaultValue: '#19283a' },
        { name: 'textColor', type: 'text', defaultValue: '#525866' },
        { name: 'backgroundColor', type: 'text', defaultValue: '#ffffff' },
        { name: 'buttonLabel', type: 'text', defaultValue: 'Login' },
        { name: 'buttonColor', type: 'text', defaultValue: '#2B2E33' },
        { name: 'buttonLabelColor', type: 'text', defaultValue: '#ffffff' },
        { name: 'backgroundImage', type: 'upload', relationTo: 'payload_media' },
      ],
    },
    {
      name: 'legacySettings',
      type: 'json',
      admin: {
        hidden: true,
        readOnly: true,
        description: 'Exact migrated FluentCommunity settings/provenance that are not executed by the new platform.',
      },
    },
  ],
}
