import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const payloadConfig = readFileSync('src/payload.config.ts', 'utf8')
const dashboard = readFileSync('src/components/payload/JPVAdminDashboard.tsx', 'utf8')
const partners = readFileSync('src/collections/partners/Partners.ts', 'utf8')
const affiliates = readFileSync('src/collections/affiliates/Affiliates.ts', 'utf8')

assert.match(payloadConfig, /views:\s*\{/)
assert.match(payloadConfig, /dashboard:\s*\{/)
assert.match(payloadConfig, /JPVAdminDashboard#JPVAdminDashboard/)
assert.doesNotMatch(payloadConfig, /beforeLogin:\s*\[/)

// KPI labels present in new focused dashboard
for (const label of [
  'Active members',
  'Pending members',
  'Active subscriptions',
  'Billing issues',
  'Community moderation',
  'Partner applications to review',
  'Affiliate commissions to review',
  'Voucher approvals',
  'Pay-it-forward approvals',
  'Operations',
  'Needs attention',
  'Quick actions',
]) {
  assert.match(dashboard, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

// Removed developer-centric content must not appear
for (const removed of [
  'Deployment / schema health',
  'Upcoming course / live call',
  'Membership Support cockpit',
  'Displayed fields',
  'Statuses and actions',
  'Reconciliation mismatches',
  'Recent system errors',
]) {
  assert.doesNotMatch(dashboard, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

for (const forbidden of [
  /stripe\./i,
  /resend/i,
  /fetch\(/i,
  /process\.env\.(?:DATABASE_URL|STRIPE|RESEND|N8N|MYSQL|SECRET|TOKEN)/,
  /sk_live|whsec_|postgresql:\/\//i,
]) {
  assert.doesNotMatch(dashboard, forbidden)
}

assert.match(dashboard, /safeCount/)
assert.match(dashboard, /catch\s*\{/)
assert.match(partners, /External partner organizations and destinations/)
assert.match(partners, /recipient emails/)
assert.match(partners, /webhook rules/)
assert.match(affiliates, /Internal referral programme records/)
assert.match(affiliates, /commission programme/)
console.log('payload_admin_dashboard.test.ts passed')
