import type { CollectionConfig } from 'payload'

import { isPayloadAdminRequest } from '@/lib/access/payloadAccess'
import {
  isStripeOperatorAction,
  processPayloadBillingAction,
} from '@/lib/billing/stripeOperatorActions'

const billingGroup = 'Billing'

const webhookProjectionCollectionAccess = {
  admin: ({ req }: { req: Parameters<typeof isPayloadAdminRequest>[0] }) => isPayloadAdminRequest(req),
  create: () => false,
  read: ({ req }: { req: Parameters<typeof isPayloadAdminRequest>[0] }) => isPayloadAdminRequest(req),
  update: () => false,
  delete: () => false,
}

const stripeModeOptions = [
  { label: 'Test', value: 'test' },
  { label: 'Live', value: 'live' },
]

export const PayloadBillingAccounts: CollectionConfig = {
  slug: 'payload_billing_accounts',
  dbName: 'payload_billing_accounts',
  labels: {
    singular: 'Billing Account',
    plural: 'Billing Accounts',
  },
  admin: {
    group: billingGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'stripeCustomerId', 'billingStatus', 'updatedAt'],
    description: 'Billing account projections are read-only. Use Billing Actions for guarded Stripe test-mode operations.',
  },
  access: webhookProjectionCollectionAccess,
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    { name: 'stripeCustomerId', type: 'text', required: true, unique: true, index: true },
    {
      name: 'stripeMode',
      type: 'select',
      required: true,
      defaultValue: 'test',
      options: stripeModeOptions,
    },
    {
      name: 'billingStatus',
      type: 'select',
      required: true,
      defaultValue: 'none',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Active', value: 'active' },
        { label: 'Trialing', value: 'trialing' },
        { label: 'Billing Hold', value: 'billing_hold' },
        { label: 'Past Due', value: 'past_due' },
        { label: 'Unpaid', value: 'unpaid' },
        { label: 'Canceled', value: 'canceled' },
      ],
    },
    { name: 'defaultPaymentMethodId', type: 'text' },
    { name: 'billingEmail', type: 'email' },
    { name: 'lastSyncedAt', type: 'date' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadSubscriptions: CollectionConfig = {
  slug: 'payload_subscriptions',
  dbName: 'payload_subscriptions',
  labels: {
    singular: 'Subscription',
    plural: 'Subscriptions',
  },
  admin: {
    group: billingGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'plan', 'status', 'currentPeriodEnd', 'updatedAt'],
    description: 'Read-only Stripe subscription projection. Create a Billing Action to sync, schedule cancellation, or reverse it.',
  },
  access: webhookProjectionCollectionAccess,
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    {
      name: 'billingAccount',
      type: 'relationship',
      relationTo: 'payload_billing_accounts',
      required: true,
      index: true,
    },
    { name: 'stripeSubscriptionId', type: 'text', required: true, unique: true, index: true },
    { name: 'stripeSubscriptionScheduleId', type: 'text', unique: true, index: true },
    { name: 'stripePriceId', type: 'text', index: true },
    { name: 'stripeProductId', type: 'text', index: true },
    {
      name: 'plan',
      type: 'select',
      required: true,
      options: [
        { label: 'JPV Bootcamp Membership', value: 'jpv_bootcamp_membership' },
        // narrow-allowlist: migration-import compatibility only — do not add new values
        { label: 'Legacy Pro (migration only)', value: 'pro' },
        { label: 'Legacy Free (migration only)', value: 'free' },
      ],
      admin: {
        description: 'Entitlement key. New subscriptions use jpv_bootcamp_membership only.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'incomplete',
      options: [
        { label: 'Incomplete', value: 'incomplete' },
        { label: 'Incomplete Expired', value: 'incomplete_expired' },
        { label: 'Trialing', value: 'trialing' },
        { label: 'Active', value: 'active' },
        { label: 'Past Due', value: 'past_due' },
        { label: 'Canceled', value: 'canceled' },
        { label: 'Unpaid', value: 'unpaid' },
        { label: 'Paused', value: 'paused' },
      ],
    },
    {
      name: 'billingCadence',
      type: 'select',
      options: [
        { label: 'Monthly commitment', value: 'monthly_commitment' },
        { label: 'Annual', value: 'annual' },
      ],
    },
    {
      name: 'commitmentStatus',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Active', value: 'active' },
        { label: 'Cancellation requested', value: 'cancellation_requested' },
        { label: 'Completed', value: 'completed' },
        { label: 'Terminated', value: 'terminated' },
      ],
    },
    { name: 'commitmentStartAt', type: 'date' },
    { name: 'commitmentEndAt', type: 'date' },
    { name: 'cancellationEffectiveAt', type: 'date' },
    { name: 'paymentGraceEndsAt', type: 'date' },
    { name: 'cancelAtPeriodEnd', type: 'checkbox', defaultValue: false },
    { name: 'currentPeriodStart', type: 'date' },
    { name: 'currentPeriodEnd', type: 'date' },
    { name: 'trialEndsAt', type: 'date' },
    { name: 'canceledAt', type: 'date' },
    { name: 'lastStripeEventId', type: 'text', index: true },
    { name: 'lastSyncedAt', type: 'date' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadPayments: CollectionConfig = {
  slug: 'payload_payments',
  dbName: 'payload_payments',
  labels: {
    singular: 'Payment',
    plural: 'Payments',
  },
  admin: {
    group: billingGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'amount', 'currency', 'status', 'paidAt'],
    description: 'Read-only payment, refund, and dispute history projected from Stripe webhooks.',
  },
  access: webhookProjectionCollectionAccess,
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      index: true,
    },
    {
      name: 'subscription',
      type: 'relationship',
      relationTo: 'payload_subscriptions',
      index: true,
    },
    { name: 'stripeInvoiceId', type: 'text', unique: true, index: true },
    { name: 'stripePaymentIntentId', type: 'text', index: true },
    { name: 'amount', type: 'number', required: true, min: 0 },
    { name: 'currency', type: 'text', required: true, defaultValue: 'usd' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
        { label: 'Action Required', value: 'action_required' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Disputed', value: 'disputed' },
        { label: 'Dispute Resolved', value: 'dispute_resolved' },
        { label: 'Voided', value: 'voided' },
      ],
    },
    { name: 'paidAt', type: 'date' },
    { name: 'failedAt', type: 'date' },
    { name: 'failureReason', type: 'textarea' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadStripeEvents: CollectionConfig = {
  slug: 'payload_stripe_events',
  dbName: 'payload_stripe_events',
  labels: {
    singular: 'Stripe Event',
    plural: 'Stripe Events',
  },
  admin: {
    group: billingGroup,
    useAsTitle: 'eventId',
    defaultColumns: ['eventId', 'eventType', 'livemode', 'processingStatus', 'processedAt'],
    hidden: true,
  },
  access: webhookProjectionCollectionAccess,
  fields: [
    { name: 'eventId', type: 'text', required: true, unique: true, index: true },
    { name: 'eventType', type: 'text', required: true, index: true },
    { name: 'livemode', type: 'checkbox', required: true, defaultValue: false },
    {
      name: 'processingStatus',
      type: 'select',
      required: true,
      defaultValue: 'received',
      options: [
        { label: 'Received', value: 'received' },
        { label: 'Processed', value: 'processed' },
        { label: 'Deduped', value: 'deduped' },
        { label: 'Skipped', value: 'skipped' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    { name: 'receivedAt', type: 'date', required: true },
    { name: 'processedAt', type: 'date' },
    { name: 'failureReason', type: 'textarea' },
    { name: 'payload', type: 'json', required: true },
  ],
  timestamps: true,
}

export const PayloadBillingActions: CollectionConfig = {
  slug: 'payload_billing_actions',
  dbName: 'payload_billing_actions',
  labels: {
    singular: 'Billing Action',
    plural: 'Billing Actions',
  },
  admin: {
    group: billingGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'subscription', 'actionType', 'status', 'requestedBy', 'createdAt'],
    description: 'Create a guarded test-mode subscription action. Results are immutable audit records.',
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
        if (!isStripeOperatorAction(data?.actionType)) {
          throw new Error('Administrators may create only sync, cancel-at-period-end, or resume actions.')
        }
        const subscription = data?.subscription
        const subscriptionId = typeof subscription === 'object' ? subscription?.id : subscription
        if (subscriptionId === undefined || subscriptionId === null || String(subscriptionId).trim() === '') {
          throw new Error('A Payload subscription record is required.')
        }
        return {
          ...data,
          displayName: `${data.actionType} subscription ${String(subscriptionId)}`,
          requestedBy: req.user.id,
          status: 'pending',
          sourceEventId: undefined,
          completedAt: undefined,
          result: undefined,
          metadata: undefined,
        }
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => processPayloadBillingAction({
        doc,
        operation,
        req: {
          payload: req.payload,
          user: req.user as { id?: string | number; collection?: string; email?: string } | null,
        },
      }),
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
      name: 'subscription',
      type: 'relationship',
      relationTo: 'payload_subscriptions',
      index: true,
      admin: {
        description: 'Select the Payload subscription. Stripe IDs are derived server-side.',
      },
    },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'requestedBy',
      type: 'relationship',
      relationTo: 'payload_users',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'actionType',
      type: 'select',
      required: true,
      options: [
        { label: 'Sync from Stripe test mode', value: 'sync_subscription' },
        { label: 'Cancel at period end', value: 'cancel_at_period_end' },
        { label: 'Reverse scheduled cancellation', value: 'resume_subscription' },
        { label: 'Checkout Completed', value: 'checkout_completed' },
        { label: 'Subscription Created', value: 'subscription_created' },
        { label: 'Subscription Updated', value: 'subscription_updated' },
        { label: 'Subscription Canceled', value: 'subscription_canceled' },
        { label: 'Payment Succeeded', value: 'payment_succeeded' },
        { label: 'Payment Failed', value: 'payment_failed' },
        { label: 'Payment Refunded', value: 'payment_refunded' },
        { label: 'Payment Disputed', value: 'payment_disputed' },
        { label: 'Dispute Resolved', value: 'dispute_resolved' },
        { label: 'Access Blocked', value: 'access_blocked' },
        { label: 'Access Restored', value: 'access_restored' },
      ],
      admin: {
        description: 'Administrators can create only the first three operator actions. Other values are webhook audit history.',
      },
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
    { name: 'sourceEventId', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'completedAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Optional operator reason or change-ticket reference.' },
    },
    { name: 'result', type: 'json', admin: { readOnly: true } },
    { name: 'metadata', type: 'json', admin: { readOnly: true } },
  ],
  timestamps: true,
}
