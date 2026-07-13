import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export type BrowserCommandResult = {
  status: number | null
  signal?: NodeJS.Signals | null
}

export type BrowserCommandExecutor = (
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv,
) => BrowserCommandResult

export type BrowserRunOptions = {
  executor?: BrowserCommandExecutor
  log?: (message: string) => void
  environment?: NodeJS.ProcessEnv
}

function defaultExecutor(
  executable: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): BrowserCommandResult {
  const result = spawnSync(executable, args, {
    env,
    shell: false,
    stdio: 'inherit',
  })
  return { status: result.status, signal: result.signal }
}

export function runBrowserTests(options: BrowserRunOptions = {}): string {
  const executor = options.executor ?? defaultExecutor
  const log = options.log ?? console.log
  const environment = {
    ...process.env,
    ...options.environment,
    E2E_BASE_URL: options.environment?.E2E_BASE_URL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3107',
  }
  const command = ['exec', 'playwright', 'test', '--config=playwright.config.ts']
  const result = executor('pnpm', command, environment)

  if (result.status !== 0) {
    throw new Error(`BROWSER E2E FAILED: pnpm ${command.join(' ')} exited ${String(result.status)}`)
  }

  const summary = 'BROWSER E2E PASSED'
  log(summary)
  return summary
}

const invokedPath = process.argv[1]
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  try {
    runBrowserTests()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
