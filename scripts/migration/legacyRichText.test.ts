import assert from 'node:assert/strict'

import { convertLegacyHTMLToLexical } from './legacyRichText'

function rootChildren(result: Awaited<ReturnType<typeof convertLegacyHTMLToLexical>>): any[] {
  return (result.lexical.root?.children ?? []) as any[]
}

async function run(): Promise<void> {
  const standard = await convertLegacyHTMLToLexical({
    html: '<h2>Heading</h2><p>Hello <strong>world</strong>.</p><ul><li>One</li><li>Two</li></ul><blockquote>Quote</blockquote>',
  })
  const standardTypes = rootChildren(standard).map((node) => node.type)
  assert.ok(standardTypes.includes('heading'))
  assert.ok(standardTypes.includes('paragraph'))
  assert.ok(standardTypes.includes('list'))
  assert.ok(standardTypes.includes('quote'))
  assert.equal(standard.fallbackFragments.length, 0)
  assert.deepEqual(standard.bunnyGuids, [])

  const bunnyOne = '56266f09-d651-4bc5-a5b0-ac9185018018'
  const bunnyTwo = 'cda4b492-91af-430d-9bba-4268ccaf8cc2'
  const multiVideo = await convertLegacyHTMLToLexical({
    html: [
      '<p>Before testimony.</p>',
      `<iframe src="https://iframe.mediadelivery.net/embed/581531/${bunnyOne}" title="First testimony"></iframe>`,
      '<p>Between testimonies.</p>',
      `<div><iframe src="https://iframe.mediadelivery.net/embed/581531/${bunnyTwo}" title="Second testimony"></iframe></div>`,
      '<p>After testimony.</p>',
    ].join(''),
  })
  assert.deepEqual(multiVideo.bunnyGuids, [bunnyOne, bunnyTwo])
  const multiChildren = rootChildren(multiVideo)
  const bunnyBlocks = multiChildren.filter((node) => node.type === 'block' && node.fields?.blockType === 'bunnyVideo')
  assert.equal(bunnyBlocks.length, 2)
  assert.deepEqual(bunnyBlocks.map((node) => node.fields.videoGuid), [bunnyOne, bunnyTwo])
  assert.deepEqual(bunnyBlocks.map((node) => node.fields.libraryId), [581531, 581531])
  const firstBunnyIndex = multiChildren.indexOf(bunnyBlocks[0])
  const secondBunnyIndex = multiChildren.indexOf(bunnyBlocks[1])
  assert.ok(firstBunnyIndex > 0)
  assert.ok(secondBunnyIndex > firstBunnyIndex)

  const unresolvedImage = await convertLegacyHTMLToLexical({
    html: '<p>Before.</p><img src="https://legacy.invalid/uploads/example.jpg" alt="Example"><p>After.</p>',
  })
  assert.equal(unresolvedImage.fallbackFragments.length, 1)
  assert.equal(unresolvedImage.fallbackFragments[0].reason, 'image_media_resolution_required')
  const imageFallback = rootChildren(unresolvedImage).find((node) => node.type === 'block' && node.fields?.blockType === 'legacyHTML')
  assert.ok(imageFallback)
  assert.match(imageFallback.fields.html, /example\.jpg/)

  const resolvedImage = await convertLegacyHTMLToLexical({
    html: '<p>Before.</p><img src="https://legacy.invalid/uploads/example.jpg" alt="Example"><p>After.</p>',
    resolveImage: (sourceUrl) => sourceUrl.endsWith('/example.jpg')
      ? { id: 'media-123', relationTo: 'payload_media', alt: 'Example' }
      : undefined,
  })
  assert.deepEqual(resolvedImage.resolvedImages, ['https://legacy.invalid/uploads/example.jpg'])
  assert.equal(resolvedImage.fallbackFragments.length, 0)
  const uploadNode = rootChildren(resolvedImage).find((node) => node.type === 'upload')
  assert.ok(uploadNode, 'resolved image should become a Payload upload node')
  assert.equal(uploadNode.relationTo, 'payload_media')
  assert.equal(String(uploadNode.value), 'media-123')

  const staticImage = await convertLegacyHTMLToLexical({
    html: '<figure><img src="https://portal.jpvbootcamp.com/wp-content/uploads/2025/11/Arrows_houses.png" alt="Arrows"></figure>',
    resolveImage: (sourceUrl) => sourceUrl.endsWith('/Arrows_houses.png')
      ? { publicUrl: '/media/legacy/2025/11/Arrows_houses.png', alt: 'Arrows' }
      : undefined,
  })
  assert.deepEqual(staticImage.resolvedImages, ['https://portal.jpvbootcamp.com/wp-content/uploads/2025/11/Arrows_houses.png'])
  assert.equal(staticImage.fallbackFragments.length, 1)
  assert.equal(staticImage.fallbackFragments[0].reason, 'image_static_media')
  const staticBlock = rootChildren(staticImage).find((node) => node.type === 'block' && node.fields?.blockType === 'legacyHTML')
  assert.ok(staticBlock)
  assert.match(staticBlock.fields.safeHtml, /src="\/media\/legacy\/2025\/11\/Arrows_houses\.png"/)

  delete (globalThis as any).__LEGACY_SCRIPT_EXECUTED
  const unsafe = await convertLegacyHTMLToLexical({
    html: '<p>Safe.</p><script>globalThis.__LEGACY_SCRIPT_EXECUTED = true</script><table><tr><td>Preserve me</td></tr></table>',
  })
  assert.equal((globalThis as any).__LEGACY_SCRIPT_EXECUTED, undefined)
  assert.equal(unsafe.fallbackFragments.length, 2)
  assert.deepEqual(unsafe.fallbackFragments.map((item) => item.sourceTag), ['script', 'table'])
  assert.match(unsafe.fallbackFragments[0].html, /__LEGACY_SCRIPT_EXECUTED/)
  assert.match(unsafe.fallbackFragments[1].html, /Preserve me/)
  const unsafeBlocks = rootChildren(unsafe).filter((node) => node.type === 'block' && node.fields?.blockType === 'legacyHTML')
  assert.equal(unsafeBlocks.length, 2)
  assert.match(unsafeBlocks[0].fields.html, /__LEGACY_SCRIPT_EXECUTED/)
  assert.equal(unsafeBlocks[0].fields.safeHtml.includes('__LEGACY_SCRIPT_EXECUTED'), false)
  assert.match(unsafeBlocks[1].fields.safeHtml, /Preserve me/)

  const deterministicA = await convertLegacyHTMLToLexical({ html: `<p>A</p><iframe src="https://iframe.mediadelivery.net/embed/581531/${bunnyOne}"></iframe>` })
  const deterministicB = await convertLegacyHTMLToLexical({ html: `<p>A</p><iframe src="https://iframe.mediadelivery.net/embed/581531/${bunnyOne}"></iframe>` })
  assert.deepEqual(deterministicA.lexical, deterministicB.lexical)

  console.log('Legacy HTML -> Lexical migration contract: PASS')
}

void run().catch((error) => {
  console.error('Legacy HTML -> Lexical migration contract: FAIL')
  console.error(error)
  process.exitCode = 1
})
