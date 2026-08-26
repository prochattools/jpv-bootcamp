import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const payloadConfig = readFileSync('src/payload.config.ts', 'utf8')
const dashboard = readFileSync('src/components/payload/JPVAdminDashboard.tsx', 'utf8')
const adminStyles = readFileSync('src/app/(payload)/jpv-admin.scss', 'utf8')
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
assert.doesNotMatch(dashboard, /--jpv-green/, 'Dashboard must not reference undefined JPV color tokens')
assert.match(
  adminStyles,
  /\.main-content,[\s\S]*max-width:\s*1280px;[\s\S]*margin-inline:\s*auto;/,
  'Constrained Payload admin views must remain centered with responsive gutters',
)
assert.match(
  dashboard,
  /maxWidth:\s*1360[\s\S]*padding:\s*'clamp\(1\.25rem, 3vw, 2\.5rem\)'[\s\S]*width:\s*'100%'/,
  'Dashboard must retain a constrained responsive premium shell',
)
assert.match(
  dashboard,
  /gridTemplateColumns:\s*'repeat\(auto-fit, minmax\(min\(100%, 190px\), 1fr\)\)'/,
  'KPI cards must retain a safe responsive minimum width',
)
assert.match(
  dashboard,
  /overflowWrap:\s*'anywhere'/,
  'Long KPI values must wrap instead of clipping',
)
assert.match(
  adminStyles,
  /html\[data-theme='dark'\][\s\S]*--theme-bg:\s*var\(--jpv-surface\)[\s\S]*--theme-text:\s*var\(--jpv-ink\)/,
  'Payload dark mode must retain the neutral readable application shell',
)
assert.doesNotMatch(
  adminStyles,
  /html\[data-theme='dark'\][\s\S]*--theme-bg:\s*var\(--jpv-brand-deep\)/,
  'Payload dark mode must not turn the full application canvas brand green',
)
assert.match(
  adminStyles,
  /a\[aria-current='page'\][\s\S]*background:\s*var\(--jpv-brand-deep\)[\s\S]*color:\s*var\(--jpv-canvas\)/,
  'Selected Payload navigation must retain a contrasting active state',
)
assert.match(
  adminStyles,
  /\.login label,[\s\S]*label\s*\{[\s\S]*color:\s*var\(--jpv-ink\)/,
  'Payload login and account labels must remain readable',
)
assert.match(
  adminStyles,
  /\.login a,[\s\S]*color:\s*var\(--jpv-brand-deep\)/,
  'Payload login links must retain readable contrast',
)
assert.match(partners, /External partner organizations and destinations/)
assert.match(partners, /recipient emails/)
assert.match(partners, /webhook rules/)
assert.match(affiliates, /Internal referral programme records/)
assert.match(affiliates, /commission programme/)
console.log('payload_admin_dashboard.test.ts passed')
