import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { reconcilePayloadEntitlements } from '../../src/lib/payloadCourse/reconcileEntitlements'

function argValue(name: string) {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : null
}

function numberArg(name: string, fallback: number) {
  const raw = argValue(name)
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

async function main() {
  const payload = await getPayload({ config })
  const report = await reconcilePayloadEntitlements(payload, {
    memberLimit: numberArg('member-limit', 100),
    resourceLimit: numberArg('resource-limit', 100),
  })

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2))
    return
  }

  console.log('[reconcile:dry-run] Payload course entitlement reconciliation')
  console.log(`[reconcile:dry-run] Members: ${report.totals.members}`)
  console.log(`[reconcile:dry-run] Courses: ${report.totals.courses}`)
  console.log(`[reconcile:dry-run] Policies: ${report.totals.policies}`)
  console.log(`[reconcile:dry-run] Subscriptions: ${report.totals.subscriptions}`)
  console.log(`[reconcile:dry-run] Active grants: ${report.totals.activeGrants}`)
  console.log(`[reconcile:dry-run] Published lesson resources: ${report.totals.lessonResources}`)
  console.log(`[reconcile:dry-run] Decisions evaluated: ${report.totals.decisions}`)
  console.log(`[reconcile:dry-run] Issues: ${report.totals.issues}`)

  for (const issue of report.issues) {
    console.log(
      `[reconcile:dry-run] ${issue.severity.toUpperCase()} ${issue.code}: ${issue.detail}`
    )
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('[reconcile:dry-run] Failed to reconcile Payload entitlements', error)
    process.exit(1)
  })
