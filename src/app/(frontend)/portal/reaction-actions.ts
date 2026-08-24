'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import {
  ReactionServiceError,
  setReaction,
  type ReactionTargetKind,
  type PayloadReactionWriteAPI,
} from '@/lib/payloadCourse/reactions'

function textValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function portalPath(value: string): string {
  if (!/^\/portal(?:\/|$)/.test(value) || value.includes('\n') || value.includes('\r')) {
    throw new ReactionServiceError('target_not_found', 'Reaction destination is invalid.')
  }
  return value
}

function targetKind(value: string): ReactionTargetKind {
  if (value === 'space_post' || value === 'space_comment' || value === 'lesson_comment') return value
  throw new ReactionServiceError('target_not_found', 'Reaction target was not found.')
}

function reasonFor(error: unknown): string {
  if (error instanceof ReactionServiceError) return error.code
  return 'service_unavailable'
}

export async function submitReactionAction(formData: FormData): Promise<void> {
  const destination = portalPath(textValue(formData, 'redirectPath'))
  const targetId = textValue(formData, 'targetId')
  const reactionType = textValue(formData, 'reactionType')
  const kind = targetKind(textValue(formData, 'targetKind'))

  if (!targetId || !reactionType) {
    redirect(`${destination}?reaction=error&reason=target_not_found`)
  }

  const { memberId, payload } = await requirePortalMember(destination)

  let mutation: Awaited<ReturnType<typeof setReaction>>
  try {
    mutation = await setReaction(
      payload as PayloadReactionWriteAPI,
      memberId,
      { kind, id: targetId },
      reactionType,
    )
  } catch (error) {
    console.error('[submitReactionAction] reaction error:', error instanceof Error ? error.message : String(error))
    redirect(`${destination}?reaction=error&reason=${reasonFor(error)}`)
  }

  revalidatePath(destination)
  redirect(`${destination}?reaction=${mutation.operation}`)
}
