import { FileText, Download } from 'lucide-react'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
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
    <section className='space-y-4'>
      <h2 className='text-xl font-semibold text-jpv-ink'>{group.courseTitle}</h2>
      <div className='grid gap-4 md:grid-cols-2'>
        {group.resources.map((resource) => {
          const formattedSize = formatFileSize(resource.fileSize)
          return (
            <article
              className='flex items-start gap-4 rounded-jpv-card border border-jpv-border bg-jpv-canvas p-5 shadow-sm transition hover:shadow-md'
              key={resource.id}
            >
              <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-jpv-action bg-jpv-surface-strong text-jpv-brand-deep'>
                <FileText aria-hidden='true' className='h-5 w-5' />
              </div>
              <div className='min-w-0 flex-1'>
                <h3 className='font-semibold text-jpv-ink'>{resource.title}</h3>
                {resource.description ? (
                  <p className='mt-1 text-sm leading-6 text-jpv-muted'>{resource.description}</p>
                ) : null}
                <p className='mt-2 text-xs text-jpv-muted'>
                  {[resource.moduleTitle, resource.lessonTitle, resource.fileName, formattedSize]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <a
                className='flex h-9 w-9 shrink-0 items-center justify-center rounded-jpv-action bg-jpv-brand text-jpv-canvas transition hover:bg-jpv-brand-hover'
                href={resource.downloadUrl}
                title={`Download ${resource.title}`}
              >
                <Download aria-hidden='true' className='h-4 w-4' />
              </a>
            </article>
          )
        })}
      </div>
    </section>
  )
}

export default async function PortalResourcesPage() {
  const { memberId, payload } = await requirePortalMember('/portal/resources')
  const groups = await getMemberResourceLibrary(payload, memberId)

  return (
    <div className='space-y-8'>
      <header>
        <p className='jpv-eyebrow'>Library</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight text-jpv-ink'>Resources</h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-jpv-muted'>
          Access templates, documents, checklists and tools from your courses — all in one place.
        </p>
      </header>

      {groups.length > 0 ? (
        <div className='space-y-10'>
          {groups.map((group) => (
            <ResourceGroupSection group={group} key={group.courseTitle} />
          ))}
        </div>
      ) : (
        <div className='rounded-jpv-panel border border-dashed border-jpv-border bg-jpv-canvas p-8 text-sm text-jpv-muted'>
          No resources are available for your current courses yet.
        </div>
      )}
    </div>
  )
}
