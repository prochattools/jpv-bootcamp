import { isImmutableImageReference } from './previewReleasePolicy'
import { validatePreviewReleasePreflight, type PreviewReleasePreflightInput } from './previewReleasePreflight'

export type SmokeCheckRisk = {
  networkRequired: boolean
  authenticationRequired: boolean
  mutationPossible: boolean
  databaseReadPossible: boolean
  databaseWritePossible: boolean
  providerCallPossible: boolean
  authorizationCategoryRequired: 'smokeVerification' | 'providerDryRun' | 'providerApply'
}

export type SmokeCheckPlan = {
  key: string
  description: string
  risk: SmokeCheckRisk
}

export const PREVIEW_SMOKE_CHECKS: SmokeCheckPlan[] = [
  {
    key: 'root-page',
    description: 'Public root page availability',
    risk: {
      networkRequired: true,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: false,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
  },
  {
    key: 'login-page',
    description: 'Login page availability',
    risk: {
      networkRequired: true,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: false,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
  },
  {
    key: 'invalid-token-pages',
    description: 'Generic invalid-token rendering for account-action pages',
    risk: {
      networkRequired: true,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: false,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
  },
  {
    key: 'resend-verification',
    description: 'Resend verification request with approved test member',
    risk: {
      networkRequired: true,
      authenticationRequired: false,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: true,
      providerCallPossible: false,
      authorizationCategoryRequired: 'smokeVerification',
    },
  },
  {
    key: 'provider-dry-run',
    description: 'Queued provider dry-run plan',
    risk: {
      networkRequired: false,
      authenticationRequired: false,
      mutationPossible: false,
      databaseReadPossible: true,
      databaseWritePossible: false,
      providerCallPossible: false,
      authorizationCategoryRequired: 'providerDryRun',
    },
  },
  {
    key: 'provider-apply',
    description: 'Provider apply delivery plan',
    risk: {
      networkRequired: true,
      authenticationRequired: false,
      mutationPossible: true,
      databaseReadPossible: true,
      databaseWritePossible: true,
      providerCallPossible: true,
      authorizationCategoryRequired: 'providerApply',
    },
  },
]

export type SmokePlanInput = {
  execute?: boolean
  target?: string
  authorization?: PreviewReleasePreflightInput
  imageReference?: string
}

export type SmokePlanResult = {
  executable: boolean
  errors: string[]
  checks: SmokeCheckPlan[]
}

function validHttpsTarget(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && Boolean(url.hostname)
  } catch {
    return false
  }
}

export function buildPreviewSmokePlan(input: SmokePlanInput = {}): SmokePlanResult {
  const errors: string[] = []
  if (!input.execute) {
    return { executable: false, errors: ['execute_flag_required'], checks: PREVIEW_SMOKE_CHECKS }
  }
  if (!validHttpsTarget(input.target)) errors.push('exact_https_target_required')
  if (input.imageReference && !isImmutableImageReference(input.imageReference)) {
    errors.push('immutable_image_required')
  }
  const preflight = validatePreviewReleasePreflight(input.authorization ?? {})
  if (!preflight.smokeVerification.ok || !preflight.smokeVerification.authorized) {
    errors.push('smoke_authorization_required')
  }
  return { executable: errors.length === 0, errors, checks: PREVIEW_SMOKE_CHECKS }
}
