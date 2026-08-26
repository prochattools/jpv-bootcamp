import assert from 'node:assert/strict'

import { resolveProgrammeContentPath } from './content/programmeContentContract'

function main(): void {
  const validPath = resolveProgrammeContentPath('scripts/content/fixtures/programme-content.example.json')
  assert.match(validPath, /programme-content\.example\.json$/)

  assert.throws(() => resolveProgrammeContentPath('../secret.json'), /Path traversal/)
  assert.throws(() => resolveProgrammeContentPath('/tmp/outside.json'), /Absolute input paths are not allowed/)
  assert.throws(() => resolveProgrammeContentPath('.env'), /Environment files are not allowed|Only \.json programme content files are supported/)
  assert.throws(() => resolveProgrammeContentPath('docs/client/JPV_Bootcamp_Platform_Expansion_Go_Live_Plan_v3_6.docx'), /Only \.json programme content files are supported/)
  assert.throws(() => resolveProgrammeContentPath('README.md'), /Only \.json programme content files are supported/)

  console.log('programme_content_path_safety.test.ts passed')
}

try {
  main()
} catch (error) {
  console.error('programme_content_path_safety.test.ts failed', error instanceof Error ? error.message : error)
  process.exitCode = 1
}
