import type { ReactNode } from 'react'

import { CommunityLegacyHtml } from '@/components/community/CommunityLegacyHtml'
import type { SafeCommunityRichTextNode } from '@/lib/payloadCourse/communityDiscussion'

type CommunityRichTextProps = {
  value: SafeCommunityRichTextNode
}

function renderChildren(children: SafeCommunityRichTextNode[]): ReactNode {
  return children.map((child, index) => (
    <CommunityRichTextNode key={`${child.type}-${index}`} node={child} />
  ))
}

function renderMarkedText(node: Extract<SafeCommunityRichTextNode, { type: 'text' }>) {
  let content: ReactNode = node.text

  if (node.marks.code) content = <code>{content}</code>
  if (node.marks.bold) content = <strong>{content}</strong>
  if (node.marks.italic) content = <em>{content}</em>
  if (node.marks.underline) content = <u>{content}</u>

  return content
}

function CommunityRichTextNode({ node }: { node: SafeCommunityRichTextNode }) {
  switch (node.type) {
    case 'root':
      return <>{renderChildren(node.children)}</>
    case 'paragraph':
      return <p className='text-sm leading-7 text-jpv-muted'>{renderChildren(node.children)}</p>
    case 'heading': {
      const HeadingTag = `h${node.level}` as const
      return <HeadingTag className='font-bold text-jpv-brand-deep'>{renderChildren(node.children)}</HeadingTag>
    }
    case 'list':
      return node.ordered ? (
        <ol className='list-decimal space-y-2 pl-6 text-sm leading-7 text-jpv-muted'>{renderChildren(node.children)}</ol>
      ) : (
        <ul className='list-disc space-y-2 pl-6 text-sm leading-7 text-jpv-muted'>{renderChildren(node.children)}</ul>
      )
    case 'list-item':
      return <li>{renderChildren(node.children)}</li>
    case 'quote':
      return <blockquote className='border-l-4 border-jpv-sunshine pl-4 italic text-jpv-muted'>{renderChildren(node.children)}</blockquote>
    case 'link':
      return (
        <a
          className='font-semibold text-jpv-brand-deep underline underline-offset-4 hover:text-jpv-brand'
          href={node.href}
          rel='noopener noreferrer'
          target='_blank'
        >
          {renderChildren(node.children)}
        </a>
      )
    case 'text':
      return renderMarkedText(node)
    case 'legacy-html':
      return <CommunityLegacyHtml html={node.html} />
    case 'legacy-bunny-embed':
      return (
        <div className='my-5 aspect-video max-w-full overflow-hidden rounded-jpv-card bg-jpv-ink shadow-jpv-card' data-legacy-bunny-embed='true'>
          <iframe
            allow='accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture'
            allowFullScreen
            className='h-full w-full border-0'
            loading='lazy'
            src={node.src}
            title='Community video'
          />
        </div>
      )
    case 'legacy-external-embed':
      return (
        <div className='my-5 aspect-video max-w-full overflow-hidden rounded-jpv-card bg-jpv-ink shadow-jpv-card' data-community-video-provider={node.provider}>
          <iframe
            allow='accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture'
            allowFullScreen
            className='h-full w-full border-0'
            loading='lazy'
            src={node.src}
            title={`${node.provider === 'youtube' ? 'YouTube' : 'Vimeo'} video`}
          />
        </div>
      )
    default:
      return null
  }
}

export function CommunityRichText({ value }: CommunityRichTextProps) {
  return <div className='jpv-rich-text mx-auto max-w-3xl space-y-4'>{<CommunityRichTextNode node={value} />}</div>
}
