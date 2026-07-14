import { writeFileSync } from 'node:fs'
import path from 'node:path'

import {
  REPOSITORY_ROOT,
  buildProgrammeAcceptanceReportMarkdown,
  loadAndValidateProgrammeContent,
} from './programmeContentContract'

function parseArgs(): { inputPath: string | null; outPath: string | null } {
  const args = process.argv.slice(2)
  let inputPath: string | null = null
  let outPath: string | null = null

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    if (value === '--') {
      continue
    }
    if (value === '--out') {
      outPath = args[index + 1] ?? null
      index += 1
      continue
    }
    if (!inputPath) inputPath = value
  }

  return { inputPath, outPath }
}

function main(): void {
  const { inputPath, outPath } = parseArgs()
  if (!inputPath) {
    console.error('Usage: pnpm content:programme:acceptance -- <repository-relative-json-path> [--out <repository-relative-md-path>]')
    process.exitCode = 1
    return
  }

  try {
    const result = loadAndValidateProgrammeContent(inputPath)
    const markdown = buildProgrammeAcceptanceReportMarkdown(result)
    if (outPath) {
      const normalized = outPath.trim().replace(/\\/g, '/')
      if (!normalized.endsWith('.md')) {
        throw new Error('Acceptance report output path must end in .md')
      }
      if (path.isAbsolute(normalized) || normalized.startsWith('../') || normalized.includes('/../') || normalized.startsWith('.env')) {
        throw new Error('Acceptance report output path must be repository-relative and remain inside the repository.')
      }
      const resolvedOutPath = path.resolve(REPOSITORY_ROOT, normalized)
      if (!resolvedOutPath.startsWith(REPOSITORY_ROOT + path.sep) && resolvedOutPath !== REPOSITORY_ROOT) {
        throw new Error('Acceptance report output path escapes the repository root.')
      }
      writeFileSync(resolvedOutPath, markdown)
      console.log(`Wrote acceptance report to ${resolvedOutPath}`)
      return
    }
    process.stdout.write(`${markdown}\n`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

main()
