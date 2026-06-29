export type {
  MemberCommunityAttachmentResolution,
  MemberCommunityExternalVideo,
  MemberCommunityFile,
  MemberCommunityFileDownload,
  MemberCommunityFileDownloadDenied,
  MemberCommunityPrivateVideo,
  MemberCommunityProtectedFile,
} from '@/lib/payloadCourse/communityFiles'

export {
  getMemberCommunityFiles,
  resolveMemberCommunityAttachment,
  resolveMemberCommunityFileDownload,
} from '@/lib/payloadCourse/communityFiles'
