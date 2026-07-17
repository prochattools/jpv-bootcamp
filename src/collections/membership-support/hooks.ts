function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function normalizeEmail(value: unknown): string | undefined {
  const normalized = normalizeText(value)?.toLowerCase()
  if (!normalized) return undefined
  return normalized.includes('@') ? normalized : undefined
}

function joinParts(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' - ')
}

export function displayNameHookFromFields({
  prefix,
  fields,
}: {
  prefix: string
  fields: Array<{ name: string; label?: string }>
}) {
  return ({ value, siblingData }: { value?: unknown; siblingData?: Record<string, unknown> }) => {
    const current = normalizeText(value)
    if (current) return current

    const parts = fields.map((field) => {
      const raw = siblingData?.[field.name]
      return field.name.toLowerCase().includes('email') ? normalizeEmail(raw) : normalizeText(raw)
    })

    const label = joinParts(parts)
    return label ? `${prefix} - ${label}` : prefix
  }
}

export function normalizeMembershipSupportEmail(value: unknown): string | undefined {
  return normalizeEmail(value)
}

export function normalizeMembershipSupportText(value: unknown): string | undefined {
  return normalizeText(value)
}
