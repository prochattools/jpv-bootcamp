import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { createLegacyStaticImageResolver } from './legacyStaticMedia'

const resolve = createLegacyStaticImageResolver([
  { relativePath: '2025/11/Arrows_houses.png', importable: true },
  { relativePath: '2025/11/unique.jpg', importable: true },
  { relativePath: '2025/11/ignored.pdf', importable: false },
  { relativePath: '2025/11/duplicate.png', importable: true },
  { relativePath: '2026/01/duplicate.png', importable: true },
])

assert.deepEqual(
  resolve('https://portal.jpvbootcamp.com/wp-content/uploads/2025/11/Arrows_houses.png?resize=1'),
  { publicUrl: '/legacy-media/2025/11/Arrows_houses.png', alt: 'Arrows_houses.png' },
)
assert.deepEqual(
  resolve('/uploads/2025/11/unique.jpg'),
  { publicUrl: '/legacy-media/2025/11/unique.jpg', alt: 'unique.jpg' },
)
assert.equal(resolve('/wp-content/uploads/2027/01/duplicate.png'), undefined)
assert.equal(resolve('/wp-content/uploads/2025/11/ignored.pdf'), undefined)

const productionDockerfile = readFileSync(path.resolve('Dockerfile.production'), 'utf8')
assert.match(productionDockerfile, /--destination public\/legacy-media/)
assert.match(productionDockerfile, /--alias-destination public\/legacy-media-by-name/)
assert.doesNotMatch(productionDockerfile, /--destination public\/media\/legacy/)

const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'jpv-legacy-static-media-'))
try {
  const sourceRoot = path.join(fixtureRoot, 'source')
  const destinationRoot = path.join(fixtureRoot, 'destination')
  const aliasRoot = path.join(fixtureRoot, 'aliases')
  mkdirSync(path.join(sourceRoot, '2025', '11'), { recursive: true })
  mkdirSync(path.join(sourceRoot, '2026', '01'), { recursive: true })
  writeFileSync(path.join(sourceRoot, '2025', '11', 'same.png'), 'same')
  writeFileSync(path.join(sourceRoot, '2026', '01', 'same.png'), 'same')
  writeFileSync(path.join(sourceRoot, '2025', '11', 'different.png'), 'one')
  writeFileSync(path.join(sourceRoot, '2026', '01', 'different.png'), 'two')
  writeFileSync(path.join(sourceRoot, '2025', '11', 'ignored.pdf'), 'not copied')

  execFileSync(process.execPath, [
    path.resolve('scripts/migration/prepareLegacyStaticMedia.mjs'),
    '--source', sourceRoot,
    '--destination', destinationRoot,
    '--alias-destination', aliasRoot,
  ], { stdio: 'pipe' })

  assert.equal(readFileSync(path.join(destinationRoot, '2025', '11', 'same.png'), 'utf8'), 'same')
  assert.equal(readFileSync(path.join(aliasRoot, 'same.png'), 'utf8'), 'same')
  assert.equal(readFileSync(path.join(destinationRoot, '2026', '01', 'different.png'), 'utf8'), 'two')
  assert.equal(existsSync(path.join(aliasRoot, 'different.png')), false)
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true })
}

console.log('legacyStaticMedia.test.ts: all assertions passed')
