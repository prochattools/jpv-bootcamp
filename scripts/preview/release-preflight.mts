import { readFileSync } from 'node:fs'

import {
  validatePreviewReleasePreflight,
  type PreviewReleasePreflightInput,
} from '../../src/lib/previewReleasePreflight'

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

function readInput(): PreviewReleasePreflightInput {
  const file = arg('authorization-file')
  if (!file) return {}
  return JSON.parse(readFileSync(file, 'utf8')) as PreviewReleasePreflightInput
}

try {
  const result = validatePreviewReleasePreflight(readInput())
  console.log(JSON.stringify(result, null, 2))
  if (Object.values(result).some((category) => category.authorized && !category.ok)) {
    process.exitCode = 1
  }
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
