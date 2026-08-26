import { readFileSync } from 'node:fs'

import {
  buildPreviewSmokePlan,
  PREVIEW_SMOKE_CHECKS,
  validatePreviewSmokeEvidence,
} from '../../src/lib/previewSmokePlan'
import type { PreviewReleasePreflightInput } from '../../src/lib/previewReleasePreflight'

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function authorization(): PreviewReleasePreflightInput | undefined {
  const file = arg('authorization-file')
  if (!file) return undefined
  return JSON.parse(readFileSync(file, 'utf8')) as PreviewReleasePreflightInput
}

const mode = arg('mode') ?? 'plan'

if (mode === 'print-plan') {
  console.log(JSON.stringify({ checks: PREVIEW_SMOKE_CHECKS }, null, 2))
  process.exitCode = 0
} else if (mode === 'validate-plan') {
  const plan = buildPreviewSmokePlan({
    execute: true,
    target: 'https://preview.example.test',
    imageReference: arg('image-reference'),
    authorization: authorization(),
  })
  console.log(JSON.stringify(plan, null, 2))
  process.exitCode = plan.executable ? 0 : 1
} else if (mode === 'validate-evidence') {
  const evidenceFile = arg('evidence-file')
  if (!evidenceFile) {
    console.log(JSON.stringify({ ok: false, errors: ['evidence_file_required'] }, null, 2))
    process.exitCode = 1
  } else {
    const evidence = JSON.parse(readFileSync(evidenceFile, 'utf8')) as Parameters<typeof validatePreviewSmokeEvidence>[0]
    const result = validatePreviewSmokeEvidence(evidence)
    console.log(JSON.stringify(result, null, 2))
    process.exitCode = result.ok ? 0 : 1
  }
} else {
  const plan = buildPreviewSmokePlan({
    execute: process.argv.includes('--execute'),
    target: arg('target'),
    imageReference: arg('image-reference'),
    authorization: authorization(),
  })

  console.log(JSON.stringify(plan, null, 2))

  if (!plan.executable) {
    process.exitCode = process.argv.includes('--execute') ? 1 : 0
  }
}
