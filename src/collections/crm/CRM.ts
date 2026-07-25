import type { CollectionConfig } from 'payload'

import { adminOnlyCollectionAccess, isPayloadAdminRequest } from '@/lib/access/payloadAccess'

const crmGroup = 'Administration'

function isEmailOperatorAction(value: unknown): boolean {
  return value === 'retry_delivery'
}

export const PayloadContacts: CollectionConfig = {
  slug: 'payload_contacts',
  dbName: 'payload_contacts',
  labels: {
    singular: 'Contact',
    plural: 'Contacts',
  },
  admin: {
    group: crmGroup,
    hidden: true,
    useAsTitle: 'email',
    defaultColumns: ['email', 'member', 'lifecycleStage', 'emailStatus', 'updatedAt'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'email', type: 'email', required: true, unique: true, index: true },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      index: true,
    },
    { name: 'firstName', type: 'text' },
    { name: 'lastName', type: 'text' },
    { name: 'company', type: 'text' },
    {
      name: 'lifecycleStage',
      type: 'select',
      required: true,
      defaultValue: 'lead',
      options: [
        { label: 'Lead', value: 'lead' },
        { label: 'Student', value: 'student' },
        { label: 'Client', value: 'client' },
        { label: 'Partner', value: 'partner' },
        { label: 'Churned', value: 'churned' },
      ],
    },
    {
      name: 'emailStatus',
      type: 'select',
      required: true,
      defaultValue: 'subscribed',
      options: [
        { label: 'Subscribed', value: 'subscribed' },
        { label: 'Transactional Only', value: 'transactional_only' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
        { label: 'Bounced', value: 'bounced' },
        { label: 'Complained', value: 'complained' },
      ],
    },
    { name: 'marketingConsentAt', type: 'date' },
    { name: 'lastActivityAt', type: 'date' },
    { name: 'source', type: 'text' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadCrmTags: CollectionConfig = {
  slug: 'payload_crm_tags',
  dbName: 'payload_crm_tags',
  labels: {
    singular: 'CRM Tag',
    plural: 'CRM Tags',
  },
  admin: {
    group: crmGroup,
    hidden: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'status', 'updatedAt'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    { name: 'description', type: 'textarea' },
  ],
  timestamps: true,
}

export const PayloadContactTags: CollectionConfig = {
  slug: 'payload_contact_tags',
  dbName: 'payload_contact_tags',
  labels: {
    singular: 'Contact Tag Assignment',
    plural: 'Contact Tag Assignments',
  },
  admin: {
    group: crmGroup,
    hidden: true,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'contact', 'tag', 'source', 'createdAt'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'contact',
      type: 'relationship',
      relationTo: 'payload_contacts',
      required: true,
      index: true,
    },
    {
      name: 'tag',
      type: 'relationship',
      relationTo: 'payload_crm_tags',
      required: true,
      index: true,
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Stripe', value: 'stripe' },
        { label: 'Course', value: 'course' },
        { label: 'Migration', value: 'migration' },
        { label: 'Automation', value: 'automation' },
      ],
    },
    { name: 'sourceId', type: 'text' },
  ],
  timestamps: true,
}

export const PayloadContactNotes: CollectionConfig = {
  slug: 'payload_contact_notes',
  dbName: 'payload_contact_notes',
  labels: {
    singular: 'Contact Note',
    plural: 'Contact Notes',
  },
  admin: {
    group: crmGroup,
    hidden: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'contact', 'noteType', 'createdAt'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'contact',
      type: 'relationship',
      relationTo: 'payload_contacts',
      required: true,
      index: true,
    },
    {
      name: 'noteType',
      type: 'select',
      required: true,
      defaultValue: 'admin_note',
      options: [
        { label: 'Admin Note', value: 'admin_note' },
        { label: 'Support', value: 'support' },
        { label: 'Billing', value: 'billing' },
        { label: 'Course', value: 'course' },
        { label: 'Migration', value: 'migration' },
      ],
    },
    { name: 'body', type: 'textarea', required: true },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadEmailTemplates: CollectionConfig = {
  slug: 'payload_email_templates',
  dbName: 'payload_email_templates',
  labels: {
    singular: 'Email Template',
    plural: 'Email Templates',
  },
  admin: {
    group: crmGroup,
    hidden: true,
    useAsTitle: 'name',
    defaultColumns: ['name', 'templateKey', 'status', 'purpose', 'updatedAt'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'templateKey', type: 'text', required: true, unique: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    {
      name: 'purpose',
      type: 'select',
      required: true,
      options: [
        { label: 'Account Created', value: 'account_created' },
        { label: 'Password Changed', value: 'password_changed' },
        { label: 'Payment Made', value: 'payment_made' },
        { label: 'Subscription Started', value: 'subscription_started' },
        { label: 'Subscription Canceled', value: 'subscription_canceled' },
        { label: 'Payment Failed', value: 'payment_failed' },
        { label: 'Admin Notification', value: 'admin_notification' },
      ],
    },
    { name: 'subject', type: 'text', required: true },
    { name: 'preheader', type: 'text' },
    { name: 'textBody', type: 'textarea', required: true },
    { name: 'htmlBody', type: 'textarea' },
    {
      name: 'adminCopyRequired',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'When true, email workflows must also notify the configured admin recipient.',
      },
    },
  ],
  timestamps: true,
}

export const PayloadEmailEvents: CollectionConfig = {
  slug: 'payload_email_events',
  dbName: 'payload_email_events',
  lockDocuments: false,
  labels: {
    singular: 'Email Event',
    plural: 'Email Events',
  },
  admin: {
    group: crmGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'toEmail', 'templateKey', 'deliveryStatus', 'retryCount', 'failureReason', 'createdAt'],
    description: 'Read-only delivery queue and provider status. Use Email Actions to retry failed events.',
  },
  access: {
    admin: ({ req }) => isPayloadAdminRequest(req),
    create: () => false,
    read: ({ req }) => isPayloadAdminRequest(req),
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'displayName', type: 'text', required: true },
    { name: 'toEmail', type: 'email', required: true, index: true },
    {
      name: 'contact',
      type: 'relationship',
      relationTo: 'payload_contacts',
      index: true,
    },
    { name: 'templateKey', type: 'text', required: true, index: true },
    {
      name: 'deliveryStatus',
      type: 'select',
      required: true,
      defaultValue: 'queued',
      options: [
        { label: 'Queued', value: 'queued' },
        { label: 'Sent', value: 'sent' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Opened', value: 'opened' },
        { label: 'Clicked', value: 'clicked' },
        { label: 'Bounced', value: 'bounced' },
        { label: 'Complained', value: 'complained' },
        { label: 'Failed', value: 'failed' },
        { label: 'Skipped', value: 'skipped' },
      ],
    },
    { name: 'resendEmailId', type: 'text', index: true },
    { name: 'dedupeKey', type: 'text', index: true },
    { name: 'sentAt', type: 'date' },
    { name: 'deliveredAt', type: 'date' },
    { name: 'failureReason', type: 'textarea', admin: { readOnly: true } },
    {
      name: 'retryCount',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { readOnly: true },
    },
    { name: 'lastRetryRequestedAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'lastRetryRequestedBy',
      type: 'relationship',
      relationTo: 'payload_users',
      admin: { readOnly: true },
    },
    { name: 'metadata', type: 'json', admin: { readOnly: true } },
  ],
  timestamps: true,
}

export const PayloadEmailActions: CollectionConfig = {
  slug: 'payload_email_actions',
  dbName: 'payload_email_actions',
  labels: {
    singular: 'Email Action',
    plural: 'Email Actions',
  },
  admin: {
    group: crmGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'emailEvent', 'actionType', 'status', 'requestedBy', 'createdAt'],
    description: 'Create a retry request for a failed email event. The action only requeues the event; provider sending remains queue-controlled.',
  },
  access: {
    admin: ({ req }) => isPayloadAdminRequest(req),
    create: ({ req }) => isPayloadAdminRequest(req),
    read: ({ req }) => isPayloadAdminRequest(req),
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeValidate: [
      ({ data, operation, req }) => {
        if (operation !== 'create' || req.user?.collection !== 'payload_users') return data
        if (!isEmailOperatorAction(data?.actionType)) {
          throw new Error('Administrators may create only retry delivery actions.')
        }
        const event = data?.emailEvent
        const eventId = typeof event === 'object' ? event?.id : event
        if (eventId === undefined || eventId === null || String(eventId).trim() === '') {
          throw new Error('A failed Payload Email Event is required.')
        }
        return {
          ...data,
          displayName: `Retry email event ${String(eventId)}`,
          requestedBy: req.user.id,
          status: 'pending',
          completedAt: undefined,
          result: undefined,
        }
      },
    ],
    afterChange: [
      ({ doc, operation, req }) => {
        if (operation !== 'create') return doc
        void import('@/lib/email/emailOperatorActions').then(({ processPayloadEmailAction }) =>
          processPayloadEmailAction({
            doc,
            operation,
            req: {
              payload: req.payload,
              user: req.user as { id?: string | number; collection?: string } | null,
            },
          }).catch((err) => {
            console.error('email_action_afterChange_background', { id: doc.id, error: err?.message })
          }),
        )
        return doc
      },
    ],
  },
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      admin: { readOnly: true },
    },
    {
      name: 'emailEvent',
      type: 'relationship',
      relationTo: 'payload_email_events',
      required: true,
      index: true,
      filterOptions: {
        deliveryStatus: { equals: 'failed' },
      },
      admin: {
        description: 'Only failed events are eligible. The selected event ID is resolved server-side.',
      },
    },
    {
      name: 'actionType',
      type: 'select',
      required: true,
      defaultValue: 'retry_delivery',
      options: [{ label: 'Retry failed delivery', value: 'retry_delivery' }],
    },
    {
      name: 'requestedBy',
      type: 'relationship',
      relationTo: 'payload_users',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
        { label: 'Skipped', value: 'skipped' },
      ],
      admin: { readOnly: true },
    },
    {
      name: 'note',
      type: 'textarea',
      admin: { description: 'Optional operator reason or support ticket reference.' },
    },
    { name: 'completedAt', type: 'date', admin: { readOnly: true } },
    { name: 'result', type: 'json', admin: { readOnly: true } },
  ],
  timestamps: true,
}

export const PayloadAdminNotifications: CollectionConfig = {
  slug: 'payload_admin_notifications',
  dbName: 'payload_admin_notifications',
  labels: {
    singular: 'Admin Notification',
    plural: 'Admin Notifications',
  },
  admin: {
    group: crmGroup,
    hidden: true,
    useAsTitle: 'title',
    defaultColumns: ['title', 'notificationType', 'severity', 'status', 'createdAt'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'notificationType',
      type: 'select',
      required: true,
      options: [
        { label: 'Account', value: 'account' },
        { label: 'Billing', value: 'billing' },
        { label: 'Course', value: 'course' },
        { label: 'Community', value: 'community' },
        { label: 'System', value: 'system' },
      ],
    },
    {
      name: 'severity',
      type: 'select',
      required: true,
      defaultValue: 'info',
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warning' },
        { label: 'Error', value: 'error' },
        { label: 'Critical', value: 'critical' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'unread',
      options: [
        { label: 'Unread', value: 'unread' },
        { label: 'Read', value: 'read' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    { name: 'body', type: 'textarea', required: true },
    { name: 'relatedCollection', type: 'text' },
    { name: 'relatedDocumentId', type: 'text' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

