import Link from 'next/link'

import { ContentCardImage } from '@/components/portal/ContentCardImage'
import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { listPublishedMemberContent } from '@/lib/payloadContent/memberContent'

function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)
}

export default async function PortalContentPage() {
  const { payload } = await requirePortalMember('/portal/content')
  const content = await listPublishedMemberContent(payload)

  return (
    <div className='space-y-6'>
      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>Member content</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Updates and resources</h1>
        <p className='mt-3 max-w-3xl text-sm leading-6 text-jpv-muted'>
          Published programme pages, announcements, pictures, videos, and downloads appear here.
        </p>
      </header>

      {content.length > 0 ? (
        <section className='grid gap-5 md:grid-cols-2'>
          {content.map((item) => {
            const href = item.kind === 'page'
              ? `/portal/pages/${item.slug}`
              : `/portal/posts/${item.slug}`
            const publishedDate = formatDate(item.publishedAt)

            return (
              <article className='overflow-hidden rounded-jpv-card border border-jpv-border bg-jpv-canvas shadow-jpv-card' key={`${item.kind}:${item.id}`}>
                {item.featuredImage ? (
                  <ContentCardImage
                    alt={item.featuredImage.alt}
                    height={item.featuredImage.height}
                    src={item.featuredImage.url}
                    width={item.featuredImage.width}
                  />
                ) : null}
                <div className='p-5 sm:p-6'>
                  <p className='jpv-eyebrow'>{item.kind === 'post' ? 'Post' : 'Page'}</p>
                  <h2 className='mt-2 text-xl font-semibold text-jpv-ink'>{item.title}</h2>
                  {item.summary ? <p className='mt-3 text-sm leading-6 text-jpv-muted'>{item.summary}</p> : null}
                  {publishedDate ? <p className='mt-3 text-xs text-jpv-muted'>{publishedDate}</p> : null}
                  <Link className='jpv-button-primary mt-5 min-h-11' href={href}>
                    Open
                  </Link>
                </div>
              </article>
            )
          })}
        </section>
      ) : (
        <section className='rounded-jpv-card border border-dashed border-jpv-border bg-jpv-canvas p-6 text-sm text-jpv-muted sm:p-8'>
          No pages or posts are published yet.
        </section>
      )}
    </div>
  )
}
