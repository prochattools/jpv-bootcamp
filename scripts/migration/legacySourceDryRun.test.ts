import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  CURRENT_REHEARSAL_EXPECTATIONS,
  assertRealSourceContentExpectations,
  assertSnapshotExpectations,
  buildIdentityCrosswalk,
  assertPiiOutputOutsideRepo,
  buildLegacyDryRunNormalization,
  buildLegacySqlSnapshot,
  buildLocalMediaManifest,
  parsePhpMyAdminDump,
  parseWordPressWxr,
  reconcileBunnyReferences,
  reconcileWordPressAttachments,
  type StripeEvidenceFile,
} from './legacySourceDryRun'

function sqlValue(value: string | number | null): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
}

function insert(table: string, columns: string[], rows: Array<Array<string | number | null>>): string {
  const values = rows.map((row) => `(${row.map(sqlValue).join(', ')})`).join(',\n')
  return `INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(', ')}) VALUES\n${values};\n`
}

function buildSyntheticSql(): string {
  const sourceIds = ['74', '76', ...Array.from({ length: 46 }, (_, index) => String(100 + index))]
  const userRows = sourceIds.map((id, index) => [
    Number(id),
    `user_${id}`,
    'PASSWORD_HASH_MUST_NOT_BE_MIGRATED',
    `user-${id}`,
    id === '74' ? 'nidia-typo@invalid.example' : id === '76' ? 'nidia-correct@invalid.example' : `member-${index}@invalid.example`,
    '',
    '2026-01-01 00:00:00',
    '',
    0,
    `Member ${id}`,
  ])
  const userMetaRows = sourceIds.map((id, index) => [
    index + 1,
    Number(id),
    'wp_capabilities',
    'a:1:{s:10:"subscriber";b:1;}',
  ])
  const crmRows = sourceIds.map((id, index) => [
    index + 1,
    Number(id),
    id === '76' ? 'nidia-correct@invalid.example' : id === '74' ? 'nidia-typo@invalid.example' : `member-${index}@invalid.example`,
    `First${id}`,
    `Last${id}`,
    'subscribed',
  ])

  return [
    insert('wp_users', ['ID', 'user_login', 'user_pass', 'user_nicename', 'user_email', 'user_url', 'user_registered', 'user_activation_key', 'user_status', 'display_name'], userRows),
    insert('wp_usermeta', ['umeta_id', 'user_id', 'meta_key', 'meta_value'], userMetaRows),
    // A second INSERT for the same table proves multi-statement aggregation.
    insert('wp_fc_subscribers', ['id', 'user_id', 'email', 'first_name', 'last_name', 'status'], crmRows.slice(0, 24)),
    insert('wp_fc_subscribers', ['id', 'user_id', 'email', 'first_name', 'last_name', 'status'], crmRows.slice(24)),
    insert('wp_fcom_spaces', ['id', 'created_by', 'parent_id', 'title', 'slug', 'type', 'privacy', 'status'], [
      [7, 1, null, 'Property Investment Training - UK', 'property-investment', 'course', 'private', 'published'],
      [12, 1, null, 'Upgrade to VIP', 'upgrade-vip', 'sidebar_link', 'logged_in', 'published'],
      [25, 1, null, 'Upgrade to Pro', 'upgrade-pro', 'sidebar_link', 'logged_in', 'published'],
      [26, 1, null, 'Only VIP', 'only-vip', 'space_group', 'public', 'active'],
      [27, 1, 26, 'Only VIP Discussion', 'only-vip-discussion', 'community', 'private', 'published'],
      [23, 1, null, 'Forum', 'forum', 'community', 'private', 'published'],
    ]),
    insert('wp_fcom_posts', ['id', 'user_id', 'parent_id', 'title', 'message', 'type', 'space_id', 'status', 'meta', 'created_at'], [
      [10, 76, null, 'Section', null, 'course_section', 7, 'published', 'a:0:{}', '2026-01-01 00:00:00'],
      [11, 74, 10, 'Lesson', '<p>Body; punctuation stays intact.</p>', 'course_lesson', 7, 'published', 'player.mediadelivery.net/embed/581531/56266f09-d651-4bc5-a5b0-ac9185018018', '2026-01-02 00:00:00'],
      [90, 100, null, 'Feed', 'Historical VIP wording remains unchanged', 'text', 23, 'published', 'a:0:{}', '2026-01-03 00:00:00'],
    ]),
    insert('wp_fcom_post_comments', ['id', 'user_id', 'post_id', 'parent_id', 'message', 'status', 'created_at'], [
      [1, 101, 90, null, 'Comment', 'published', '2026-01-04 00:00:00'],
    ]),
    insert('wp_fcom_post_reactions', ['id', 'user_id', 'object_id', 'parent_id', 'object_type', 'type', 'created_at'], [
      [1, 76, 11, 7, 'lesson_completed', 'completed', '2026-01-05 00:00:00'],
      [2, 100, 90, null, 'feed', 'like', '2026-01-05 00:00:00'],
    ]),
    insert('wp_fcom_space_user', ['id', 'space_id', 'user_id', 'status', 'role'], [
      [1, 7, '74', 'active', 'student'],
      [2, 23, '100', 'active', 'member'],
    ]),
    insert('wp_fcom_media_archive', ['id', 'object_source', 'media_key', 'user_id', 'feed_id', 'sub_object_id', 'media_type', 'driver', 'media_path', 'media_url'], [
      [1, 'feed', 'key-1', 100, 90, null, 'image/jpeg', 'local', '/uploads/example.jpg', 'https://example.invalid/uploads/example.jpg'],
    ]),
    insert('wp_fcom_user_activities', ['id', 'user_id', 'feed_id', 'space_id', 'related_id', 'action_name', 'created_at'], [
      [1, 76, null, 7, 11, 'course_completed', '2026-01-06 00:00:00'],
    ]),
  ].join('\n')
}

function buildStripeEvidence(): StripeEvidenceFile {
  const activeEmails = [
    'nidia-typo@invalid.example',
    ...Array.from({ length: 10 }, (_, index) => `member-${index + 2}@invalid.example`),
  ]
  const qualifying = activeEmails.map((email, index) => ({
    subscription_id: `sub_active_${index}`,
    customer_id: `cus_active_${index}`,
    customer_email: email,
    customer_name: null,
    subscription_status: 'active',
    legacy_product_id: 'prod_legacy',
    legacy_price_id: 'price_legacy',
  }))
  qualifying.push({
    subscription_id: 'sub_expired_duplicate',
    customer_id: 'cus_expired_duplicate',
    customer_email: 'nidia-typo@invalid.example',
    customer_name: null,
    subscription_status: 'incomplete_expired',
    legacy_product_id: 'prod_legacy',
    legacy_price_id: 'price_legacy',
  })
  qualifying.push({
    subscription_id: 'sub_past_due',
    customer_id: 'cus_past_due',
    customer_email: 'member-13@invalid.example',
    customer_name: null,
    subscription_status: 'past_due',
    legacy_product_id: 'prod_legacy',
    legacy_price_id: 'price_legacy',
  })
  return { qualifying_records: qualifying }
}

function testSqlParser(): void {
  const sql = [
    insert('wp_users', ['ID', 'user_email', 'display_name'], [[1, 'one@invalid.example', 'One; With semicolon']]),
    insert('wp_users', ['ID', 'user_email', 'display_name'], [[2, 'two@invalid.example', "O'Reilly"]]),
  ].join('\n')
  const parsed = parsePhpMyAdminDump(sql, new Set(['wp_users']))
  assert.equal(parsed.tables.get('wp_users')?.length, 2)
  assert.equal(parsed.tables.get('wp_users')?.[0]?.display_name, 'One; With semicolon')
  assert.equal(parsed.tables.get('wp_users')?.[1]?.display_name, "O'Reilly")
}

function testWxrParser(): void {
  const xml = `<?xml version="1.0"?><rss><channel>
  <item><title><![CDATA[Photo]]></title><dc:creator><![CDATA[author]]></dc:creator><content:encoded><![CDATA[<p>Body</p>]]></content:encoded><wp:post_id>11</wp:post_id><wp:post_parent>0</wp:post_parent><wp:status>inherit</wp:status><wp:post_type>attachment</wp:post_type><wp:attachment_url><![CDATA[https://example.invalid/a.jpg]]></wp:attachment_url><wp:postmeta><wp:meta_key><![CDATA[_wp_attached_file]]></wp:meta_key><wp:meta_value><![CDATA[2026/01/a.jpg]]></wp:meta_value></wp:postmeta></item>
  </channel></rss>`
  const items = parseWordPressWxr(xml)
  assert.equal(items.length, 1)
  assert.equal(items[0].postId, '11')
  assert.equal(items[0].attachmentUrl, 'https://example.invalid/a.jpg')
  assert.equal(items[0].meta[0].value, '2026/01/a.jpg')
}

function testMediaManifest(): void {
  const root = mkdtempSync(path.join(os.tmpdir(), 'jpv-media-fixture-'))
  mkdirSync(path.join(root, '2026', '01'), { recursive: true })
  writeFileSync(path.join(root, '2026', '01', 'photo.jpg'), Buffer.from('jpg-data'))
  writeFileSync(path.join(root, '2026', '01', 'index.php'), Buffer.from('<?php echo 1;'))
  writeFileSync(path.join(root, '.htaccess'), Buffer.from('deny from all'))
  const manifest = buildLocalMediaManifest(root)
  assert.equal(manifest.length, 3)
  assert.equal(manifest.find((entry) => entry.relativePath.endsWith('photo.jpg'))?.importable, true)
  assert.equal(manifest.find((entry) => entry.relativePath.endsWith('index.php'))?.exclusionReason, 'executable_or_control_file')
  assert.equal(manifest.find((entry) => entry.relativePath === '.htaccess')?.exclusionReason, 'executable_or_control_file')
}

function testIdentityAndNormalization(): void {
  const snapshot = buildLegacySqlSnapshot(buildSyntheticSql())
  const stripe = buildStripeEvidence()
  const crosswalk = buildIdentityCrosswalk(snapshot, stripe)

  assert.deepEqual(CURRENT_REHEARSAL_EXPECTATIONS, {
    sourceMemberAccounts: 48,
    canonicalMembers: 47,
    active: 11,
    blocked: 36,
  })
  assertSnapshotExpectations(crosswalk)

  const merged = crosswalk.members.find((member) => member.canonicalWpUserId === '76')
  assert.ok(merged)
  assert.deepEqual(merged.sourceWpUserIds, ['74', '76'])
  assert.equal(merged.canonicalEmail, 'nidia-correct@invalid.example', 'canonical email must come from WP 76')
  assert.equal(merged.accountStatus, 'active', 'active Stripe evidence matched through WP 74 alias must activate the merged person')
  assert.ok(merged.sourceEmails.includes('nidia-typo@invalid.example'))
  assert.ok(merged.sourceEmails.includes('nidia-correct@invalid.example'))

  const pastDue = crosswalk.members.find((member) => member.sourceEmails.includes('member-13@invalid.example'))
  assert.equal(pastDue?.accountStatus, 'blocked')
  assert.equal(pastDue?.classificationReason, 'stripe_past_due_fail_closed')

  const normalized = buildLegacyDryRunNormalization(snapshot, stripe)
  assert.equal(normalized.courses.length, 1)
  assert.equal(normalized.courseSections.length, 1)
  assert.equal(normalized.courseLessons.length, 1)
  assert.equal(normalized.feedPosts.length, 1)
  assert.equal(normalized.comments.length, 1)
  assert.equal(normalized.lessonCompletedReactions.length, 1)
  assert.equal(normalized.courseCompletedActivities.length, 1)
  assert.equal(normalized.bunnyReferences.length, 1)
  assert.equal(normalized.bunnyReferences[0].videoGuid, '56266f09-d651-4bc5-a5b0-ac9185018018')

  const vipDiscussion = snapshot.spaces.find((space) => space.title === 'Only VIP Discussion')
  assert.equal(vipDiscussion?.targetTitle, 'Member Discussion')
  assert.equal(vipDiscussion?.migrate, true)
  const vipGroup = snapshot.spaces.find((space) => space.title === 'Only VIP')
  assert.equal(vipGroup?.targetTitle, 'Members')
  assert.equal(snapshot.spaces.find((space) => space.title === 'Upgrade to VIP')?.migrate, false)
  assert.equal(snapshot.spaces.find((space) => space.title === 'Upgrade to Pro')?.migrate, false)
  assert.equal(normalized.feedPosts[0].message, 'Historical VIP wording remains unchanged')
}

function testReconciliationAndOutputGuards(): void {
  const root = mkdtempSync(path.join(os.tmpdir(), 'jpv-reconcile-fixture-'))
  mkdirSync(path.join(root, '2026', '01'), { recursive: true })
  writeFileSync(path.join(root, '2026', '01', 'photo.jpg'), Buffer.from('photo'))
  const manifest = buildLocalMediaManifest(root)
  const wxr = parseWordPressWxr(`<?xml version="1.0"?><rss><channel>
    <item><title>Photo</title><wp:post_id>9</wp:post_id><wp:post_parent>0</wp:post_parent><wp:status>inherit</wp:status><wp:post_type>attachment</wp:post_type><wp:attachment_url>https://portal.example/wp-content/uploads/2026/01/photo.jpg</wp:attachment_url><wp:postmeta><wp:meta_key>_wp_attached_file</wp:meta_key><wp:meta_value>2026/01/photo.jpg</wp:meta_value></wp:postmeta></item>
    <item><title>Missing</title><wp:post_id>10</wp:post_id><wp:post_parent>0</wp:post_parent><wp:status>inherit</wp:status><wp:post_type>attachment</wp:post_type><wp:attachment_url>https://portal.example/wp-content/uploads/2026/01/missing.jpg</wp:attachment_url><wp:postmeta><wp:meta_key>_wp_attached_file</wp:meta_key><wp:meta_value>2026/01/missing.jpg</wp:meta_value></wp:postmeta></item>
  </channel></rss>`)
  const attachment = reconcileWordPressAttachments(wxr, manifest)
  assert.equal(attachment.sourceAttachmentCount, 2)
  assert.equal(attachment.mappedCount, 1)
  assert.equal(attachment.missingCount, 1)

  const bunny = reconcileBunnyReferences([
    { libraryId: '581531', videoGuid: '56266f09-d651-4bc5-a5b0-ac9185018018', sourceType: 'post_meta', sourcePostId: '11' },
    { libraryId: '581531', videoGuid: '00000000-0000-0000-0000-000000000000', sourceType: 'post_message', sourcePostId: '12' },
  ], {
    library: { id: 581531 },
    videos: [
      { video_guid: '56266f09-d651-4bc5-a5b0-ac9185018018', status: 'resolution_finished', library_id: 581531 },
      { video_guid: '11111111-1111-1111-1111-111111111111', status: 'resolution_finished', library_id: 581531 },
      { video_guid: '22222222-2222-2222-2222-222222222222', status: 'failed', library_id: 581531 },
    ],
  })
  assert.deepEqual(bunny.matchedGuids, ['56266f09-d651-4bc5-a5b0-ac9185018018'])
  assert.deepEqual(bunny.missingGuids, ['00000000-0000-0000-0000-000000000000'])
  assert.deepEqual(bunny.unreferencedInventoryGuids, ['11111111-1111-1111-1111-111111111111'])

  const outside = path.join(os.tmpdir(), 'jpv-dry-run-output.json')
  assert.equal(assertPiiOutputOutsideRepo(outside).startsWith(os.tmpdir()), true)
  assert.throws(() => assertPiiOutputOutsideRepo(path.join(process.cwd(), 'tmp', 'pii.json')), /PII_OUTPUT_MUST_BE_OUTSIDE_REPOSITORY/)
}

function testStrictSourceContentExpectations(): void {
  const snapshot = buildLegacySqlSnapshot(buildSyntheticSql())
  const normalization = buildLegacyDryRunNormalization(snapshot, buildStripeEvidence())
  const root = mkdtempSync(path.join(os.tmpdir(), 'jpv-source-count-fixture-'))
  writeFileSync(path.join(root, 'photo.jpg'), Buffer.from('photo'))
  const manifest = buildLocalMediaManifest(root)
  const wxr = parseWordPressWxr(`<?xml version="1.0"?><rss><channel>
    <item><title>Photo</title><wp:post_id>9</wp:post_id><wp:post_parent>0</wp:post_parent><wp:status>inherit</wp:status><wp:post_type>attachment</wp:post_type><wp:attachment_url>https://portal.example/wp-content/uploads/photo.jpg</wp:attachment_url></item>
  </channel></rss>`)

  const expected = {
    wordpressUsers: 48,
    wordpressAdministrators: 0,
    fluentCrmContacts: 48,
    spaces: 6,
    spaceMemberships: 2,
    courses: 1,
    courseSections: 1,
    courseLessons: 1,
    feedPosts: 1,
    comments: 1,
    reactions: 2,
    lessonCompletions: 1,
    courseCompletions: 1,
    communityMedia: 1,
    wxrItems: 1,
    wxrAttachments: 1,
    localMediaFiles: 1,
  }

  assert.doesNotThrow(() => assertRealSourceContentExpectations(snapshot, normalization, wxr, manifest, expected))
  assert.throws(
    () => assertRealSourceContentExpectations(snapshot, normalization, wxr, manifest, { ...expected, comments: 2 }),
    /LEGACY_SOURCE_CONTENT_EXPECTATION_FAILED comments expected=2 actual=1/,
  )
}

const tests: Array<[string, () => void]> = [
  ['phpMyAdmin SQL parser handles repeated INSERTs and quoted content', testSqlParser],
  ['WordPress WXR parser preserves attachment identity', testWxrParser],
  ['local media manifest excludes executable/control files', testMediaManifest],
  ['identity crosswalk + normalization enforce the current migration policy', testIdentityAndNormalization],
  ['attachment/Bunny reconciliation and PII output guards are fail-closed', testReconciliationAndOutputGuards],
  ['strict source-content expectations fail closed on unexplained count drift', testStrictSourceContentExpectations],
]

let failed = 0
for (const [name, fn] of tests) {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${name}`)
    console.error(error)
  }
}

if (failed > 0) process.exitCode = 1
else console.log(`Legacy source dry-run contract: PASS (${tests.length}/${tests.length})`)
