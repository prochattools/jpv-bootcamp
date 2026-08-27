import { describe, expect, it } from 'vitest'

import { plainTextToLexical } from '@/lib/content/plainTextToLexical'
import { normalizeRecordId, normalizeSlug, boundedText, validateTitle } from '@/lib/domain/validation'
import { normalizeRelationshipId, relationshipId } from '@/lib/domain/relationships'

describe('shared domain validation primitives', () => {
  it('normalizes slugs and rejects empty or excessive values', () => {
    expect(normalizeSlug('  Hello, World! ')).toBe('hello-world')
    expect(() => normalizeSlug(' ')).toThrow('Slug must be at least 2 characters.')
    expect(() => normalizeSlug('a'.repeat(101))).toThrow('Slug is too long.')
  })

  it('trims titles and enforces required and maximum length rules', () => {
    expect(validateTitle('  Course title  ')).toBe('Course title')
    expect(() => validateTitle(' \n ')).toThrow('Title is required.')
    expect(() => validateTitle('a'.repeat(201))).toThrow('Title is too long.')
  })

  it('trims bounded text and rejects empty or excessive values', () => {
    expect(boundedText('  useful text  ', 'Body', 20)).toBe('useful text')
    expect(() => boundedText(' ', 'Body', 20)).toThrow('Body is required.')
    expect(() => boundedText('a'.repeat(21), 'Body', 20)).toThrow('Body is too long.')
  })

  it('normalizes direct and populated relationship IDs consistently', () => {
    expect(normalizeRecordId('  member-1 ')).toBe('member-1')
    expect(normalizeRecordId(42)).toBe('42')
    expect(relationshipId('  member-1 ')).toBe('member-1')
    expect(relationshipId(42)).toBe('42')
    expect(relationshipId({ id: 42 })).toBe('42')
    expect(relationshipId({ id: 'member-1' })).toBe('member-1')
    expect(relationshipId(null)).toBeNull()
    expect(relationshipId({})).toBeNull()
    expect(relationshipId([])).toBeNull()
    expect(normalizeRelationshipId('42')).toBe(42)
    expect(normalizeRelationshipId('member-1')).toBe('member-1')
    expect(() => normalizeRelationshipId(null)).toThrow('Relationship ID is required')
  })
})

describe('plain text Lexical primitive', () => {
  it('is deterministic and emits one bounded Payload Lexical shape', () => {
    const first = plainTextToLexical(' First paragraph \n\nSecond paragraph\nThird paragraph ', {
      maxParagraphs: 2,
    })
    const second = plainTextToLexical(' First paragraph \n\nSecond paragraph\nThird paragraph ', {
      maxParagraphs: 2,
    })

    expect(first).toEqual(second)
    expect(first.root.type).toBe('root')
    expect(first.root.direction).toBe('ltr')
    expect(first.root.children).toHaveLength(2)
    expect(first.root.children.map((node) => node.children[0]?.text)).toEqual([
      'First paragraph',
      'Second paragraph',
    ])
    expect(first.root.children.every((node) => node.type === 'paragraph')).toBe(true)
    expect(plainTextToLexical('123456789', { maxCharacters: 5 }).root.children[0]?.children[0]?.text).toBe('12345')
    expect(plainTextToLexical('body', { appendText: 'Video: https://example.com' }).root.children).toHaveLength(2)
  })
})
