import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

const authNotice = read('src/components/auth/AuthFlowNotice.tsx')
assert.match(authNotice, /role=\{isError \? 'alert' : 'status'\}/)
assert.match(authNotice, /aria-live=\{isError \? 'assertive' : 'polite'\}/)

const passwordForms = read('src/components/member/PasswordWorkflowForms.tsx')
assert.match(passwordForms, /AuthFlowNotice/)
assert.match(passwordForms, /Back to sign in/)
assert.match(passwordForms, /Password could not be updated/)

const verificationForm = read('src/components/auth/MemberVerificationResendForm.tsx')
assert.match(verificationForm, /If an eligible account exists/)
assert.match(verificationForm, /Request received/)

const liveState = read('src/components/portal/LiveSessionState.tsx')
for (const expected of ['Live now', 'Scheduled', 'Ended', 'Cancelled', 'Unavailable']) {
  assert.ok(liveState.includes(expected), `missing live-session state: ${expected}`)
}
assert.match(liveState, /motion-reduce:animate-none/)

const liveRoutes = [
  'src/app/(frontend)/portal/live-sessions/page.tsx',
  'src/app/(frontend)/portal/community/[spaceSlug]/calls/page.tsx',
  'src/app/(frontend)/portal/community/[spaceSlug]/calls/[sessionId]/page.tsx',
]
for (const route of liveRoutes) {
  assert.match(read(route), /LiveSessionState/)
}

const responsiveTable = read('src/components/operations/ResponsiveDataTable.tsx')
assert.match(responsiveTable, /role='region'/)
assert.match(responsiveTable, /tabIndex=\{0\}/)
assert.match(responsiveTable, /Scroll horizontally to view all columns/)

const tableRoutes = [
  'src/app/(frontend)/admin/review/page.tsx',
  'src/app/(frontend)/admin/review/[sectionSlug]/page.tsx',
  'src/app/(frontend)/operations/partner-applications/page.tsx',
  'src/app/(frontend)/operations/partners-clicks/page.tsx',
]
for (const route of tableRoutes) {
  assert.match(read(route), /ResponsiveDataTable/)
}

for (const path of [
  'src/components/public/PublicInformationShell.tsx',
  'src/app/(frontend)/loading.tsx',
  'src/app/(frontend)/error.tsx',
]) {
  assert.match(read(path), /min-h-\[100dvh\]/)
}

const scopeDocument = read('docs/design/JPV_NONOVERLAPPING_UX_FOUNDATION.md')
assert.match(scopeDocument, /Explicitly deferred: Claude Code-owned work/)
assert.match(scopeDocument, /portal\/courses\/\*\*/)
assert.match(scopeDocument, /PortalTopBar/)
assert.match(scopeDocument, /not committed, pushed, merged, or deployed/)

console.log('non-overlapping UX foundation: all contracts passed')
