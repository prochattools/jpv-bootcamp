/* eslint-disable @next/next/no-img-element */

import Link from 'next/link'

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
    <div className='space-y-8'>
      <header className='rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm'>
        <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>Member content</p>
        <h1 className='mt-3 text-3xl font-semibold tracking-tight'>Updates and resources</h1>
        <p className='mt-4 max-w-3xl text-sm leading-6 text-neutral-600'>
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
              <article className='overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm' key={`${item.kind}:${item.id}`}>
                {item.featuredImage ? (
                  <img
                    alt={item.featuredImage.alt}
                    className='h-52 w-full object-cover'
                    height={item.featuredImage.height ?? undefined}
                    loading='lazy'
                    src={item.featuredImage.url}
                    width={item.featuredImage.width ?? undefined}
                  />
                ) : null}
                <div className='p-6'>
                  <p className='text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500'>
                    {item.kind === 'post' ? 'Post' : 'Page'}
                  </p>
                  <h2 className='mt-2 text-xl font-semibold'>{item.title}</h2>
                  {item.summary ? <p className='mt-3 text-sm leading-6 text-neutral-600'>{item.summary}</p> : null}
                  {publishedDate ? <p className='mt-3 text-xs text-neutral-500'>{publishedDate}</p> : null}
                  <Link className='mt-5 inline-flex rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white' href={href}>
                    Open
                  </Link>
                </div>
              </article>
            )
          })}
        </section>
      ) : (
        <section className='rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-sm text-neutral-600'>
          No pages or posts are published yet.
        </section>
      )}
    </div>
  )
}
