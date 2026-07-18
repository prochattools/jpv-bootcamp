/**
 * Provider readiness diagnostics: Stripe, Bunny, email configuration
 */

interface ProviderDiagnostic {
  provider: string
  isConfigured: boolean
  isTestMode: boolean
  hasPlaceholders: boolean
  missingSettings: string[]
  redactedConfig: Record<string, string>
}

interface ReadinessReport {
  timestamp: string
  providers: ProviderDiagnostic[]
  overallReady: boolean
}

function diagnoseStripe(): ProviderDiagnostic {
  return {
    provider: 'Stripe',
    isConfigured: !!process.env.STRIPE_SECRET_KEY,
    isTestMode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ?? false,
    hasPlaceholders: process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder',
    missingSettings: process.env.STRIPE_SECRET_KEY ? [] : ['STRIPE_SECRET_KEY'],
    redactedConfig: {
      apiVersion: '2024-04-10',
      mode: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ? 'test' : 'unknown'
    }
  }
}

function diagnoseBunny(): ProviderDiagnostic {
  return {
    provider: 'Bunny',
    isConfigured: !!process.env.BUNNY_API_KEY,
    isTestMode: !process.env.BUNNY_API_KEY?.includes('prod'),
    hasPlaceholders: process.env.BUNNY_API_KEY === 'bunny_test_placeholder',
    missingSettings: process.env.BUNNY_API_KEY ? [] : ['BUNNY_API_KEY'],
    redactedConfig: {
      library: 'configured',
      mode: 'test'
    }
  }
}

function diagnoseEmail(): ProviderDiagnostic {
  return {
    provider: 'Email',
    isConfigured: !!process.env.EMAIL_FROM,
    isTestMode: !process.env.EMAIL_FROM?.includes('@prod.'),
    hasPlaceholders: process.env.EMAIL_FROM === 'noreply@test.example.com',
    missingSettings: process.env.EMAIL_FROM ? [] : ['EMAIL_FROM'],
    redactedConfig: {
      sender: 'configured',
      domain: 'configured'
    }
  }
}

export async function main() {
  const report: ReadinessReport = {
    timestamp: new Date().toISOString(),
    providers: [diagnoseStripe(), diagnoseBunny(), diagnoseEmail()],
    overallReady: false
  }

  report.overallReady = report.providers.every((p: ProviderDiagnostic) => p.isConfigured && !p.hasPlaceholders)

  console.log(JSON.stringify(report, null, 2))
}

main()
