#!/usr/bin/env node

import { copyFileSync, lstatSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'

const rasterExtensions = new Set(['.avif', '.bmp', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.webp'])

function argument(name) {
  const index = process.argv.indexOf(name)
  const value = index >= 0 ? process.argv[index + 1] : undefined
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
const files = collectFiles(sourceRoot)

for (const relative of files) {
  const source = path.join(sourceRoot, relative)
  const stat = lstatSync(source)
  if (!stat.isFile() || stat.size <= 0) throw new Error(`INVALID_LEGACY_IMAGE ${relative}`)
  const destination = path.join(destinationRoot, relative)
  mkdirSync(path.dirname(destination), { recursive: true })
  copyFileSync(source, destination)
}

console.log(`[legacy-static-media] copied ${files.length} raster assets`)
