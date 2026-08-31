import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
assert.doesNotMatch(productionDockerfile, /--destination public\/media\/legacy/)

console.log('legacyStaticMedia.test.ts: all assertions passed')
