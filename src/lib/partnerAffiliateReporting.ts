import type { PayloadCourseWriteAPI, PayloadDocument, PayloadId } from '@/lib/payloadCourse/accessService'

type ReportFilters = {
  partnerId?: string | null
  status?: string | null
  mode?: string | null
  createdAfter?: string | null
  createdBefore?: string | null
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function toCsvValue(value: unknown): string {
  const text = asString(value) ?? ''
  const escaped = text.replace(/"/g, '""')
  const formulaSafe = /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped
  return `"${formulaSafe}"`
}

async function findAll(
  payload: PayloadCourseWriteAPI,
  collection: string,
  where?: Record<string, unknown>
): Promise<PayloadDocument[]> {
  const result = await payload.find({
    collection,
    where,
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs
}

export async function buildPartnerAdminReport(
  payload: PayloadCourseWriteAPI,
  filters: ReportFilters
): Promise<{
  totals: {
    views: number
    clicks: number
    submissions: number
    uniqueMembers: number
    pending: number
    delivered: number
    failed: number
  }
  rows: Array<Record<string, string>>
}> {
  const applications = await findAll(payload, 'payload_partner_applications', {
    and: [
      filters.partnerId ? { partner: { equals: filters.partnerId } } : {},
      filters.status ? { status: { equals: filters.status } } : {},
      filters.mode ? { deliveryMethod: { equals: filters.mode } } : {},
    ],
  })

  const events = await findAll(payload, 'payload_partner_events', {
    and: [
      filters.partnerId ? { partner: { equals: filters.partnerId } } : {},
      filters.createdAfter ? { createdAt: { greater_than_equal: filters.createdAfter } } : {},
      filters.createdBefore ? { createdAt: { less_than_equal: filters.createdBefore } } : {},
    ],
  })

  const rows = applications.map((application) => ({
    partner: asString(application.partner) ?? '',
    application: String(application.id),
    member: asString(application.member) ?? '',
    status: asString(application.status) ?? '',
    deliveryMethod: asString(application.deliveryMethod) ?? '',
    submittedAt: asString(application.submittedAt) ?? '',
    deliveredAt: asString(application.deliveredAt) ?? '',
    company: asString(application.companySnapshot) ?? '',
    country: asString(application.countrySnapshot) ?? '',
    experience: asString(application.experienceSnapshot) ?? '',
    message: asString(application.messageSnapshot) ?? '',
  }))

  return {
    totals: {
      views: events.filter((event) => event.eventType === 'partner_viewed').length,
      clicks: events.filter((event) => event.eventType === 'affiliate_link_clicked').length,
      submissions: events.filter((event) => event.eventType === 'partner_application_submitted').length,
      uniqueMembers: new Set(applications.map((application) => String(application.member))).size,
      pending: applications.filter((application) => application.status === 'delivery_pending').length,
      delivered: applications.filter((application) => application.status === 'delivered').length,
      failed: applications.filter((application) => application.status === 'delivery_failed').length,
    },
    rows,
  }
}

export function serializePartnerReportCsv(rows: Array<Record<string, string>>): string {
  const header = ['partner', 'application', 'member', 'status', 'deliveryMethod', 'submittedAt', 'deliveredAt', 'company', 'country', 'experience', 'message']
  return [header, ...rows.map((row) => header.map((key) => toCsvValue(row[key])))]
    .map((line) => line.join(','))
    .join('\n')
}
