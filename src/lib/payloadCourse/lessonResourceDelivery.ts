import path from 'node:path'

const SAFE_RESOURCE_ID = /^[A-Za-z0-9_-]+$/
const FALLBACK_MIME_TYPE = 'application/octet-stream'

export function isSafeResourceId(value: string): boolean {
  if (!value || value === '.' || value === '..') return false
  if (value.includes('/') || value.includes('\\') || value.includes('\0')) return false

  try {
    const decoded = decodeURIComponent(value)
    if (decoded !== value) return false
  } catch {
    return false
  }

  return SAFE_RESOURCE_ID.test(value)
}

export function sanitizeDownloadFilename(value: string): string {
  const basename = value.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? 'download'
  const withoutControls = basename.replace(/[\u0000-\u001F\u007F]/g, '')
  const safe = withoutControls.replace(/["<>:|?*]/g, '_').trim()
  return safe || 'download'
}

export function resolveSafeStoredFilePath(root: string, filename: string): string | null {
  if (!filename || filename === '.' || filename === '..') return null
  if (filename.includes('/') || filename.includes('\\')) return null
  if (/[\u0000-\u001F\u007F]/.test(filename)) return null

  const safeFilename = sanitizeDownloadFilename(filename)
  if (safeFilename !== filename) return null

  const resolvedRoot = path.resolve(root)
  const resolvedFile = path.resolve(resolvedRoot, safeFilename)
  if (path.dirname(resolvedFile) !== resolvedRoot) return null

  return resolvedFile
}

function encodeRFC5987(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

export function buildAttachmentContentDisposition(filename: string): string {
  const safeFilename = sanitizeDownloadFilename(filename)
  const asciiFilename = safeFilename
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/["\\]/g, '_') || 'download'

  return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeRFC5987(safeFilename)}`
}

export function safeMimeType(value: string | null | undefined): string {
  if (!value) return FALLBACK_MIME_TYPE
  const normalized = value.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(normalized)) {
    return FALLBACK_MIME_TYPE
  }
  return normalized
}
