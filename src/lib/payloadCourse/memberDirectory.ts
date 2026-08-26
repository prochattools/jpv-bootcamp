import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

import { projectCommunityRichText, type SafeCommunityRichTextNode } from './communityDiscussion'

export interface MemberDirectoryItem {
  memberId: string
  displayName: string
  avatarUrl: string | null
  isAdministrator: boolean
}

export interface MemberProfileDetail {
  memberId: string
  displayName: string
  avatarUrl: string | null
  coverImageUrl: string | null
  biography: SafeCommunityRichTextNode | null
  website: string | null
  socialLinks: {
    instagram: string | null
    twitter: string | null
    linkedin: string | null
    facebook: string | null
    youtube: string | null
  }
}

function mediaUrl(media: unknown): string | null {
  if (!media || typeof media !== 'object') return null
  const m = media as Record<string, unknown>
  return typeof m.url === 'string' ? m.url : null
}

function socialLinkText(links: unknown, key: string): string | null {
  if (!links || typeof links !== 'object') return null
  const value = (links as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function listActiveMembers(): Promise<MemberDirectoryItem[]> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'payload_member_profiles',
    depth: 1,
    limit: 200,
    where: { 'member.accountStatus': { equals: 'active' } },
    overrideAccess: true,
    select: {
      member: true,
      displayName: true,
      avatar: true,
    },
  })
  return result.docs.map((doc) => {
    const member = doc.member as Record<string, unknown> | string | number | null
    const memberId = typeof member === 'object' && member !== null
      ? String((member as Record<string, unknown>).id ?? '')
      : String(member ?? '')
    return {
      memberId,
      displayName: String(doc.displayName ?? ''),
      avatarUrl: mediaUrl(doc.avatar),
      isAdministrator: Boolean(typeof member === 'object' && member !== null && (member as Record<string, unknown>).isAdministrator),
    }
  }).filter((item) => item.memberId && !item.isAdministrator)
}

export async function getMemberProfileDetail(memberId: string): Promise<MemberProfileDetail | null> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'payload_member_profiles',
    depth: 1,
    limit: 1,
    where: {
      and: [
        { member: { equals: memberId } },
        { 'member.accountStatus': { equals: 'active' } },
      ],
    },
    overrideAccess: true,
  })
  const doc = result.docs[0]
  if (!doc) return null

  return {
    memberId,
    displayName: String(doc.displayName ?? ''),
    avatarUrl: mediaUrl(doc.avatar),
    coverImageUrl: mediaUrl(doc.coverImage),
    biography: doc.biography && typeof doc.biography === 'object' ? projectCommunityRichText(doc.biography) : null,
    website: typeof doc.website === 'string' && doc.website.trim() ? doc.website.trim() : null,
    socialLinks: {
      instagram: socialLinkText(doc.socialLinks, 'instagram'),
      twitter: socialLinkText(doc.socialLinks, 'twitter'),
      linkedin: socialLinkText(doc.socialLinks, 'linkedin'),
      facebook: socialLinkText(doc.socialLinks, 'facebook'),
      youtube: socialLinkText(doc.socialLinks, 'youtube'),
    },
  }
}
