import type { ReactNode } from 'react'

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
      return <p className='text-sm leading-7 text-[#68766f]'>{renderChildren(node.children)}</p>
    case 'heading': {
      const HeadingTag = `h${node.level}` as const
      return <HeadingTag className='font-bold text-[#153f2e]'>{renderChildren(node.children)}</HeadingTag>
    }
    case 'list':
      return node.ordered ? (
        <ol className='list-decimal space-y-2 pl-6 text-sm leading-7 text-[#68766f]'>{renderChildren(node.children)}</ol>
      ) : (
        <ul className='list-disc space-y-2 pl-6 text-sm leading-7 text-[#68766f]'>{renderChildren(node.children)}</ul>
      )
    case 'list-item':
      return <li>{renderChildren(node.children)}</li>
    case 'quote':
      return <blockquote className='border-l-4 border-[#d9c897] pl-4 italic text-[#51645b]'>{renderChildren(node.children)}</blockquote>
    case 'link':
      return (
        <a
          className='font-semibold text-[#153f2e] underline underline-offset-4 hover:text-[#0f3023]'
          href={node.href}
          rel='noopener noreferrer'
          target='_blank'
        >
          {renderChildren(node.children)}
        </a>
      )
    case 'text':
      return renderMarkedText(node)
    default:
      return null
  }
}

export function CommunityRichText({ value }: CommunityRichTextProps) {
  return <div>{<CommunityRichTextNode node={value} />}</div>
}
