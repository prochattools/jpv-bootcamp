export type PreviewReadinessEnvironment = Record<string, string | undefined>

export type SafePresence = {
  present: boolean
}

export type SafeUrlPresence = SafePresence & {
  valid: boolean
  protocol?: 'http:' | 'https:'
  host?: string
}

export type PreviewReadinessReport = {
  checks: {
    databaseUrl: SafePresence & {
      validUrl: boolean
      explicitSchema: boolean
    }
    systemDatabaseUrl: SafePresence
    appSlug: SafePresence
    nodeEnv: SafePresence & {
      mode: 'development' | 'test' | 'production' | 'other' | 'missing'
    }
    payloadSecret: SafePresence
    resendApiKey: SafePresence
    senderIdentity: SafePresence
    replyToIdentity: SafePresence
    publicBaseUrl: SafeUrlPresence & {
      source?:
        | 'APP_PUBLIC_URL'
        | 'NEXT_PUBLIC_APP_URL'
        | 'PAYLOAD_SERVER_URL'
        | 'NEXT_PUBLIC_SERVER_URL'
        | 'APP_BASE_URL'
    }
    emailGate: SafePresence & {
      disabled: boolean
    }
  }
  providerMode: 'disabled' | 'dry-run-only' | 'apply-ready'
  startupMode: 'application-only' | 'database-deploy' | 'unknown'
  deploymentRuntime: 'docker' | 'nixpacks' | 'unknown'
  readyForApplicationOnlyPreview: boolean
  readyForEmailApply: boolean
  missing: string[]
  warnings: string[]
}

const PUBLIC_BASE_URL_NAMES = [
  'APP_PUBLIC_URL',
  'NEXT_PUBLIC_APP_URL',
  'PAYLOAD_SERVER_URL',
  'NEXT_PUBLIC_SERVER_URL',
  'APP_BASE_URL',
] as const

function clean(env: PreviewReadinessEnvironment, name: string): string | null {
  const value = env[name]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function present(env: PreviewReadinessEnvironment, name: string): boolean {
  return clean(env, name) !== null
}

function enabled(value: string | null): boolean {
  return value !== null && ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function summarizePublicUrl(
  env: PreviewReadinessEnvironment,
): PreviewReadinessReport['checks']['publicBaseUrl'] {
  for (const name of PUBLIC_BASE_URL_NAMES) {
    const raw = clean(env, name)
    if (!raw) continue

    try {
      const hasExplicitScheme = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(raw)
      if (hasExplicitScheme && !/^https?:\/\//i.test(raw)) {
        return { present: true, valid: false, source: name }
      }
      const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return { present: true, valid: false, source: name }
      }
      return {
        present: true,
        valid: true,
        source: name,
        protocol: url.protocol,
        host: url.hostname,
      }
    } catch {
      return { present: true, valid: false, source: name }
    }
  }

  return { present: false, valid: false }
}

function summarizeDatabaseUrl(
  env: PreviewReadinessEnvironment,
): PreviewReadinessReport['checks']['databaseUrl'] {
  const raw = clean(env, 'DATABASE_URL')
  if (!raw) return { present: false, validUrl: false, explicitSchema: false }

  try {
    const url = new URL(raw)
    return {
      present: true,
      validUrl:
        (url.protocol === 'postgresql:' || url.protocol === 'postgres:') &&
        Boolean(url.hostname),
      explicitSchema: Boolean(url.searchParams.get('schema')?.trim()),
    }
  } catch {
    return { present: true, validUrl: false, explicitSchema: false }
  }
}

function summarizeNodeEnv(
  env: PreviewReadinessEnvironment,
): PreviewReadinessReport['checks']['nodeEnv'] {
  const value = clean(env, 'NODE_ENV')
  if (!value) return { present: false, mode: 'missing' }
  if (value === 'development' || value === 'test' || value === 'production') {
    return { present: true, mode: value }
  }
  return { present: true, mode: 'other' }
}

function summarizeStartupMode(
  env: PreviewReadinessEnvironment,
): PreviewReadinessReport['startupMode'] {
  const value = clean(env, 'STARTUP_MODE')
  if (value === 'application-only' || value === 'database-deploy') return value
  return 'unknown'
}

function summarizeDeploymentRuntime(
  env: PreviewReadinessEnvironment,
): PreviewReadinessReport['deploymentRuntime'] {
  const value = clean(env, 'DEPLOYMENT_RUNTIME')?.toLowerCase()
  if (value === 'docker' || value === 'nixpacks') return value
  return 'unknown'
}

export function buildPreviewReadinessReport(
  env: PreviewReadinessEnvironment,
): PreviewReadinessReport {
  const databaseUrl = summarizeDatabaseUrl(env)
  const publicBaseUrl = summarizePublicUrl(env)
  const senderIdentity = present(env, 'RESEND_FROM') || present(env, 'EMAIL_FROM')
  const emailGateDisabled = enabled(clean(env, 'DISABLE_NON_WEBHOOK_EMAILS'))
  const resendApiKeyPresent = present(env, 'RESEND_API_KEY')
  const startupMode = summarizeStartupMode(env)
  const deploymentRuntime = summarizeDeploymentRuntime(env)

  const providerMode: PreviewReadinessReport['providerMode'] = emailGateDisabled
    ? 'disabled'
    : resendApiKeyPresent && senderIdentity
      ? 'apply-ready'
      : 'dry-run-only'

  const checks: PreviewReadinessReport['checks'] = {
    databaseUrl,
    systemDatabaseUrl: { present: present(env, 'SYSTEM_DATABASE_URL') },
    appSlug: { present: present(env, 'APP_SLUG') },
    nodeEnv: summarizeNodeEnv(env),
    payloadSecret: { present: present(env, 'PAYLOAD_SECRET') },
    resendApiKey: { present: resendApiKeyPresent },
    senderIdentity: { present: senderIdentity },
    replyToIdentity: { present: present(env, 'EMAIL_REPLY_TO') },
    publicBaseUrl,
    emailGate: {
      present: present(env, 'DISABLE_NON_WEBHOOK_EMAILS'),
      disabled: emailGateDisabled,
    },
  }

  const missing: string[] = []
  if (!databaseUrl.present) missing.push('DATABASE_URL')
  if (databaseUrl.present && !databaseUrl.validUrl) missing.push('DATABASE_URL_VALID_URL')
  if (databaseUrl.present && !databaseUrl.explicitSchema) missing.push('DATABASE_URL_EXPLICIT_SCHEMA')
  if (!checks.systemDatabaseUrl.present) missing.push('SYSTEM_DATABASE_URL')
  if (!checks.appSlug.present) missing.push('APP_SLUG')
  if (!checks.nodeEnv.present) missing.push('NODE_ENV')
  if (!checks.payloadSecret.present) missing.push('PAYLOAD_SECRET')
  if (!publicBaseUrl.present || !publicBaseUrl.valid) missing.push('PUBLIC_BASE_URL')
  if (startupMode === 'unknown') missing.push('STARTUP_MODE')
  if (deploymentRuntime === 'unknown') missing.push('DEPLOYMENT_RUNTIME')

  const warnings: string[] = []
  if (!checks.replyToIdentity.present) warnings.push('EMAIL_REPLY_TO_MISSING')
  if (!checks.emailGate.present) warnings.push('DISABLE_NON_WEBHOOK_EMAILS_UNDECLARED')
  if (!resendApiKeyPresent) warnings.push('RESEND_API_KEY_MISSING')
  if (!senderIdentity) warnings.push('SENDER_IDENTITY_MISSING')
  if (deploymentRuntime === 'nixpacks') warnings.push('NIXPACKS_PREVIEW_PATH_SELECTED')
  if (startupMode === 'database-deploy' && !present(env, 'DEPLOYMENT_ENV')) {
    warnings.push('DEPLOYMENT_ENV_MISSING')
  }

  const readyForApplicationOnlyPreview =
    missing.length === 0 && startupMode === 'application-only' && deploymentRuntime === 'docker'

  return {
    checks,
    providerMode,
    startupMode,
    deploymentRuntime,
    readyForApplicationOnlyPreview,
    readyForEmailApply: providerMode === 'apply-ready',
    missing,
    warnings,
  }
}
