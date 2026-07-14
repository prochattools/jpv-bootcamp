import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function main(): void {
  const source = readFileSync('docs/release/ROLLBACK_EVIDENCE_CHECKLIST.md', 'utf8')
  for (const heading of [
    '# Rollback Evidence Checklist',
    '## Application',
    '## Database',
    '## Providers',
    '## Operations',
    '## Evidence distinction',
  ]) {
    assert.match(source, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  for (const required of [
    'rollback commit or immutable image/tag recorded',
    'backup or snapshot evidence recorded',
    'data-loss implications reviewed',
    'Stripe disable or rollback action recorded',
    'email queue pause or disable action recorded',
    'rollback decision owner assigned',
    'communication owner assigned',
    'monitoring owner assigned',
    'Repository rehearsal evidence',
    'External operational evidence',
    'Documented but incomplete',
    'Not executed',
  ]) {
    assert.match(source, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.doesNotMatch(source, /\bGO\b/)
  console.log('rollback_evidence_checklist.test.ts passed')
}

main()
