export const membershipSupportGroup = 'Support'

export const fundingSourceOptions = [
  { label: 'Direct payment', value: 'direct_payment' },
  { label: 'Voucher', value: 'voucher' },
  { label: 'Pay it forward', value: 'pay_it_forward' },
]

export const voucherDurationOptions = [
  { label: 'One month', value: 'one_month' },
  { label: 'One year', value: 'one_year' },
]

export const issuanceStateOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Approved', value: 'approved' },
  { label: 'Issued', value: 'issued' },
  { label: 'Redeemed', value: 'redeemed' },
  { label: 'Deactivated', value: 'deactivated' },
  { label: 'Expired', value: 'expired' },
  { label: 'Failed', value: 'failed' },
]

export const reconciliationStateOptions = [
  { label: 'Pending', value: 'pending' },
  { label: 'Matched', value: 'matched' },
  { label: 'Mismatch', value: 'mismatch' },
  { label: 'Failed', value: 'failed' },
]

export const approvalStateOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Pending approval', value: 'pending_approval' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Issued', value: 'issued' },
  { label: 'Revoked', value: 'revoked' },
  { label: 'Failed', value: 'failed' },
]

export const queueStateOptions = [
  { label: 'Needs review', value: 'needs_review' },
  { label: 'In review', value: 'in_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Closed', value: 'closed' },
]

export const queueReasonOptions = [
  { label: 'Approval required', value: 'approval_required' },
  { label: 'Customer restriction', value: 'customer_restriction' },
  { label: 'Expiry check', value: 'expiry_check' },
  { label: 'Idempotency conflict', value: 'idempotency_conflict' },
  { label: 'Webhook mismatch', value: 'webhook_mismatch' },
  { label: 'Manual override', value: 'manual_override' },
]

export const operatorActionOptions = [
  { label: 'Create voucher', value: 'create_voucher' },
  { label: 'Approve voucher', value: 'approve_voucher' },
  { label: 'Issue voucher', value: 'issue_voucher' },
  { label: 'Deactivate voucher', value: 'deactivate_voucher' },
  { label: 'Expire voucher', value: 'expire_voucher' },
  { label: 'Assign funding', value: 'assign_funding' },
  { label: 'Approve funding', value: 'approve_funding' },
  { label: 'Reconcile shadow', value: 'reconcile_shadow' },
  { label: 'Review failure', value: 'review_failure' },
  { label: 'Record note', value: 'record_note' },
]

export const operatorActionStateOptions = [
  { label: 'Pending', value: 'pending' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Skipped', value: 'skipped' },
]

export const noteTargetTypeOptions = [
  { label: 'Membership support', value: 'membership_support' },
  { label: 'Voucher', value: 'voucher' },
  { label: 'Funding source', value: 'funding_source' },
  { label: 'Reconciliation', value: 'reconciliation' },
  { label: 'Review queue', value: 'review_queue' },
  { label: 'Administration action', value: 'administration_action' },
  { label: 'Stripe shadow', value: 'stripe_shadow' },
  { label: 'Audit history', value: 'audit_history' },
]

export const noteVisibilityOptions = [
  { label: 'Private', value: 'private' },
  { label: 'Internal', value: 'internal' },
]

export const shadowStateOptions = [
  { label: 'Pending', value: 'pending' },
  { label: 'Matched', value: 'matched' },
  { label: 'Mismatch', value: 'mismatch' },
  { label: 'Failed', value: 'failed' },
]

export const auditSeverityOptions = [
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warning' },
  { label: 'Critical', value: 'critical' },
]
