import { access, readFile } from 'node:fs/promises'

import { NextResponse } from 'next/server'

import { previewMigrationInventoryNames } from '@/lib/previewMigrationInventory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function fileContains(path: string, pattern: RegExp): Promise<boolean> {
  try {
    const source = await readFile(path, 'utf8')
    return pattern.test(source)
  } catch {
    return false
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim()
  return value ? value : null
}

export async function GET() {
  const rootImportMapPath = 'src/app/(payload)/importMap.js'
  const adminImportMapPath = 'src/app/(payload)/admin/importMap.js'

  const [
    rootImportMapExists,
    rootReexportsAdminImportMap,
    adminImportMapExists,
    adminHasBrandingKeys,
    publicLogoExists,
  ] = await Promise.all([
    fileContains(rootImportMapPath, /export \{ importMap \} from '\.\/admin\/importMap\.js'/),
    fileContains(rootImportMapPath, /export \{ importMap as default \} from '\.\/admin\/importMap\.js'/),
    fileContains(adminImportMapPath, /JPVAdminLogo/),
    fileContains(adminImportMapPath, /JPVAdminIcon/),
    fileExists('public/images/jpv-logo.png'),
  ])

  return NextResponse.json({
    ok: true,
    commitSha: readEnv('VERCEL_GIT_COMMIT_SHA') ?? readEnv('GITHUB_SHA') ?? null,
    imageTag: readEnv('IMAGE_TAG') ?? readEnv('GHCR_IMAGE_TAG') ?? null,
    branch: readEnv('VERCEL_GIT_COMMIT_REF') ?? readEnv('GITHUB_REF_NAME') ?? null,
    appVersion: process.env.npm_package_version ?? '1.0.6',
    nodeVersion: process.version,
    importMap: {
      rootImportMapExists,
      rootReexportsAdminImportMap,
      adminImportMapExists,
      adminHasBrandingKeys,
      publicLogoExists,
    },
    migrationInventoryNames: previewMigrationInventoryNames(),
    runtime: {
      startupMode: readEnv('STARTUP_MODE'),
      deploymentRuntime: readEnv('DEPLOYMENT_RUNTIME'),
    },
  })
}
