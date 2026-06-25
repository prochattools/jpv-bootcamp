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

  if (node.marks.code) {
    content = <code className='rounded bg-[#153f2e]/8 px-1.5 py-0.5 font-mono text-[0.92em]'>{content}</code>
  }
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
      return <p className='my-4 leading-7 text-[#34443d]'>{renderChildren(node.children)}</p>
    case 'heading': {
      const children = renderChildren(node.children)
      if (node.level === 1) return <h1 className='my-6 text-3xl font-bold text-[#153f2e]'>{children}</h1>
      if (node.level === 2) return <h2 className='my-6 text-2xl font-bold text-[#153f2e]'>{children}</h2>
      if (node.level === 3) return <h3 className='my-5 text-xl font-bold text-[#153f2e]'>{children}</h3>
      if (node.level === 4) return <h4 className='my-4 text-lg font-bold text-[#153f2e]'>{children}</h4>
      if (node.level === 5) return <h5 className='my-4 font-bold text-[#153f2e]'>{children}</h5>
      return <h6 className='my-4 text-sm font-bold uppercase tracking-[0.12em] text-[#153f2e]'>{children}</h6>
    }
    case 'list':
      return node.ordered ? (
        <ol className='my-4 list-decimal space-y-2 pl-6 text-[#34443d]'>
          {renderChildren(node.children)}
        </ol>
      ) : (
        <ul className='my-4 list-disc space-y-2 pl-6 text-[#34443d]'>
          {renderChildren(node.children)}
        </ul>
      )
    case 'list-item':
      return <li className='leading-7'>{renderChildren(node.children)}</li>
    case 'quote':
      return (
        <blockquote className='my-5 border-l-4 border-[#c9b477] bg-[#f7f3e8] px-5 py-3 italic text-[#4d5c55]'>
          {renderChildren(node.children)}
        </blockquote>
      )
    case 'link':
      return (
        <a
          className='font-semibold text-[#6c5a36] underline decoration-[#c9b477] underline-offset-4 hover:text-[#153f2e]'
          href={node.href}
          rel='noopener noreferrer'
          target='_blank'
        >
          {renderChildren(node.children)}
        </a>
      )
    case 'text':
      return <>{renderMarkedText(node)}</>
    default:
      return null
  }
}

export function CommunityRichText({ value }: CommunityRichTextProps) {
  return <div>{<CommunityRichTextNode node={value} />}</div>
}
