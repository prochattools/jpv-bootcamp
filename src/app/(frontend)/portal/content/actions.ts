'use server'

import { revalidatePath } from 'next/cache'

import { requirePortalAdmin } from '@/lib/auth/requirePortalAdmin'
import {
  normalizePortalAdminError,
  success,
  type PortalAdminActionResult,
} from '@/lib/portalAdmin/actionResult'
import {
  archivePortalAnnouncementCommand,
  deletePortalAnnouncementCommand,
  getPortalAdminUpdateCommand,
  updatePortalAnnouncementCommand,
  type PortalAdminUpdateSummary,
  type PortalAnnouncementUpdateInput,
} from '@/lib/portalAdmin/announcementCommands'

type Result = PortalAdminActionResult<PortalAdminUpdateSummary | null>

export async function getPortalAnnouncementAction(postId: string): Promise<Result> {
  try {
    const { payload } = await requirePortalAdmin('/portal/content')
    return success(await getPortalAdminUpdateCommand(payload, postId))
  } catch (error) {
    return normalizePortalAdminError(error, 'getPortalAnnouncementAction')
  }
}

export async function updatePortalAnnouncementAction(
  postId: string,
  input: PortalAnnouncementUpdateInput,
): Promise<Result> {
  try {
    const { actor, payload } = await requirePortalAdmin('/portal/content')
    const update = await updatePortalAnnouncementCommand(payload, actor.administratorId, postId, input)
    revalidatePath('/portal/content')
    revalidatePath(`/portal/posts/${update.slug}`)
    return success(update)
  } catch (error) {
    return normalizePortalAdminError(error, 'updatePortalAnnouncementAction')
  }
}

export async function archivePortalAnnouncementAction(
  postId: string,
  expectedUpdatedAt?: string | null,
): Promise<Result> {
  try {
    const { actor, payload } = await requirePortalAdmin('/portal/content')
    const update = await archivePortalAnnouncementCommand(payload, actor.administratorId, postId, expectedUpdatedAt)
    revalidatePath('/portal/content')
    revalidatePath(`/portal/posts/${update.slug}`)
    return success(update)
  } catch (error) {
    return normalizePortalAdminError(error, 'archivePortalAnnouncementAction')
  }
}

export async function deletePortalAnnouncementAction(postId: string, confirmed: boolean, expectedUpdatedAt?: string | null): Promise<Result> {
  try {
    const { actor, payload } = await requirePortalAdmin('/portal/content')
    await deletePortalAnnouncementCommand(payload, actor.administratorId, postId, confirmed, expectedUpdatedAt)
    revalidatePath('/portal/content')
    return success(null)
  } catch (error) {
    return normalizePortalAdminError(error, 'deletePortalAnnouncementAction')
  }
}
