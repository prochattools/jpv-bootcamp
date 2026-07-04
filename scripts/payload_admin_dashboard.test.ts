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

for (const label of [
  'Active members',
  'Pending / unverified members',
  'Active subscriptions',
  'Recent billing / webhook issues',
  'Recent system errors / security events',
  'Pending partner applications',
  'Pending affiliate / commission items',
  'Community moderation / recent posts',
  'Deployment / schema health',
  'Upcoming course / live call',
]) {
  assert.match(dashboard, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

for (const forbidden of [
  /stripe\./i,
  /resend/i,
  /fetch\(/i,
  /process\.env\.(?:DATABASE_URL|STRIPE|RESEND|N8N|WP|MYSQL|SECRET|TOKEN)/,
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
