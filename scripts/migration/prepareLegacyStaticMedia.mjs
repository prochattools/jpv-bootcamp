#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { copyFileSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const rasterExtensions = new Set(['.avif', '.bmp', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.webp'])

function argument(name) {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : undefined
  if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT ${name}`)
  return value
}

function optionalArgument(name) {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`MISSING_ARGUMENT ${name}`)
  return value
}

function collectFiles(root, relative = '') {
  const current = path.join(root, relative)
  return readdirSync(current, { withFileTypes: true }).flatMap((entry) => {
    const childRelative = path.join(relative, entry.name)
    if (entry.isDirectory()) return collectFiles(root, childRelative)
    if (!entry.isFile() || !rasterExtensions.has(path.extname(entry.name).toLowerCase())) return []
    return [childRelative]
  })
}

const sourceRoot = path.resolve(argument('--source'))
const destinationRoot = path.resolve(argument('--destination'))
const aliasDestination = optionalArgument('--alias-destination')
const aliasDestinationRoot = aliasDestination ? path.resolve(aliasDestination) : undefined
const files = collectFiles(sourceRoot)
const aliases = new Map()
const ambiguousAliases = new Set()

for (const relative of files) {
  const source = path.join(sourceRoot, relative)
  const stat = lstatSync(source)
  if (!stat.isFile() || stat.size <= 0) throw new Error(`INVALID_LEGACY_IMAGE ${relative}`)
  const destination = path.join(destinationRoot, relative)
  mkdirSync(path.dirname(destination), { recursive: true })
  copyFileSync(source, destination)

  if (aliasDestinationRoot) {
    const basename = path.basename(relative)
    const key = basename
    const hash = createHash('sha256').update(readFileSync(source)).digest('hex')
    const previous = aliases.get(key)
    if (!previous) {
      aliases.set(key, { basename, hash, relative })
    } else if (previous.hash !== hash) {
      ambiguousAliases.add(key)
    }
  }
}

let aliasCount = 0
if (aliasDestinationRoot) {
  for (const [key, alias] of aliases) {
    if (ambiguousAliases.has(key)) continue
    const source = path.join(sourceRoot, alias.relative)
    const destination = path.join(aliasDestinationRoot, alias.basename)
    mkdirSync(aliasDestinationRoot, { recursive: true })
    copyFileSync(source, destination)
    aliasCount += 1
  }
}

console.log(`[legacy-static-media] copied ${files.length} raster assets${aliasDestinationRoot ? ` and ${aliasCount} safe basename aliases` : ''}`)
