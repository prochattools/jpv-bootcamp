'use server'

import { revalidatePath } from 'next/cache'

import { requirePortalAdmin } from '@/lib/auth/requirePortalAdmin'
import {
  normalizePortalAdminError,
  success,
  type PortalAdminActionResult,
} from '@/lib/portalAdmin/actionResult'
import {
  archiveMemberGroupCommand,
  createMemberGroupCommand,
  deleteMemberGroupCommand,
  updateMemberGroupCommand,
  type MemberGroupInput,
  type MemberGroupSummary,
} from '@/lib/portalAdmin/memberGroupCommands'

type Result = PortalAdminActionResult<MemberGroupSummary | null>

export async function createMemberGroupAction(input: MemberGroupInput): Promise<Result> {
  try {
    const { payload, actor } = await requirePortalAdmin('/portal/members')
    const group = await createMemberGroupCommand(payload, actor.administratorId, input)
    revalidatePath('/portal/members')
    revalidatePath('/portal/content')
    revalidatePath('/portal/rooms')
    return success(group)
  } catch (error) {
    return normalizePortalAdminError(error, 'createMemberGroupAction')
  }
}

export async function updateMemberGroupAction(groupId: string, input: MemberGroupInput): Promise<Result> {
  try {
    const { payload, actor } = await requirePortalAdmin('/portal/members')
    const group = await updateMemberGroupCommand(payload, actor.administratorId, groupId, input)
    revalidatePath('/portal/members')
    revalidatePath('/portal/content')
    revalidatePath('/portal/rooms')
    return success(group)
  } catch (error) {
    return normalizePortalAdminError(error, 'updateMemberGroupAction')
  }
}

export async function archiveMemberGroupAction(groupId: string, expectedUpdatedAt?: string | null): Promise<Result> {
  try {
    const { payload, actor } = await requirePortalAdmin('/portal/members')
    const group = await archiveMemberGroupCommand(payload, actor.administratorId, groupId, expectedUpdatedAt)
    revalidatePath('/portal/members')
    revalidatePath('/portal/content')
    revalidatePath('/portal/rooms')
    return success(group)
  } catch (error) {
    return normalizePortalAdminError(error, 'archiveMemberGroupAction')
  }
}

export async function deleteMemberGroupAction(groupId: string, confirmed: boolean): Promise<Result> {
  try {
    const { payload, actor } = await requirePortalAdmin('/portal/members')
    await deleteMemberGroupCommand(payload, actor.administratorId, groupId, confirmed)
    revalidatePath('/portal/members')
    return success(null)
  } catch (error) {
    return normalizePortalAdminError(error, 'deleteMemberGroupAction')
  }
}
