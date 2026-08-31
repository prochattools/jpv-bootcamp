import assert from 'node:assert/strict'

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
  { publicUrl: '/media/legacy/2025/11/Arrows_houses.png', alt: 'Arrows_houses.png' },
)
assert.deepEqual(
  resolve('/uploads/2025/11/unique.jpg'),
  { publicUrl: '/media/legacy/2025/11/unique.jpg', alt: 'unique.jpg' },
)
assert.equal(resolve('/wp-content/uploads/2027/01/duplicate.png'), undefined)
assert.equal(resolve('/wp-content/uploads/2025/11/ignored.pdf'), undefined)

console.log('legacyStaticMedia.test.ts: all assertions passed')
