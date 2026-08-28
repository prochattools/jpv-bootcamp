import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { ENVIRONMENT_TOPOLOGY } from '../../src/lib/environmentTopology'

/**
 * Staging Smoke Test Runner
 * Executes comprehensive flow testing against staging environment
 * Generates structured results and evidence artifacts
 */

export interface StagingSmokeTestOptions {
  stagingUrl?: string
  desktopOnly?: boolean
  mobileOnly?: boolean
  timeout?: number
  debug?: boolean
  outputDir?: string
}

export interface StagingSmokeTestResult {
  success: boolean
  url: string
  timestamp: string
  duration: number
  testsPassed: number
  testsFailed: number
  testsSkipped: number
  reportPath: string
  evidencePath: string
  artifacts: string[]
  summary: string
}

function ensureDirectory(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

export async function runStagingSmokeTest(
  options: StagingSmokeTestOptions = {},
): Promise<StagingSmokeTestResult> {
  const startTime = Date.now()
  const stagingUrl = options.stagingUrl ?? ENVIRONMENT_TOPOLOGY.staging.origin
  const outputDir = options.outputDir ?? './test-results/staging-smoke'
  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5) // Remove milliseconds and Z

  ensureDirectory(outputDir)
  ensureDirectory('./playwright-report-staging')

  const results: StagingSmokeTestResult = {
    success: false,
    url: stagingUrl,
    timestamp: now.toISOString(),
    duration: 0,
    testsPassed: 0,
    testsFailed: 0,
    testsSkipped: 0,
    reportPath: path.join(outputDir, `report-${timestamp}.html`),
    evidencePath: path.join(outputDir, `evidence-${timestamp}`),
    artifacts: [],
    summary: '',
  }

  try {
    // Build Playwright command
    const args = [
      'exec',
      'playwright',
      'test',
      '--config=playwright-staging.config.ts',
    ]

    // Filter projects if requested
    if (options.desktopOnly) {
      args.push('--project=chromium-desktop')
    } else if (options.mobileOnly) {
      args.push('--project=chromium-mobile')
    }

    // Add verbosity for debug
    if (options.debug) {
      args.push('--debug')
      process.env.DEBUG = 'pw:api'
    }

    // Set environment variables
    const env = {
      ...process.env,
      STAGING_URL: stagingUrl,
      CI: 'false',
    }

    console.log(`\n${'='.repeat(70)}`)
    console.log('STAGING SMOKE TEST EXECUTION')
    console.log(`${'='.repeat(70)}`)
    console.log(`Target: ${stagingUrl}`)
    console.log(`Schema: jpvbootcamp_staging`)
    console.log(`Timestamp: ${now.toISOString()}`)
    console.log(`Output: ${outputDir}`)
    console.log(`${'='.repeat(70)}\n`)

    // Run Playwright tests
    const result = spawnSync('pnpm', args, {
      env,
      stdio: 'inherit',
      timeout: (options.timeout ?? 300) * 1000, // Default 5 minutes
    })

    const duration = Date.now() - startTime
    results.duration = duration

    if (result.status !== 0) {
      results.summary = `FAILED: Tests exited with code ${result.status}`
      throw new Error(results.summary)
    }

    results.success = true
    results.summary = 'PASSED: All smoke tests completed successfully'
  } catch (error) {
    results.success = false
    results.summary = error instanceof Error ? error.message : 'Unknown error'
  }

  // Generate evidence summary
  const evidenceSummary = {
    ...results,
    timestamp: now.toISOString(),
    duration: `${(results.duration / 1000).toFixed(2)}s`,
    flows_tested: [
      'PUBLIC: Landing, legal pages, login portal, 404, sitemap',
      'BILLING: Monthly checkout, annual checkout, invalid parameters',
      'SUPPORT: Form intake accessibility',
      'MEMBER: Portal accessibility checks',
      'ACCESSIBILITY: Keyboard navigation, screen reader support',
      'MOBILE: Responsive design (375x667)',
      'PERFORMANCE: Page load time, API response time',
      'ERROR_HANDLING: Console error monitoring',
      'SCHEMA: Staging environment verification',
    ],
    schema_used: 'jpvbootcamp_staging',
    browsers_tested: options.desktopOnly ? ['Desktop Chrome 1440x900'] : options.mobileOnly ? ['Mobile Pixel 7'] : ['Desktop Chrome 1440x900', 'Mobile Pixel 7'],
    accessibility_checks: [
      'Keyboard navigation (Tab)',
      'Screen reader text (alt attributes, aria-labels)',
      'Semantic HTML (headings)',
      'Form field associations',
      'Mobile touch target sizes (44px minimum)',
    ],
  }

  writeFileSync(path.join(outputDir, `evidence-${timestamp}.json`), JSON.stringify(evidenceSummary, null, 2))
  results.artifacts.push(path.join(outputDir, `evidence-${timestamp}.json`))

  // Generate summary report
  const report = `
# STAGING SMOKE TEST REPORT

**Execution Time:** ${now.toISOString()}
**Duration:** ${(results.duration / 1000).toFixed(2)}s
**Status:** ${results.success ? '✅ PASSED' : '❌ FAILED'}

## Environment
- **URL:** ${stagingUrl}
- **Schema:** jpvbootcamp_staging
- **Browsers:** ${evidenceSummary.browsers_tested.join(', ')}

## Test Coverage
### Flows Tested
${evidenceSummary.flows_tested.map(f => `- ${f}`).join('\n')}

### Accessibility Checks
${evidenceSummary.accessibility_checks.map(a => `- ${a}`).join('\n')}

## Summary
${results.summary}

## Evidence Artifacts
${results.artifacts.map(a => `- \`${a}\``).join('\n')}

## Next Steps
1. Review playwright-report-staging/index.html for detailed test results
2. Check evidence-${timestamp}.json for structured results
3. Review screenshots in test-results/staging-smoke/ directory for visual validation
4. For failures, check test-results/staging-smoke/ for videos and traces

## Manual Verification Checklist
- [ ] Landing page loads with correct branding (Free/Pro pricing visible)
- [ ] Legal pages (privacy, terms) accessible and not using legacy content
- [ ] Portal login accessible without admin state leakage
- [ ] 404 page safe and non-revealing
- [ ] Checkout endpoints functional for monthly and annual plans
- [ ] Keyboard navigation works on all interactive elements
- [ ] Screen reader-friendly markup present (alt text, aria-labels)
- [ ] Mobile layout responsive and touch targets adequate (44px+)
- [ ] No horizontal scroll on mobile (375px)
- [ ] Performance acceptable: landing < 10s, APIs < 5s
- [ ] No unhandled JavaScript errors in console
- [ ] Support form accessible and functional
- [ ] All links resolve (no 404s on critical paths)

---
Generated: ${new Date().toISOString()}
`.trim()

  const reportPath = path.join(outputDir, `report-${timestamp}.md`)
  writeFileSync(reportPath, report)
  results.artifacts.push(reportPath)

  return results
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2)
  const options: StagingSmokeTestOptions = {
    stagingUrl: args.find(a => a.startsWith('--url='))?.split('=')[1] ?? ENVIRONMENT_TOPOLOGY.staging.origin,
    desktopOnly: args.includes('--desktop-only'),
    mobileOnly: args.includes('--mobile-only'),
    debug: args.includes('--debug'),
    timeout: parseInt(args.find(a => a.startsWith('--timeout='))?.split('=')[1] ?? '300'),
  }

  runStagingSmokeTest(options)
    .then(result => {
      console.log(`\n${'='.repeat(70)}`)
      console.log('STAGING SMOKE TEST COMPLETE')
      console.log(`${'='.repeat(70)}`)
      console.log(`Status: ${result.summary}`)
      console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`)
      console.log(`\nArtifacts:`)
      result.artifacts.forEach(a => console.log(`  - ${a}`))
      console.log(`${'='.repeat(70)}\n`)

      process.exitCode = result.success ? 0 : 1
    })
    .catch(error => {
      console.error('Test runner error:', error)
      process.exitCode = 1
    })
}

export default runStagingSmokeTest
