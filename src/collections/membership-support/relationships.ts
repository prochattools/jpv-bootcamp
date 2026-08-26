export function memberRelationship({
  required = false,
  index = true,
  hasMany = false,
}: {
  required?: boolean
  index?: boolean
  hasMany?: boolean
} = {}) {
  return {
    name: 'member',
    type: 'relationship',
    relationTo: 'payload_members' as any,
    required,
    index,
    hasMany,
  } as any
}

export function operatorRelationship({
  required = false,
  index = true,
  hasMany = false,
}: {
  required?: boolean
  index?: boolean
  hasMany?: boolean
} = {}) {
  return {
    name: 'operator',
    type: 'relationship',
    relationTo: 'payload_users' as any,
    required,
    index,
    hasMany,
  } as any
}

export function supportRelationship({
  required = false,
  index = true,
  hasMany = false,
}: {
  required?: boolean
  index?: boolean
  hasMany?: boolean
} = {}) {
  return {
    name: 'membershipSupport',
    type: 'relationship',
    relationTo: 'payload_membership_support_records' as any,
    required,
    index,
    hasMany,
  } as any
}

export function voucherRelationship({
  required = false,
  index = true,
  hasMany = false,
}: {
  required?: boolean
  index?: boolean
  hasMany?: boolean
} = {}) {
  return {
    name: 'voucher',
    type: 'relationship',
    relationTo: 'payload_membership_vouchers' as any,
    required,
    index,
    hasMany,
  } as any
}

export function fundingSourceRelationship({
  required = false,
  index = true,
  hasMany = false,
}: {
  required?: boolean
  index?: boolean
  hasMany?: boolean
} = {}) {
  return {
    name: 'fundingSource',
    type: 'relationship',
    relationTo: 'payload_membership_funding_sources' as any,
    required,
    index,
    hasMany,
  } as any
}

export function reconciliationRelationship({
  required = false,
  index = true,
  hasMany = false,
}: {
  required?: boolean
  index?: boolean
  hasMany?: boolean
} = {}) {
  return {
    name: 'reconciliation',
    type: 'relationship',
    relationTo: 'payload_membership_reconciliations' as any,
    required,
    index,
    hasMany,
  } as any
}

export function reviewQueueRelationship({
  required = false,
  index = true,
  hasMany = false,
}: {
  required?: boolean
  index?: boolean
  hasMany?: boolean
} = {}) {
  return {
    name: 'reviewQueueItem',
    type: 'relationship',
    relationTo: 'payload_membership_review_queue_items' as any,
    required,
    index,
    hasMany,
  } as any
}

export function operatorNotesRelationship({
  required = false,
  index = true,
  hasMany = false,
}: {
  required?: boolean
  index?: boolean
  hasMany?: boolean
} = {}) {
  return {
    name: 'operatorNotes',
    type: 'relationship',
    relationTo: 'payload_operator_notes' as any,
    required,
    index,
    hasMany,
  } as any
}

export function stripeShadowRelationship({
  required = false,
  index = true,
  hasMany = false,
}: {
  required?: boolean
  index?: boolean
  hasMany?: boolean
} = {}) {
  return {
    name: 'stripeShadow',
    type: 'relationship',
    relationTo: 'payload_stripe_shadow_projections' as any,
    required,
    index,
    hasMany,
  } as any
}

export function auditHistoryRelationship({
  required = false,
  index = true,
  hasMany = false,
}: {
  required?: boolean
  index?: boolean
  hasMany?: boolean
} = {}) {
  return {
    name: 'auditHistory',
    type: 'relationship',
    relationTo: 'payload_membership_audit_history' as any,
    required,
    index,
    hasMany,
  } as any
}
