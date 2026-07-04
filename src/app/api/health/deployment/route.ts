import { access } from 'node:fs/promises'

import { NextResponse } from 'next/server'

import { previewMigrationInventoryNames } from '@/lib/previewMigrationInventory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

async function readImportMapStatus() {
  try {
    const rootImportMap = await import('../../../(payload)/importMap.js') as { importMap?: unknown; default?: unknown }
    const adminImportMap = await import('../../../(payload)/admin/importMap.js') as { importMap?: unknown; default?: unknown }
    const rootMap = rootImportMap.importMap ?? rootImportMap.default
    const adminMap = adminImportMap.importMap ?? adminImportMap.default
    const adminKeys = adminMap && typeof adminMap === 'object' ? Object.keys(adminMap) : []

    return {
      rootImportMapExists: Boolean(rootMap),
      rootReexportsAdminImportMap: rootMap === adminMap,
      adminImportMapExists: Boolean(adminMap),
      adminHasBrandingKeys:
        adminKeys.includes('./components/payload/JPVAdminBranding#JPVAdminLogo') &&
        adminKeys.includes('./components/payload/JPVAdminBranding#JPVAdminIcon'),
    }
  } catch {
    return {
      rootImportMapExists: false,
      rootReexportsAdminImportMap: false,
      adminImportMapExists: false,
      adminHasBrandingKeys: false,
    }
  }
}

export async function GET() {
  const [importMap, publicLogoExists] = await Promise.all([
    readImportMapStatus(),
    fileExists('public/images/jpv-logo.png'),
  ])

  const resendApiKeyPresent = Boolean(readEnv('RESEND_API_KEY'))
  const senderIdentityPresent = Boolean(readEnv('RESEND_FROM') || readEnv('EMAIL_FROM'))
  const webhookEmailsDisabled = Boolean(
    readEnv('DISABLE_NON_WEBHOOK_EMAILS')?.toLowerCase() === 'true' ||
    readEnv('DISABLE_NON_WEBHOOK_EMAILS') === '1'
  )

  return NextResponse.json({
    ok: true,
    commitSha: readEnv('VERCEL_GIT_COMMIT_SHA') ?? readEnv('GITHUB_SHA') ?? null,
    imageTag: readEnv('IMAGE_TAG') ?? readEnv('GHCR_IMAGE_TAG') ?? null,
    branch: readEnv('VERCEL_GIT_COMMIT_REF') ?? readEnv('GITHUB_REF_NAME') ?? null,
    appVersion: process.env.npm_package_version ?? '1.0.6',
    nodeVersion: process.version,
    importMap: {
      ...importMap,
      publicLogoExists,
    },
    emailReadiness: {
      resendApiKeyPresent,
      senderIdentityPresent,
      webhookEmailsDisabled,
      readyForApply: resendApiKeyPresent && senderIdentityPresent && !webhookEmailsDisabled,
    },
    migrationInventoryNames: previewMigrationInventoryNames(),
    runtime: {
      startupMode: readEnv('STARTUP_MODE'),
      deploymentRuntime: readEnv('DEPLOYMENT_RUNTIME'),
    },
  })
}
