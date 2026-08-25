import { Download, Shield } from 'lucide-react'
import Link from 'next/link'

import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { getMemberResourceLibrary, type ResourceLibraryGroup } from '@/lib/payloadCourse/resourceLibrary'

function formatFileSize(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB'] as const
  let size = value / 1024
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  return `${size >= 10 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`
}

function ResourceGroupSection({ group }: { group: ResourceLibraryGroup }) {
  return (
    <section>
      <h2 className='mb-2 text-sm font-bold uppercase tracking-wider text-jpv-muted'>{group.courseTitle}</h2>
      <ul className='divide-y divide-jpv-border rounded-jpv-card border border-jpv-border bg-white'>
        {group.resources.map((resource) => {
          const formattedSize = formatFileSize(resource.fileSize)
          return (
            <li key={resource.id}>
              <a
                className='flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-jpv-surface'
                href={resource.downloadUrl}
              >
                <span className='min-w-0 flex-1 truncate font-medium text-jpv-ink'>
                  {resource.title}
                </span>
                <span className='hidden shrink-0 text-xs text-jpv-muted sm:inline'>
                  {resource.moduleTitle} · {resource.lessonTitle}
                </span>
                {formattedSize ? (
                  <span className='shrink-0 text-xs text-jpv-muted'>{formattedSize}</span>
                ) : null}
                <Download aria-hidden='true' className='h-3.5 w-3.5 shrink-0 text-jpv-brand' />
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default async function PortalResourcesPage() {
  const { actor, payload } = await requirePortalAccess('/portal/resources')

  if (actor.kind === 'admin') {
    return (
      <div className='mx-auto max-w-2xl px-4 py-12 text-center'>
        <Shield aria-hidden='true' className='mx-auto mb-4 h-10 w-10 text-jpv-brand-deep' />
        <h1 className='text-xl font-semibold text-jpv-ink'>Administrator view</h1>
        <p className='mt-2 text-sm text-jpv-muted'>
          This section shows member-specific data. Use a member account to see the full member experience, or manage content from the admin panel.
        </p>
        <div className='mt-6 flex justify-center gap-3'>
          <Link className='jpv-button-primary' href='/admin'>Admin Panel</Link>
          <Link className='jpv-button-secondary' href='/portal'>Dashboard</Link>
        </div>
      </div>
    )
  }

  const memberId = actor.memberId
  const groups = await getMemberResourceLibrary(payload, memberId)

  return (
    <div className='space-y-6'>
      <header>
        <h1 className='text-2xl font-semibold tracking-tight text-jpv-ink'>Resources</h1>
        <p className='mt-1 text-sm text-jpv-muted'>
          Download templates, documents, and tools from your courses.
        </p>
      </header>

      {groups.length > 0 ? (
        <div className='space-y-6'>
          {groups.map((group) => (
            <ResourceGroupSection group={group} key={group.courseTitle} />
          ))}
        </div>
      ) : (
        <p className='text-sm text-jpv-muted'>
          No resources are available for your current courses yet.
        </p>
      )}
    </div>
  )
}
