# Rollback Evidence Checklist

Default repository status: `INCOMPLETE`

Do not mark rollback proven from documentation alone. Repository rehearsal evidence and external operational evidence are separate categories.

## Application

- [ ] rollback commit or immutable image/tag recorded
- [ ] previous deployment identifier recorded
- [ ] configuration rollback owner assigned
- [ ] feature-disable path recorded where applicable

## Database

- [ ] backup or snapshot evidence recorded
- [ ] migration rollback or restore strategy recorded
- [ ] data-loss implications reviewed
- [ ] post-rollback verification query or checklist recorded
- [ ] rollback trigger criteria reviewed

## Providers

- [ ] Stripe disable or rollback action recorded
- [ ] email queue pause or disable action recorded
- [ ] webhook rollback action recorded
- [ ] provider credential or configuration owner assigned

## Operations

- [ ] rollback decision owner assigned
- [ ] communication owner assigned
- [ ] monitoring owner assigned
- [ ] post-rollback verification owner assigned
- [ ] incident evidence capture path assigned

## Evidence distinction

- Repository rehearsal evidence:
  - local static rehearsal and disposable-database rehearsal outputs from repository-owned commands
- External operational evidence:
  - actual staging or production backup references, rollback execution notes, provider disable evidence, and monitored post-rollback verification

Current default:

- Repository-only status: `Documented but incomplete`
- External operational status: `Not executed`
