import { PayloadMemberVerificationRecords } from './MemberEmailVerificationRecords'
import {
  PayloadMemberProfiles,
  PayloadMembers,
  PayloadMemberSecurityEvents,
} from './Members'

export {
  PayloadMemberProfiles,
  PayloadMembers,
  PayloadMemberSecurityEvents,
  PayloadMemberVerificationRecords,
}

export const memberCollections = [
  PayloadMembers,
  PayloadMemberProfiles,
  PayloadMemberSecurityEvents,
  PayloadMemberVerificationRecords,
]
