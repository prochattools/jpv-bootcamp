import {
  PayloadChatMessages,
  PayloadChatThreads,
  PayloadMemberGroups,
  PayloadSpaceComments,
  PayloadSpaceFiles,
  PayloadSpaceMemberships,
  PayloadSpacePosts,
  PayloadSpaceReactions,
  PayloadSpaces,
} from './Community'
import { PayloadEngagementReactions } from './EngagementReactions'
import { PayloadMemberNotifications } from './MemberNotifications'
import { PayloadMemberFollows } from './MemberFollows'

export {
  PayloadChatMessages,
  PayloadChatThreads,
  PayloadMemberGroups,
  PayloadSpaceComments,
  PayloadSpaceFiles,
  PayloadSpaceMemberships,
  PayloadSpacePosts,
  PayloadSpaceReactions,
  PayloadSpaces,
} from './Community'
export { PayloadEngagementReactions } from './EngagementReactions'
export { PayloadMemberNotifications } from './MemberNotifications'
export { PayloadMemberFollows } from './MemberFollows'

export const communityCollections = [
  PayloadMemberGroups,
  PayloadSpaces,
  PayloadSpaceMemberships,
  PayloadSpacePosts,
  PayloadSpaceComments,
  PayloadSpaceReactions,
  PayloadEngagementReactions,
  PayloadSpaceFiles,
  PayloadChatThreads,
  PayloadChatMessages,
  PayloadMemberNotifications,
  PayloadMemberFollows,
]
