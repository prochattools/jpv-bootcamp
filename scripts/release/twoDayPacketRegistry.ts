import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export type TwoDayPacketStatus = 'blocked' | 'ready' | 'in_progress' | 'implemented' | 'deferred'
export type TwoDayPacketLane =
  | 'SCHEMA'
  | 'BILLING'
  | 'PAYLOAD'
  | 'LIVEKIT'
  | 'COURSE'
  | 'FRONTEND'
  | 'QA'
  | 'RELEASE'

export type TwoDayPacketEntry = Readonly<{
  id: string
  title: string
  wave: 1 | 2 | 3 | 4 | 5
  lane: TwoDayPacketLane
  priority: number
  dependencies: string[]
  sourcePaths: string[]
  acceptanceCriteria: string[]
  validationCommands: string[]
  allowedOperations: string[]
  prohibitedOperations: string[]
  expectedChangedPaths: string[]
  expectedCommitMessage: string
  rollbackCondition: string
  approvalGate: string
  parallelSafe: boolean
  status: TwoDayPacketStatus
  blocker: string | null
  commit: string | null
  tests: string[]
}>

export type TwoDayPacketRegistry = Readonly<{
  generatedFrom: string
  branch: string
  head: string
  packets: TwoDayPacketEntry[]
}>

export const TWO_DAY_PACKET_REGISTRY_PATH = 'docs/TWO_DAY_PACKET_REGISTRY.json'

const VALID_LANES: ReadonlySet<TwoDayPacketLane> = new Set([
  'SCHEMA',
  'BILLING',
  'PAYLOAD',
  'LIVEKIT',
  'COURSE',
  'FRONTEND',
  'QA',
  'RELEASE',
])

function readRegistry(registryPath = TWO_DAY_PACKET_REGISTRY_PATH): TwoDayPacketRegistry {
  return JSON.parse(readFileSync(registryPath, 'utf8')) as TwoDayPacketRegistry
}

function detectCycle(graph: Map<string, string[]>): string | null {
  const visiting = new Set<string>()
  const visited = new Set<string>()

  function walk(node: string, trail: string[]): string | null {
    if (visiting.has(node)) return [...trail, node].join(' -> ')
    if (visited.has(node)) return null

    visiting.add(node)
    for (const dependency of graph.get(node) ?? []) {
      const cycle = walk(dependency, [...trail, node])
      if (cycle) return cycle
    }
    visiting.delete(node)
    visited.add(node)
    return null
  }

  for (const node of graph.keys()) {
    const cycle = walk(node, [])
    if (cycle) return cycle
  }
  return null
}

export function validateTwoDayPacketRegistry(
  registry: TwoDayPacketRegistry = readRegistry(),
): string[] {
  const errors: string[] = []
  const packetIds = new Set<string>()

  if (!registry.generatedFrom.trim()) errors.push('missing_generated_from')
  if (!registry.branch.trim()) errors.push('missing_branch')
  if (!registry.head.trim()) errors.push('missing_head')
  if (registry.packets.length === 0) errors.push('empty_registry')

  for (const packet of registry.packets) {
    if (!packet.id.trim()) errors.push('missing_packet_id')
    if (packetIds.has(packet.id)) errors.push(`duplicate_packet_id:${packet.id}`)
    packetIds.add(packet.id)
    if (!packet.title.trim()) errors.push(`missing_title:${packet.id}`)
    if (!VALID_LANES.has(packet.lane)) errors.push(`invalid_lane:${packet.id}:${packet.lane}`)
    if (!(packet.wave >= 1 && packet.wave <= 5)) errors.push(`invalid_wave:${packet.id}:${packet.wave}`)
    if (packet.priority < 1) errors.push(`invalid_priority:${packet.id}`)
    if (packet.dependencies.some((dependency) => !dependency.trim())) errors.push(`empty_dependency:${packet.id}`)
    if (packet.sourcePaths.some((sourcePath) => !sourcePath.trim())) errors.push(`empty_source_path:${packet.id}`)
    if (packet.acceptanceCriteria.length === 0) errors.push(`empty_acceptance_criteria:${packet.id}`)
    if (packet.validationCommands.length === 0) errors.push(`empty_validation_commands:${packet.id}`)
    if (packet.allowedOperations.length === 0) errors.push(`empty_allowed_operations:${packet.id}`)
    if (packet.prohibitedOperations.length === 0) errors.push(`empty_prohibited_operations:${packet.id}`)
    if (packet.expectedChangedPaths.length === 0) errors.push(`empty_expected_changed_paths:${packet.id}`)
    if (!packet.expectedCommitMessage.trim()) errors.push(`missing_expected_commit_message:${packet.id}`)
    if (!packet.rollbackCondition.trim()) errors.push(`missing_rollback_condition:${packet.id}`)
    if (!packet.approvalGate.trim()) errors.push(`missing_approval_gate:${packet.id}`)
    if (packet.status === 'blocked' && !packet.blocker?.trim()) errors.push(`missing_blocker:${packet.id}`)
    if (packet.status !== 'blocked' && packet.blocker && !packet.blocker.trim()) errors.push(`empty_blocker:${packet.id}`)
    if (packet.status === 'implemented' && !packet.commit?.trim()) errors.push(`missing_commit:${packet.id}`)
    if (!packet.commit) {
      errors.push(`missing_commit_field:${packet.id}`)
    }
    if (packet.tests.length === 0) errors.push(`empty_tests:${packet.id}`)
    if (packet.parallelSafe !== true && packet.parallelSafe !== false) errors.push(`invalid_parallel_safe:${packet.id}`)
  }

  for (const packet of registry.packets) {
    for (const dependency of packet.dependencies) {
      if (!packetIds.has(dependency)) errors.push(`unknown_dependency:${packet.id}:${dependency}`)
    }
  }

  const dependencyGraph = new Map<string, string[]>()
  for (const packet of registry.packets) dependencyGraph.set(packet.id, packet.dependencies)
  const cycle = detectCycle(dependencyGraph)
  if (cycle) errors.push(`dependency_cycle:${cycle}`)

  return errors
}

export function buildTwoDayPacketRegistryReport(
  registry: TwoDayPacketRegistry = readRegistry(),
): { ok: boolean; errors: string[]; output: string } {
  const errors = validateTwoDayPacketRegistry(registry)
  const lines: string[] = [
    'TWO DAY PACKET REGISTRY',
    `Generated from: ${registry.generatedFrom}`,
    `Branch: ${registry.branch}`,
    `Head: ${registry.head}`,
    '',
  ]

  const grouped = new Map<TwoDayPacketLane, TwoDayPacketEntry[]>()
  for (const lane of ['SCHEMA', 'BILLING', 'PAYLOAD', 'LIVEKIT', 'COURSE', 'FRONTEND', 'QA', 'RELEASE'] as const) {
    grouped.set(lane, [])
  }
  for (const packet of registry.packets) grouped.get(packet.lane)?.push(packet)

  for (const [lane, packets] of grouped) {
    lines.push(`## ${lane}`)
    for (const packet of packets) {
      lines.push(`- ${packet.id} [${packet.status}]`)
      lines.push(`  title: ${packet.title}`)
      lines.push(`  wave: ${packet.wave}`)
      lines.push(`  commit: ${packet.commit ?? 'null'}`)
      lines.push(`  dependencies: ${packet.dependencies.join(', ') || 'none'}`)
    }
    lines.push('')
  }

  if (errors.length > 0) {
    lines.push('VALIDATION ERRORS')
    for (const error of errors) lines.push(`- ${error}`)
    lines.push('')
  }

  return { ok: errors.length === 0, errors, output: `${lines.join('\n').trim()}\n` }
}

export function main(): void {
  process.stdout.write(buildTwoDayPacketRegistryReport().output)
}

const invokedPath = process.argv[1]
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  main()
}
