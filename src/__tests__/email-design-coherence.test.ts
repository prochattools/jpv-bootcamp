import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')

function read(path: string): string {
  return readFileSync(resolve(root, path), 'utf8')
}

const renderer = read('src/lib/communications/brandedEmail.ts')
const templates = read('src/lib/payloadCourse/systemEmailTemplates.ts')
const sender = read('src/lib/payloadCourse/emailSender.ts')

const prohibited = /(?:bg|text|border)-(?:amber|blue|gray|slate|sky|orange)-|bg-neutral-950|(?:bg|text|border)-\[var\(--jpv/

describe('email design coherence', () => {
  it('uses the canonical responsive branded renderer hooks', () => {
    expect(renderer).toContain('jpv-email-shell')
    expect(renderer).toContain('jpv-email-logo')
    expect(renderer).toContain('jpv-email-content')
    expect(renderer).toContain('jpv-email-heading')
    expect(renderer).toContain('jpv-email-footer')
    expect(renderer).toContain('jpv-email-action')
    expect(renderer).toContain('@media only screen and (max-width:620px)')
    expect(renderer).toContain('width:100% !important')
  })

  it('adds a visible fallback URL for every rendered action', () => {
    expect(renderer).toContain('If the button does not work, copy and paste this link:')
    expect(renderer).toContain('word-break:break-all')
    expect(renderer).toContain('${safeUrl}</a>')
  })

  it('preserves escaping for action labels and URLs', () => {
    expect(renderer).toContain('const safeUrl = escapeEmailHtml(action.url)')
    expect(renderer).toContain('escapeEmailHtml(action.label)')
    expect(renderer).toContain('escapeEmailHtml(input.heading)')
    expect(renderer).toContain('escapeEmailHtml(input.preheader)')
  })

  it('provides absolute portal, billing, and support variables from the public base URL', () => {
    expect(sender).toContain('const baseUrl = getPublicBaseUrl().replace(/\\/$/, \'\')')
    expect(sender).toContain('portalUrl: `${baseUrl}/portal`')
    expect(sender).toContain('billingUrl: `${baseUrl}/portal/billing`')
    expect(sender).toContain('supportUrl: `${baseUrl}/#support`')
  })

  it('adds billing and support actions to payment-problem templates', () => {
    expect(templates).toContain("actionLabel: 'Review billing'")
    expect(templates).toContain("actionLabel: 'Review billing history'")
    expect(templates).toContain("actionUrlVariable: '{{billingUrl}}'")
    expect(templates).toContain("secondaryActionLabel: 'Contact support'")
    expect(templates).toContain("secondaryActionUrlVariable: '{{supportUrl}}'")
  })

  it('adds direct support actions to dispute and access-problem templates', () => {
    const supportActionMatches = templates.match(/actionLabel: 'Contact support'/g) ?? []
    expect(supportActionMatches.length).toBeGreaterThanOrEqual(4)
    expect(templates).toContain("actionUrlVariable: '{{supportUrl}}'")
    expect(templates).toContain("actionLabel: 'Open member portal'")
    expect(templates).toContain("actionUrlVariable: '{{portalUrl}}'")
  })

  it('includes action URLs in plain-text email bodies', () => {
    expect(templates).toContain("`${input.actionLabel ?? 'Continue'}: ${input.actionUrlVariable}`")
    expect(templates).toContain("`${input.secondaryActionLabel ?? 'More information'}: ${input.secondaryActionUrlVariable}`")
  })

  it('does not introduce off-token utility styling into email sources', () => {
    expect(`${renderer}\n${templates}`).not.toMatch(prohibited)
  })
})
