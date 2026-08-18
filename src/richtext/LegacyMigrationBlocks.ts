import type { Block } from 'payload'

export interface LegacyHTMLBlockFields {
  id: string
  blockName?: string | null
  blockType: 'legacyHTML'
  html: string
  safeHtml: string
  reason: string
  sourceTag?: string | null
}

export interface BunnyVideoBlockFields {
  id: string
  blockName?: string | null
  blockType: 'bunnyVideo'
  videoGuid: string
  libraryId: number
  title?: string | null
  sourceUrl?: string | null
}

/**
 * Fail-closed preservation block for legacy fragments that cannot yet be represented
 * losslessly by Payload/Lexical. The HTML is stored inertly and is never executed.
 */
export const LegacyHTMLBlock: Block = {
  slug: 'legacyHTML',
  interfaceName: 'LegacyHTMLBlock',
  labels: {
    singular: 'Legacy HTML',
    plural: 'Legacy HTML fragments',
  },
  fields: [
    {
      name: 'html',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Inert source HTML preserved by migration. Do not execute scripts from this field.',
      },
    },
    {
      name: 'safeHtml',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Sanitized display HTML derived from the source fragment. The exact source remains in html.',
        readOnly: true,
      },
    },
    {
      name: 'reason',
      type: 'text',
      required: true,
    },
    {
      name: 'sourceTag',
      type: 'text',
    },
  ],
}

/** Inline-in-document Bunny Stream block keyed by the canonical provider GUID. */
export const BunnyVideoBlock: Block = {
  slug: 'bunnyVideo',
  interfaceName: 'BunnyVideoBlock',
  labels: {
    singular: 'Bunny video',
    plural: 'Bunny videos',
  },
  fields: [
    {
      name: 'videoGuid',
      type: 'text',
      required: true,
      admin: {
        description: 'Canonical Bunny Stream GUID. Numeric provider IDs are legacy compatibility only.',
      },
    },
    {
      name: 'libraryId',
      type: 'number',
      required: true,
      defaultValue: 581531,
    },
    {
      name: 'title',
      type: 'text',
    },
    {
      name: 'sourceUrl',
      type: 'text',
      admin: {
        description: 'Original legacy embed URL retained for migration provenance.',
      },
    },
  ],
}

export const legacyMigrationRichTextBlocks = [LegacyHTMLBlock, BunnyVideoBlock]
