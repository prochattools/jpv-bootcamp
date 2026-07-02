import { readFileSync } from 'node:fs'

import { buildPreviewSmokePlan } from '../../src/lib/previewSmokePlan'
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
