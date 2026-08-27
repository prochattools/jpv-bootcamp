import type { AdminActor, MemberActor, PortalActor } from '@/lib/auth/portalActor'

/**
 * Pure actor policy for the community mutation boundary.
 *
 * An administrator may also have a linked portal member profile, but that
 * identity link never changes the actor's authority category. This keeps
 * administrator moderation explicit and prevents a linked profile from
 * accidentally granting member ownership semantics to another path.
 */
export function isCommunityAdminActor(actor: PortalActor): actor is AdminActor {
  return actor.kind === 'admin'
}

export function isCommunityMemberActor(actor: PortalActor): actor is MemberActor {
  return actor.kind === 'member'
}

export function canEditCommunityPost(actor: PortalActor, postAuthorId: string | null): boolean {
  return isCommunityAdminActor(actor) || (isCommunityMemberActor(actor) && postAuthorId === actor.memberId)
}

export function canDeleteCommunityPost(actor: PortalActor, postAuthorId: string | null): boolean {
  return canEditCommunityPost(actor, postAuthorId)
}

export function canEditCommunityComment(actor: PortalActor, commentAuthorId: string | null): boolean {
  return isCommunityAdminActor(actor) || (isCommunityMemberActor(actor) && commentAuthorId === actor.memberId)
}

export function canDeleteCommunityComment(actor: PortalActor, commentAuthorId: string | null): boolean {
  return canEditCommunityComment(actor, commentAuthorId)
}

export function canModerateCommunityPost(actor: PortalActor): boolean {
  return actor.kind === 'admin'
}

export function canModerateCommunityComment(actor: PortalActor): boolean {
  return actor.kind === 'admin'
}
