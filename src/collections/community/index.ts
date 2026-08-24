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
]
