import type { CollectionConfig } from 'payload'

import { membershipSupportAccess } from './access'
import { fundingSourceRelationship, reconciliationRelationship, supportRelationship, voucherRelationship } from './relationships'
import { auditSeverityOptions, membershipSupportGroup } from './options'
import { displayNameHookFromFields, normalizeMembershipSupportText } from './hooks'

export const PayloadMembershipAuditHistory: CollectionConfig = {
  slug: 'payload_membership_audit_history',
  dbName: 'payload_membership_audit_history',
  labels: {
    singular: 'Membership Audit History',
    plural: 'Membership Audit History',
  },
  admin: {
    group: membershipSupportGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'actorType', 'action', 'severity', 'targetCollection', 'createdAt'],
    description: 'Append-only audit history for membership support operations.',
  },
  access: membershipSupportAccess,
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      hooks: {
        beforeValidate: [displayNameHookFromFields({ prefix: 'Audit history', fields: [{ name: 'actorType' }, { name: 'action' }] })],
      },
    },
    {
      name: 'actorType',
      type: 'select',
      required: true,
      defaultValue: 'admin',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Member', value: 'member' },
        { label: 'Stripe', value: 'stripe' },
        { label: 'System', value: 'system' },
        { label: 'Migration', value: 'migration' },
      ],
    },
    {
      name: 'actorId',
      type: 'text',
      index: true,
    },
    {
      name: 'action',
      type: 'text',
      required: true,
      index: true,
      hooks: {
        beforeValidate: [({ value }) => normalizeMembershipSupportText(value)],
      },
    },
    {
      name: 'targetCollection',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'targetId',
      type: 'text',
      index: true,
    },
    {
      name: 'severity',
      type: 'select',
      required: true,
      defaultValue: 'info',
      options: auditSeverityOptions,
    },
    {
      name: 'approvalReference',
      type: 'text',
      index: true,
    },
    supportRelationship(),
    voucherRelationship(),
    fundingSourceRelationship(),
    reconciliationRelationship(),
    { name: 'before', type: 'json' },
    { name: 'after', type: 'json' },
    { name: 'notes', type: 'textarea' },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}

