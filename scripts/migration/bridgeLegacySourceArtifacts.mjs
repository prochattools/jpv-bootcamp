import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

const targets = [
  { name: '127_0_0_1.sql', dest: 'src/assets/uploads/127_0_0_1.sql' },
  { name: 'jpvbootcamp.WordPress.2026-08-12.xml', dest: 'src/assets/uploads/jpvbootcamp.WordPress.2026-08-12.xml' },
  { name: 'jpv-stripe-live-subscriptions.json', dest: 'src/assets/uploads/jpv-stripe-live-subscriptions.json' },
  { name: 'jpv-bunny-migration-inventory.json', dest: 'src/assets/uploads/jpv-bunny-migration-inventory.json' },
]

const roots = [
  '/private/tmp',
  '/tmp',
  join(homedir(), 'Downloads'),
  join(homedir(), 'Desktop'),
  join(homedir(), 'Documents'),
]

const shouldCopy = process.argv.includes('--copy')

async function sha256(path) {
  const content = await readFile(path)
  return createHash('sha256').update(content).digest('hex')
}

async function jsonShape(path) {
  const parsed = JSON.parse(await readFile(path, 'utf8'))
  if (Array.isArray(parsed)) return { topLevelType: 'array', length: parsed.length }
  const arrays = Object.entries(parsed).filter(([, value]) => Array.isArray(value))
  const arrayLengths = Object.fromEntries(arrays.map(([key, value]) => [key, value.length]))
  const objectArrays = arrays.filter(([, value]) => value.length > 0 && value[0] && typeof value[0] === 'object' && !Array.isArray(value[0]))
  const arrayItemKeys = Object.fromEntries(objectArrays.map(([key, value]) => [key, Object.keys(value[0]).sort()]))
  const nestedArrayItemKeys = Object.fromEntries(
    objectArrays.flatMap(([key, value]) =>
      Object.entries(value[0])
        .filter(([, nested]) => Array.isArray(nested) && nested.length > 0 && nested[0] && typeof nested[0] === 'object')
        .map(([nestedKey, nested]) => [`${key}.${nestedKey}`, Object.keys(nested[0]).sort()]),
    ),
  )
  const safeMetadata = {
    ...(typeof parsed.generated_at === 'string' ? { generated_at: parsed.generated_at } : {}),
    ...(typeof parsed.livemode === 'boolean' ? { livemode: parsed.livemode } : {}),
    ...(typeof parsed.stripe_account === 'string' ? { stripe_account: parsed.stripe_account } : {}),
    ...(typeof parsed.library_id === 'number' || typeof parsed.library_id === 'string' ? { library_id: parsed.library_id } : {}),
    ...(parsed.summary && typeof parsed.summary === 'object' && !Array.isArray(parsed.summary) ? { summary: parsed.summary } : {}),
  }
  return { topLevelType: 'object', keys: Object.keys(parsed).sort(), arrayLengths, arrayItemKeys, nestedArrayItemKeys, safeMetadata }
}

async function findExact(name) {
  for (const root of roots) {
    const candidate = join(root, name)
    try {
      const info = await stat(candidate)
      if (info.isFile() && basename(candidate) === name) return candidate
    } catch {}
  }
  return null
}

if (shouldCopy) await mkdir('src/assets/uploads', { recursive: true })
const results = []
for (const target of targets) {
  const source = await findExact(target.name)
  if (!source) {
    results.push({ name: target.name, available: false, copied: false, reason: 'not_found' })
    continue
  }

  const sourceStat = await stat(source)
  const sourceHash = await sha256(source)
  const shape = target.name.endsWith('.json') ? await jsonShape(source) : undefined
  if (!shouldCopy) {
    results.push({
      name: target.name,
      available: true,
      copied: false,
      source,
      sourceBytes: sourceStat.size,
      sha256: sourceHash,
      ...(shape ? { shape } : {}),
    })
    continue
  }

  await copyFile(source, target.dest)
  const [destStat, destHash] = await Promise.all([stat(target.dest), sha256(target.dest)])
  results.push({
    name: target.name,
    available: true,
    copied: true,
    source,
    dest: target.dest,
    sourceBytes: sourceStat.size,
    destBytes: destStat.size,
    hashMatch: sourceHash === destHash,
    sha256: sourceHash,
  })
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`)
if (results.some((item) => !item.available || (shouldCopy && item.hashMatch === false))) process.exitCode = 2
