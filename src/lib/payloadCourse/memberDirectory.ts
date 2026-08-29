import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

import type { PayloadCourseAccessAPI, PayloadDocument } from './accessService'
import { projectCommunityRichText, type SafeCommunityRichTextNode } from './communityDiscussion'
import { relationshipId } from '@/lib/domain/relationships'

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

function fallbackDisplayName(member: PayloadDocument): string {
  const email = typeof member.email === 'string' ? member.email.trim() : ''
  const localPart = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ?? ''
  if (!localPart) return 'Member'
  return localPart
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

async function findAll(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where?: Record<string, unknown>,
  depth = 0,
): Promise<PayloadDocument[]> {
  const docs: PayloadDocument[] = []
  let page = 1
  do {
    const result = await payload.find({ collection, where, limit: 100, page, depth, overrideAccess: true })
    docs.push(...(result.docs as PayloadDocument[]))
    if (!result.hasNextPage) break
    page += 1
    if (page > 1000) throw new Error(`member_directory_${collection}_page_limit_exceeded`)
  } while (true)
  return docs
}

function profileMemberId(profile: PayloadDocument): string | null {
  return relationshipId(profile.member)
}

function profileForMember(profiles: PayloadDocument[], memberId: string): PayloadDocument | null {
  return profiles.find((profile) => profileMemberId(profile) === memberId) ?? null
}

function displayNameForMember(member: PayloadDocument, profile: PayloadDocument | null): string {
  return typeof profile?.displayName === 'string' && profile.displayName.trim()
    ? profile.displayName.trim()
    : fallbackDisplayName(member)
}

export async function listActiveMembers(payload?: PayloadCourseAccessAPI): Promise<MemberDirectoryItem[]> {
  const payloadClient = payload ?? await getPayload({ config })
  const [activeMembers, profiles] = await Promise.all([
    findAll(payloadClient, 'payload_members', { accountStatus: { equals: 'active' } }),
    findAll(payloadClient, 'payload_member_profiles', undefined, 1),
  ])

  return activeMembers.map((member) => {
    const memberId = String(member.id)
    const profile = profileForMember(profiles, memberId)
    return {
      memberId,
      displayName: displayNameForMember(member, profile),
      avatarUrl: mediaUrl(profile?.avatar),
      isAdministrator: Boolean(member.isAdministrator),
    }
  })
}

export async function getMemberProfileDetail(memberId: string): Promise<MemberProfileDetail | null> {
  const payload = await getPayload({ config })
  const [profileResult, member] = await Promise.all([
    payload.find({
      collection: 'payload_member_profiles',
      depth: 1,
      limit: 1,
      where: {
        member: { equals: memberId },
      },
      overrideAccess: true,
    }),
    payload.findByID({ collection: 'payload_members', id: memberId, depth: 0, overrideAccess: true }).catch((): null => null),
  ])
  if (!member || member.accountStatus !== 'active') return null

  const doc = (profileResult.docs[0] as unknown as PayloadDocument | undefined) ?? null

  return {
    memberId,
    displayName: displayNameForMember(member as unknown as PayloadDocument, doc),
    avatarUrl: mediaUrl(doc?.avatar),
    coverImageUrl: mediaUrl(doc?.coverImage),
    biography: doc?.biography && typeof doc.biography === 'object' ? projectCommunityRichText(doc.biography) : null,
    website: typeof doc?.website === 'string' && doc.website.trim() ? doc.website.trim() : null,
    socialLinks: {
      instagram: socialLinkText(doc?.socialLinks, 'instagram'),
      twitter: socialLinkText(doc?.socialLinks, 'twitter'),
      linkedin: socialLinkText(doc?.socialLinks, 'linkedin'),
      facebook: socialLinkText(doc?.socialLinks, 'facebook'),
      youtube: socialLinkText(doc?.socialLinks, 'youtube'),
    },
  }
}
