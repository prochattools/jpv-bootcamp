import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const directory = readFileSync('src/lib/payloadCourse/memberDirectory.ts', 'utf8')
const page = readFileSync('src/app/(frontend)/portal/members/page.tsx', 'utf8')

assert.match(
  directory,
  /findAll\(payloadClient, 'payload_members', \{ accountStatus: \{ equals: 'active' \} \}\)/,
  'the member directory must start from every active Payload member',
)
assert.match(
  directory,
  /findAll\(payloadClient, 'payload_member_profiles', undefined, 1\)/,
  'the member directory must enrich active members with profile data when available',
)
assert.match(directory, /fallbackDisplayName/, 'members without profiles must still receive a safe display name')
assert.doesNotMatch(directory, /!item\.isAdministrator/, 'administrator-linked members must remain visible in the directory')
assert.match(directory, /member\.accountStatus !== 'active'/, 'profile pages must only expose active members')
assert.match(page, /listActiveMembers\(payload\)/, 'the page must use the shared Payload client')
assert.match(page, /const \[members, activity, adminGroups, groupCandidates\] = await Promise\.all\(/, 'independent member page queries must run in parallel')
assert.match(page, /\{members\.length\} active member/, 'the visible count must match the rendered directory')

console.log('portal_member_directory.test.ts passed')
