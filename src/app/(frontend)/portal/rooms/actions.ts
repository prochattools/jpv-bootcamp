'use server'

import { revalidatePath } from 'next/cache'

import { requirePortalAdmin } from '@/lib/auth/requirePortalAdmin'
import {
  failure,
  normalizePortalAdminError,
  success,
  type PortalAdminActionResult,
} from '@/lib/portalAdmin/actionResult'
import {
  archiveRoomCommand,
  createRoomCommand,
  deleteRoomCommand,
  transitionRoomCommand,
  updateRoomCommand,
  type RoomCommandResult,
  type RoomInput,
  type RoomUpdateInput,
} from '@/lib/rooms/roomCommands'

type RoomActionResult = PortalAdminActionResult<{
  id?: string
  addedMembers?: number
  removedMembers?: number
  warnings?: string[]
}>

function resultData(result: RoomCommandResult) {
  return {
    id: String(result.room.id),
    addedMembers: result.addedMembers,
    removedMembers: result.removedMembers,
    warnings: result.warnings,
  }
}

export async function createRoomAction(input: RoomInput): Promise<RoomActionResult> {
  try {
    const { actor, payload } = await requirePortalAdmin('/portal/rooms')
    const result = await createRoomCommand({
      payload,
      adminId: actor.administratorId,
      adminEmail: actor.email,
    }, input)
    revalidatePath('/portal/rooms')
    revalidatePath(`/portal/rooms/${String(result.room.id)}`)
    return success(resultData(result))
  } catch (error) {
    return normalizePortalAdminError(error, 'createRoomAction')
  }
}

export async function updateRoomAction(roomId: string, input: RoomUpdateInput): Promise<RoomActionResult> {
  try {
    const { actor, payload } = await requirePortalAdmin('/portal/rooms')
    const result = await updateRoomCommand({ payload, adminId: actor.administratorId, adminEmail: actor.email }, roomId, input)
    revalidatePath('/portal/rooms')
    revalidatePath(`/portal/rooms/${encodeURIComponent(roomId)}`)
    return success(resultData(result))
  } catch (error) {
    return normalizePortalAdminError(error, 'updateRoomAction')
  }
}

export async function transitionRoomAction(
  roomId: string,
  status: 'live' | 'completed' | 'cancelled',
  expectedUpdatedAt?: string | null,
): Promise<RoomActionResult> {
  try {
    const { actor, payload } = await requirePortalAdmin('/portal/rooms')
    const room = await transitionRoomCommand({ payload, adminId: actor.administratorId, adminEmail: actor.email }, roomId, status, expectedUpdatedAt)
    revalidatePath('/portal/rooms')
    revalidatePath(`/portal/rooms/${encodeURIComponent(roomId)}`)
    return success({ id: String(room.id) })
  } catch (error) {
    return normalizePortalAdminError(error, 'transitionRoomAction')
  }
}

export async function archiveRoomAction(roomId: string, expectedUpdatedAt?: string | null): Promise<RoomActionResult> {
  try {
    const { actor, payload } = await requirePortalAdmin('/portal/rooms')
    const room = await archiveRoomCommand({ payload, adminId: actor.administratorId, adminEmail: actor.email }, roomId, expectedUpdatedAt)
    revalidatePath('/portal/rooms')
    revalidatePath(`/portal/rooms/${encodeURIComponent(roomId)}`)
    return success({ id: String(room.id) })
  } catch (error) {
    return normalizePortalAdminError(error, 'archiveRoomAction')
  }
}

export async function deleteRoomAction(roomId: string, confirmed: boolean): Promise<RoomActionResult> {
  try {
    const { actor, payload } = await requirePortalAdmin('/portal/rooms')
    await deleteRoomCommand({ payload, adminId: actor.administratorId, adminEmail: actor.email }, roomId, confirmed)
    revalidatePath('/portal/rooms')
    return success({ id: roomId })
  } catch (error) {
    return normalizePortalAdminError(error, 'deleteRoomAction')
  }
}

export async function setRoomCategoryAction(
  categoryId: string,
  input: { name: string; slug?: string; status?: 'active' | 'archived'; sortOrder?: number; description?: string },
): Promise<RoomActionResult> {
  try {
    const { payload } = await requirePortalAdmin('/portal/rooms')
    const name = input.name.trim()
    if (!name) return failure('invalid_input', 'Category name is required.')
    const slug = (input.slug?.trim() || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!slug) return failure('invalid_input', 'Category slug is required.')
    const existing = await payload.find({ collection: 'payload_room_categories', where: { and: [{ slug: { equals: slug } }, ...(categoryId !== 'new' ? [{ id: { not_equals: categoryId } }] : [])] }, limit: 1, depth: 0, overrideAccess: true })
    if (existing.docs.length > 0) return failure('conflict', 'A Room category with this slug already exists.')
    if (categoryId !== 'new') {
      const category = await payload.findByID({ collection: 'payload_room_categories', id: categoryId, depth: 0, overrideAccess: true }).catch((): null => null)
      if (!category) return failure('not_found', 'Room category not found.')
      await payload.update({ collection: 'payload_room_categories', id: categoryId, data: { name, slug, status: input.status ?? category.status ?? 'active', sortOrder: input.sortOrder ?? category.sortOrder ?? 0, description: input.description?.trim() || undefined }, overrideAccess: true, overrideLock: true })
      revalidatePath('/portal/rooms')
      return success({ id: categoryId })
    }
    const category = await payload.create({ collection: 'payload_room_categories', data: { name, slug, status: input.status ?? 'active', sortOrder: input.sortOrder ?? 0, description: input.description?.trim() || undefined }, overrideAccess: true })
    revalidatePath('/portal/rooms')
    return success({ id: String(category.id) })
  } catch (error) {
    return normalizePortalAdminError(error, 'setRoomCategoryAction')
  }
}

export async function deleteRoomCategoryAction(categoryId: string, confirmed: boolean): Promise<RoomActionResult> {
  try {
    if (!confirmed) return failure('invalid_input', 'Deletion requires explicit confirmation.')
    const { payload } = await requirePortalAdmin('/portal/rooms')
    const references = await payload.find({ collection: 'live_sessions', where: { categories: { equals: categoryId } }, limit: 1, depth: 0, overrideAccess: true })
    if (references.docs.length > 0) return failure('dependency_blocked', 'This category is assigned to a Room. Archive it instead or remove the assignment first.')
    if (!payload.delete) return failure('internal_error', 'Category deletion is not available.')
    await payload.delete({ collection: 'payload_room_categories', id: categoryId, overrideAccess: true })
    revalidatePath('/portal/rooms')
    return success({ id: categoryId })
  } catch (error) {
    return normalizePortalAdminError(error, 'deleteRoomCategoryAction')
  }
}
