import assert from 'node:assert/strict'

import { auditJPVRemainingParity } from './auditJPVRemainingParity'
import type { LegacyDryRunNormalization, LegacySqlSnapshot } from './legacySourceDryRun'

function snapshot(): LegacySqlSnapshot {
  return {
    wordpressUsers: [
      { id: '1', email: 'a@example.invalid', displayName: 'A', role: 'subscriber' },
      { id: '2', email: 'b@example.invalid', displayName: 'B', role: 'subscriber' },
    ],
    fluentCrmContacts: [],
    communityProfiles: [],
    portalSettingsSource: {
      fluentCommunitySettingsRaw: null,
      authSettingsRaw: null,
      customizationSettingsRaw: 'a:1:{s:18:"member_list_layout";s:4:"grid";}',
      welcomeBannerSettingsRaw: null,
      snippetsSettingsRaw: null,
    },
    spaces: [],
    posts: [],
    comments: [],
    reactions: [
      { id: 'r1', userId: '1', objectId: 'p1', parentId: null, objectType: 'feed', type: 'like', createdAt: null },
      { id: 'r2', userId: '2', objectId: 'c1', parentId: null, objectType: 'comment', type: 'like', createdAt: null },
      { id: 'r3', userId: '2', objectId: 'l1', parentId: null, objectType: 'lesson_completed', type: 'completed', createdAt: null },
    ],
    spaceMemberships: [],
    communityMedia: [],
    activities: [],
  }
}

function normalization(): LegacyDryRunNormalization {
  return {
    identity: {
      sourceMemberAccountCount: 2,
      canonicalMemberCount: 2,
      activeCount: 2,
      blockedCount: 0,
      members: [
        {
          canonicalKey: 'a', canonicalWpUserId: '1', sourceWpUserIds: ['1'], canonicalEmail: 'a@example.invalid', displayName: 'A', sourceEmails: ['a@example.invalid'], fluentCrmContactIds: [], stripeCustomerIds: [], stripeSubscriptionIds: [], accountStatus: 'active', classificationReason: 'test', conflicts: [],
        },
        {
          canonicalKey: 'b', canonicalWpUserId: '2', sourceWpUserIds: ['2'], canonicalEmail: 'b@example.invalid', displayName: 'B', sourceEmails: ['b@example.invalid'], fluentCrmContactIds: [], stripeCustomerIds: [], stripeSubscriptionIds: [], accountStatus: 'active', classificationReason: 'test', conflicts: [],
        },
      ],
      orphanStripeRecords: [],
    },
    courses: [],
    courseSections: [],
    courseLessons: [],
    communitySpaces: [],
    navigationOnlySpaces: [],
    excludedFunctionalSpaces: [],
    spaceMemberships: [],
    feedPosts: [
      { id: 'p1', userId: '1', parentId: null, spaceId: 's1', title: null, slug: null, message: null, messageRendered: null, type: 'feed', contentType: 'text', privacy: 'members', status: 'published', featuredImage: null, meta: null, isSticky: false, priority: 0, createdAt: null },
    ],
    comments: [
      { id: 'c1', userId: '2', postId: 'p1', parentId: null, message: null, messageRendered: null, meta: null, type: 'comment', contentType: 'text', status: 'published', isSticky: false, createdAt: null },
    ],
    communityReactions: [
      { id: 'r1', userId: '1', objectId: 'p1', parentId: null, objectType: 'feed', type: 'like', createdAt: null },
      { id: 'r2', userId: '2', objectId: 'c1', parentId: null, objectType: 'comment', type: 'like', createdAt: null },
    ],
    lessonCompletedReactions: [
      { id: 'r3', userId: '2', objectId: 'l1', parentId: null, objectType: 'lesson_completed', type: 'completed', createdAt: null },
    ],
    courseCompletedActivities: [],
    bunnyReferences: [],
    communityMedia: [],
  }
}

const report = auditJPVRemainingParity(snapshot(), normalization())

assert.equal(report.mutationMode, 'none')
assert.equal(report.containsPii, false)
assert.equal(report.reactions.totalReactionProgressRows, 3)
assert.equal(report.reactions.communityReactionRows, 2)
assert.equal(report.reactions.lessonCompletionProgressRows, 1)
assert.equal(report.reactions.feedPostReactionRows, 1)
assert.equal(report.reactions.commentReactionRows, 1)
assert.equal(report.reactions.lessonSpecificSocialReactionRowsExcludingCompletion, 0)
assert.equal(report.reactions.matchedMigratedPostReactions, 1)
assert.equal(report.reactions.matchedMigratedCommentReactions, 1)
assert.equal(report.reactions.orphanCommunityTargetObjectRows, 0)
assert.equal(report.reactions.actorSourceUserResolvableRows, 3)
assert.equal(report.reactions.actorCanonicalMemberResolvableRows, 3)
assert.equal(report.reactions.everyCommunityReactionHasMigratedTarget, true)
assert.deepEqual(report.reactions.countsByObjectType, { comment: 1, feed: 1, lesson_completed: 1 })
assert.deepEqual(report.reactions.countsByReactionType, { completed: 1, like: 2 })

assert.equal(report.memberDirectoryPublicProfile.memberListLayoutKeyPresent, true)
assert.equal(report.memberDirectoryPublicProfile.directoryEnablementKeyPresent, false)
assert.equal(report.memberDirectoryPublicProfile.publicProfileKeyPresent, false)
assert.equal(report.memberDirectoryPublicProfile.classification, 'ambiguous')
assert.equal(report.memberDirectoryPublicProfile.targetAccountProfileEditorExists, true)
assert.equal(report.memberDirectoryPublicProfile.targetMemberDirectoryRouteExists, false)
assert.equal(report.memberDirectoryPublicProfile.newSchemaRequiredIfImplemented, 'no')

process.stdout.write('auditJPVRemainingParity.test.ts: all assertions passed\n')
