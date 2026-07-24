import Link from 'next/link'

import {
  MemberAttachments,
  MemberFeaturedImage,
  MemberManagedVideoSection,
  MemberMediaGallery,
} from '@/components/portal/MemberContentMedia'
import type { ManagedVideoTarget } from '@/components/portal/ManagedBunnyVideoPlayer'
import type { MemberPublishedContent } from '@/lib/payloadContent/memberContent'

function formatPublishedDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(date)
}

export function MemberPublishedContentView({
  content,
  target,
}: {
  content: MemberPublishedContent
  target: Extract<ManagedVideoTarget, 'page' | 'post'>
}) {
  const publishedDate = formatPublishedDate(content.publishedAt)

  return (
    <div className='space-y-8'>
      <Link
        className='inline-flex text-sm font-semibold text-neutral-700 underline-offset-4 hover:text-neutral-950 hover:underline'
        href='/portal'
      >
        ← Back to portal
      </Link>

      <article className='space-y-8'>
        <header className='rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm'>
          <p className='text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500'>
            {target === 'post' ? 'Post' : 'Page'}
          </p>
          <h1 className='mt-3 text-3xl font-semibold tracking-tight'>{content.title}</h1>
          {content.summary ? (
            <p className='mt-4 max-w-3xl text-sm leading-6 text-neutral-600'>{content.summary}</p>
          ) : null}
          {publishedDate ? <p className='mt-4 text-xs font-medium text-neutral-500'>Published {publishedDate}</p> : null}
        </header>

        <MemberFeaturedImage asset={content.featuredImage} />
        <MemberManagedVideoSection slug={content.slug} target={target} video={content.featuredVideo} />

        {content.contentHtml ? (
          <section className='rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm'>
            <div
              className='member-content-body max-w-none text-sm leading-7 text-neutral-800 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_a]:text-neutral-950 [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_li]:ml-4 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:mb-3'
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: content.contentHtml }}
            />
          </section>
        ) : null}

        <MemberMediaGallery assets={content.gallery} />
        <MemberAttachments assets={content.attachments} />
      </article>
    </div>
  )
}
