import { existsSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import {
  DECISION_MANIFEST,
  DECISION_READY_SUMMARY,
  NOT_DECISION_READY_SUMMARY,
  type DecisionManifestEntry,
  type DecisionReadinessState,
} from './decisionManifest'

type DecisionPacket = {
  entry: DecisionManifestEntry
  source: string
  decisionId: string
  currentStatus: string
  decisionOwnerRole: string
  approverRole: string
  implementationOwnerRole: string
  rollbackOwnerRole: string
  classification: string
  releaseImpact: string
  dependencyIds: string[]
  requiredEvidenceSummary: string
}

type DecisionReadinessOptions = {
  manifest?: DecisionManifestEntry[]
  readFile?: (path: string) => string
  log?: (message: string) => void
}

const METADATA_LABELS = {
  decisionId: 'Decision ID',
  currentStatus: 'Current status',
  decisionOwnerRole: 'Decision owner role',
  approverRole: 'Approver role',
  implementationOwnerRole: 'Implementation owner role',
  rollbackOwnerRole: 'Rollback owner role',
  classification: 'Classification',
  releaseImpact: 'Release impact',
  dependencyIds: 'Depends on',
  requiredEvidenceSummary: 'Required evidence summary',
} as const

const REQUIRED_SECTION_MARKERS = [
  '## Approval record',
  '- Approval decision:',
  '- Approved / rejected by:',
  '- Approval timestamp:',
  '- Evidence reference:',
  '- Execution owner confirmation:',
  '- Rollback owner confirmation:',
] as const

const APPROVED_STATUSES = new Set(['APPROVED', 'GO', 'CONDITIONAL GO'])
const REJECTED_STATUSES = new Set(['REJECTED'])
const PLACEHOLDER_PATTERN = /\[(?:TO BE FILLED|PENDING|CLIENT TO PROVIDE)[^\]]*\]/i

function metadataValue(source: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`^- ${escaped}:\\s*(.+)\\s*$`, 'm'))
  if (!match) {
    throw new Error(`missing metadata field: ${label}`)
  }
  const rawValue = match[1].trim()
  if (rawValue.startsWith('`') && rawValue.endsWith('`') && rawValue.length >= 2) {
    return rawValue.slice(1, -1).trim()
  }
  return rawValue
}

function parseDependencies(raw: string): string[] {
  if (!raw || raw.toLowerCase() === 'none') return []
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function validateDecisionManifest(entries: DecisionManifestEntry[] = DECISION_MANIFEST): void {
  const ids = new Set<string>()
  const paths = new Set<string>()
  const categories = new Set<string>()

  for (const entry of entries) {
    if (!entry.id.trim()) throw new Error('decision manifest entry is missing an ID')
    if (ids.has(entry.id)) throw new Error(`duplicate decision ID: ${entry.id}`)
    ids.add(entry.id)

    if (!entry.filePath.trim()) throw new Error(`${entry.id} is missing a file path`)
    if (paths.has(entry.filePath)) throw new Error(`duplicate decision file path: ${entry.filePath}`)
    paths.add(entry.filePath)

    if (categories.has(entry.category)) throw new Error(`duplicate decision category: ${entry.category}`)
    categories.add(entry.category)

    if (!entry.ownerRole.trim()) throw new Error(`${entry.id} is missing an owner role`)
    if (!entry.approverRole.trim()) throw new Error(`${entry.id} is missing an approver role`)
    if (!entry.implementationOwnerRole.trim()) throw new Error(`${entry.id} is missing an implementation owner role`)
    if (!entry.rollbackOwnerRole.trim()) throw new Error(`${entry.id} is missing a rollback owner role`)
    if (!entry.allowedStatuses.includes(entry.defaultStatus)) {
      throw new Error(`${entry.id} default status is not allowlisted`)
    }
    if (entry.requiredEvidence.length === 0) {
      throw new Error(`${entry.id} must declare required evidence`)
    }
  }

  for (const entry of entries) {
    for (const dependencyId of entry.dependencyIds) {
      if (!ids.has(dependencyId)) {
        throw new Error(`${entry.id} depends on missing decision ${dependencyId}`)
      }
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const byId = new Map(entries.map((entry) => [entry.id, entry] as const))

  function visit(id: string): void {
    if (visited.has(id)) return
    if (visiting.has(id)) throw new Error(`cyclic decision dependency detected at ${id}`)
    visiting.add(id)
    for (const dependencyId of byId.get(id)?.dependencyIds ?? []) {
      visit(dependencyId)
    }
    visiting.delete(id)
    visited.add(id)
  }

  for (const entry of entries) visit(entry.id)
}

export function parseDecisionPacket(
  entry: DecisionManifestEntry,
  readFile: (path: string) => string = (path) => readFileSync(path, 'utf8'),
): DecisionPacket {
  if (!existsSync(entry.filePath)) {
    throw new Error(`missing decision file: ${entry.filePath}`)
  }

  const source = readFile(entry.filePath)
  return {
    entry,
    source,
    decisionId: metadataValue(source, METADATA_LABELS.decisionId),
    currentStatus: metadataValue(source, METADATA_LABELS.currentStatus),
    decisionOwnerRole: metadataValue(source, METADATA_LABELS.decisionOwnerRole),
    approverRole: metadataValue(source, METADATA_LABELS.approverRole),
    implementationOwnerRole: metadataValue(source, METADATA_LABELS.implementationOwnerRole),
    rollbackOwnerRole: metadataValue(source, METADATA_LABELS.rollbackOwnerRole),
    classification: metadataValue(source, METADATA_LABELS.classification),
    releaseImpact: metadataValue(source, METADATA_LABELS.releaseImpact),
    dependencyIds: parseDependencies(metadataValue(source, METADATA_LABELS.dependencyIds)),
    requiredEvidenceSummary: metadataValue(source, METADATA_LABELS.requiredEvidenceSummary),
  }
}

function decisionState(packet: DecisionPacket): DecisionReadinessState {
  const { id } = packet.entry
  const { currentStatus } = packet

  if (APPROVED_STATUSES.has(currentStatus)) return 'approved'
  if (REJECTED_STATUSES.has(currentStatus)) return 'rejected'
  if (currentStatus === 'BLOCKED' || (id === 'core-go-live' && currentStatus === 'NO-GO')) return 'blocked'
  if (id === 'rollback-readiness' && currentStatus === 'DOCUMENTED_BUT_INCOMPLETE') return 'repository-ready'
  return 'awaiting external approval'
}

function validatePacket(packet: DecisionPacket): string[] {
  const errors: string[] = []

  if (packet.decisionId !== packet.entry.id) {
    errors.push(`${packet.entry.id}: decision ID does not match manifest`)
  }
  if (!packet.entry.allowedStatuses.includes(packet.currentStatus)) {
    errors.push(`${packet.entry.id}: unsupported status ${packet.currentStatus}`)
  }
  if (packet.decisionOwnerRole !== packet.entry.ownerRole) {
    errors.push(`${packet.entry.id}: decision owner role drifted from manifest`)
  }
  if (packet.approverRole !== packet.entry.approverRole) {
    errors.push(`${packet.entry.id}: approver role drifted from manifest`)
  }
  if (packet.implementationOwnerRole !== packet.entry.implementationOwnerRole) {
    errors.push(`${packet.entry.id}: implementation owner role drifted from manifest`)
  }
  if (packet.rollbackOwnerRole !== packet.entry.rollbackOwnerRole) {
    errors.push(`${packet.entry.id}: rollback owner role drifted from manifest`)
  }
  if (packet.classification !== packet.entry.classification) {
    errors.push(`${packet.entry.id}: classification drifted from manifest`)
  }
  if (packet.releaseImpact !== packet.entry.releaseImpact) {
    errors.push(`${packet.entry.id}: release impact drifted from manifest`)
  }
  if (packet.requiredEvidenceSummary.length === 0) {
    errors.push(`${packet.entry.id}: required evidence summary is missing`)
  }

  const manifestDependencies = packet.entry.dependencyIds.join(',')
  const packetDependencies = packet.dependencyIds.join(',')
  if (manifestDependencies !== packetDependencies) {
    errors.push(`${packet.entry.id}: dependency list drifted from manifest`)
  }

  for (const marker of REQUIRED_SECTION_MARKERS) {
    if (!packet.source.includes(marker)) {
      errors.push(`${packet.entry.id}: missing required approval marker ${marker}`)
    }
  }

  if (APPROVED_STATUSES.has(packet.currentStatus)) {
    const approvalBlock = packet.source.split('## Approval record')[1] ?? ''
    if (PLACEHOLDER_PATTERN.test(approvalBlock)) {
      errors.push(`${packet.entry.id}: approved status still contains placeholder approval data`)
    }
  }

  return errors
}

function validateCrossPacketState(packets: DecisionPacket[]): string[] {
  const errors: string[] = []
  const byId = new Map(packets.map((packet) => [packet.entry.id, packet] as const))

  const coreGoLive = byId.get('core-go-live')
  if (coreGoLive && (coreGoLive.currentStatus === 'GO' || coreGoLive.currentStatus === 'CONDITIONAL GO')) {
    for (const dependencyId of coreGoLive.entry.dependencyIds) {
      const dependency = byId.get(dependencyId)
      if (!dependency || !APPROVED_STATUSES.has(dependency.currentStatus)) {
        errors.push(`core-go-live: ${coreGoLive.currentStatus} is invalid while ${dependencyId} is unresolved`)
      }
    }
    if (coreGoLive.currentStatus === 'CONDITIONAL GO' && coreGoLive.source.includes('- Conditions: [TO BE FILLED DURING APPROVAL]')) {
      errors.push('core-go-live: CONDITIONAL GO requires explicit approved conditions')
    }
  }

  const stagingMigration = byId.get('staging-migration-approval')
  if (stagingMigration?.currentStatus === 'APPROVED') {
    for (const dependencyId of stagingMigration.entry.dependencyIds) {
      const dependency = byId.get(dependencyId)
      if (!dependency || !APPROVED_STATUSES.has(dependency.currentStatus)) {
        errors.push(`staging-migration-approval: APPROVED requires ${dependencyId} to be approved`)
      }
    }
  }

  const previewReadiness = readFileSync('docs/PREVIEW_RELEASE_READINESS.md', 'utf8')
  if (!/M2-01 remains post-core/i.test(previewReadiness)) {
    errors.push('preview readiness no longer states that M2-01 remains post-core')
  }

  return errors
}

export function runDecisionReadiness(options: DecisionReadinessOptions = {}): string {
  const manifest = options.manifest ?? DECISION_MANIFEST
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, 'utf8'))
  const log = options.log ?? console.log

  validateDecisionManifest(manifest)

  const packets = manifest.map((entry) => parseDecisionPacket(entry, readFile))
  const errors = packets.flatMap(validatePacket).concat(validateCrossPacketState(packets))

  for (const packet of packets) {
    log(`\n${packet.entry.category.toUpperCase()}`)
    log(`- ${packet.entry.id}: ${packet.currentStatus} [${decisionState(packet)}]`)
    log(`  file: ${packet.entry.filePath}`)
    log(`  owner: ${packet.decisionOwnerRole}`)
    log(`  approver: ${packet.approverRole}`)
    log(`  dependencies: ${packet.dependencyIds.length > 0 ? packet.dependencyIds.join(', ') : 'none'}`)
  }

  if (errors.length > 0) {
    log('\nVALIDATION ERRORS')
    for (const error of errors) log(`- ${error}`)
    log(`\n${NOT_DECISION_READY_SUMMARY}`)
    return NOT_DECISION_READY_SUMMARY
  }

  log('\nOVERALL STATUS')
  log(`- Decision readiness: ${DECISION_READY_SUMMARY}`)
  log(`- Formal go/no-go state: ${packets.find((packet) => packet.entry.id === 'core-go-live')?.currentStatus ?? 'UNKNOWN'}`)
  return DECISION_READY_SUMMARY
}

export function main(): void {
  const summary = runDecisionReadiness()
  if (summary !== DECISION_READY_SUMMARY) {
    process.exitCode = 1
  }
}

const invokedPath = process.argv[1]
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
