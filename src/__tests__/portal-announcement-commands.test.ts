import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  archivePortalAnnouncementCommand,
  deletePortalAnnouncementCommand,
  getPortalAdminUpdateCommand,
  listPortalAdminUpdates,
  updatePortalAnnouncementCommand,
} from '@/lib/portalAdmin/announcementCommands'

type Doc = { id: string; [key: string]: unknown }

function matchesWhere(document: Doc, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) return where.and.every((condition) => matchesWhere(document, condition as Record<string, unknown>))
  return Object.entries(where).every(([field, condition]) => {
    const rule = condition as Record<string, unknown>
    if (rule.equals !== undefined) return String(document[field]) === String(rule.equals)
    return true
  })
}

class FakePayload {
  constructor(readonly collections: Record<string, Doc[]>) {}

  async find(args: { collection: string; where?: Record<string, unknown> }) {
    return { docs: (this.collections[args.collection] ?? []).filter((document) => matchesWhere(document, args.where)) }
  }

  async findByID(args: { collection: string; id: string }) {
    return (this.collections[args.collection] ?? []).find((document) => String(document.id) === String(args.id)) ?? null
  }

  async update(args: { collection: string; id?: string; where?: Record<string, unknown>; data: Record<string, unknown> }) {
    const documents = this.collections[args.collection] ?? []
    const matches = args.where
      ? documents.filter((document) => matchesWhere(document, args.where))
      : documents.filter((document) => String(document.id) === String(args.id))
    if (args.where) {
      if (matches.length !== 1) return { docs: [] }
      Object.assign(matches[0], args.data, { updatedAt: 'updated-at' })
      return { docs: [matches[0]] }
    }
    if (!matches[0]) throw new Error('missing update target')
    Object.assign(matches[0], args.data, { updatedAt: 'updated-at' })
    return matches[0]
  }

  async create(args: { collection: string; data: Record<string, unknown> }) {
    const document = { id: `audit-${(this.collections[args.collection] ?? []).length + 1}`, ...args.data }
    this.collections[args.collection] = [...(this.collections[args.collection] ?? []), document]
    return document
  }

  async delete(args: { collection: string; id?: string; where?: Record<string, unknown> }) {
    const documents = this.collections[args.collection] ?? []
    const matching = args.where
      ? documents.filter((document) => matchesWhere(document, args.where))
      : documents.filter((document) => String(document.id) === String(args.id))
    this.collections[args.collection] = documents.filter((document) => !matching.includes(document))
    return { docs: matching }
  }
}

const lexical = {
  root: {
    type: 'root',
    children: [{
      type: 'paragraph',
      children: [{ type: 'text', text: 'Original update', format: 0, version: 1 }],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    }],
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
  },
}

describe('portal announcement administration', () => {
  it('lists every status and supports edit, archive, and confirmed delete', async () => {
    const payload = new FakePayload({
      payload_posts: [
        { id: 'post-1', title: 'Published update', slug: 'published-update', excerpt: 'Original', content: lexical, status: 'published', audience: 'all', publishedAt: '2026-09-01T10:00:00.000Z', updatedAt: 'before-update' },
        { id: 'post-2', title: 'Draft update', slug: 'draft-update', content: lexical, status: 'draft', audience: 'selected', targetMemberIds: ['member-1'], updatedAt: 'draft-update' },
        { id: 'post-3', title: 'Archived update', slug: 'archived-update', content: lexical, status: 'archived', audience: 'all', updatedAt: 'archived-update' },
      ],
      payload_audit_events: [],
    })

    const allUpdates = await listPortalAdminUpdates(payload as never)
    expect(allUpdates).toHaveLength(3)
    expect(allUpdates.map((update) => update.id)).toEqual(['post-1', 'post-2', 'post-3'])
    expect(allUpdates.every((update) => update.bodyHtml === null)).toBe(true)
    expect((await getPortalAdminUpdateCommand(payload as never, 'post-1')).bodyHtml).toContain('Original update')

    const edited = await updatePortalAnnouncementCommand(payload as never, 'admin-1', 'post-1', {
      title: 'Edited update',
      bodyHtml: '<p>Edited update with <a href="https://example.test">a link</a>.</p>',
      expectedUpdatedAt: 'before-update',
    })
    expect(edited.title).toBe('Edited update')
    expect(edited.status).toBe('published')
    expect(edited.bodyHtml).toContain('Edited update')

    await expect(updatePortalAnnouncementCommand(payload as never, 'admin-1', 'post-1', {
      title: 'Stale edit',
      bodyHtml: '<p>This must not overwrite the newer update.</p>',
      expectedUpdatedAt: 'before-update',
    })).rejects.toMatchObject({ code: 'conflict' })

    const archived = await archivePortalAnnouncementCommand(payload as never, 'admin-1', 'post-2', 'draft-update')
    expect(archived.status).toBe('archived')

    await expect(deletePortalAnnouncementCommand(payload as never, 'admin-1', 'post-3', false)).rejects.toMatchObject({ code: 'invalid_input' })
    await deletePortalAnnouncementCommand(payload as never, 'admin-1', 'post-3', true, 'archived-update')
    expect(await payload.findByID({ collection: 'payload_posts', id: 'post-3' })).toBeNull()
    expect(payload.collections.payload_audit_events.map((event) => event.action)).toEqual([
      'portal_update.updated',
      'portal_update.archived',
      'portal_update.deleted',
    ])
  })
})
