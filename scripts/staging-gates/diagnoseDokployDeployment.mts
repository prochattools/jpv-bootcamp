/**
 * Diagnostic: query Dokploy application config and recent deployment status.
 * Run after a failed deploy to understand why the container didn't update.
 *
 * Logs: application sourceType, current dockerImage, registryId, and
 * the last N deployments with status/error messages (credentials suppressed).
 */

import { STAGING_DOKPLOY_APPLICATION_ID } from './dokployMediaMount'

const apiKey = process.env.DOKPLOY_API_KEY?.trim() ?? ''
const apiBase = (process.env.DOKPLOY_API_BASE_URL?.trim() || 'https://dokploy.prochat.tools/api').replace(/\/$/, '')

if (!apiKey) throw new Error('DIAGNOSE-DENIED: DOKPLOY_API_KEY is required')

async function dokployRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      ...(init?.headers ?? {}),
    },
    redirect: 'error',
  })

  const text = await response.text()
  if (!text.trim()) return {}

  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text.slice(0, 500) }
  }
}

// Query application config
const appQuery = new URLSearchParams({ applicationId: STAGING_DOKPLOY_APPLICATION_ID })
const app = await dokployRequest(`/application.one?${appQuery.toString()}`)

type UnknownRecord = Record<string, unknown>
function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

if (isRecord(app)) {
  console.log(JSON.stringify({
    ok: true,
    step: 'application_config',
    applicationId: STAGING_DOKPLOY_APPLICATION_ID,
    sourceType: app.sourceType,
    dockerImage: app.dockerImage,
    registryId: app.registryId,
    buildType: app.buildType,
    applicationStatus: app.applicationStatus,
  }))
} else {
  console.log(JSON.stringify({ ok: false, step: 'application_config', response: app }))
}

// Query recent deployments
const deplQuery = new URLSearchParams({ applicationId: STAGING_DOKPLOY_APPLICATION_ID })
const depls = await dokployRequest(`/deployment.all?${deplQuery.toString()}`)

type DeployRecord = {
  deploymentId?: unknown
  status?: unknown
  title?: unknown
  errorMessage?: unknown
  createdAt?: unknown
}

function isDeployRecord(v: unknown): v is DeployRecord {
  return isRecord(v)
}

const deplList = Array.isArray(depls) ? depls : (isRecord(depls) && Array.isArray(depls.items) ? depls.items : [])
const recentDepls = deplList.slice(0, 5).map((d: unknown) => {
  if (!isDeployRecord(d)) return { _raw: String(d).slice(0, 100) }
  return {
    deploymentId: d.deploymentId,
    status: d.status,
    title: d.title,
    createdAt: d.createdAt,
    errorMessage: typeof d.errorMessage === 'string'
      ? d.errorMessage.slice(0, 300)
      : d.errorMessage,
  }
})

console.log(JSON.stringify({ ok: true, step: 'recent_deployments', count: deplList.length, recent: recentDepls }))
