import { writeFileSync } from 'node:fs'

import {
  buildMigrationRehearsalEvidenceMarkdown,
  runMigrationRehearsal,
} from './migrationRehearsal'

function parseArg(name: string, argv: string[]): string | undefined {
  const prefix = `--${name}=`
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length)
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const outputPath = parseArg('output', argv)
  const result = await runMigrationRehearsal({
    mode: argv.includes('--execute') ? 'execute' : 'static',
    databaseUrl: parseArg('database-url', argv),
    confirmDisposableDb: parseArg('confirm-disposable-db', argv),
    log() {},
  })
  const markdown = buildMigrationRehearsalEvidenceMarkdown(result)
  if (outputPath) {
    writeFileSync(outputPath, markdown, 'utf8')
    return
  }
  process.stdout.write(markdown)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
