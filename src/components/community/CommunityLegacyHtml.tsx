type CommunityLegacyHtmlProps = {
  html: string
}

export function CommunityLegacyHtml({ html }: CommunityLegacyHtmlProps) {
  return (
    <div
      className='legacy-html-fragment my-5 max-w-full overflow-hidden rounded-jpv-card border border-jpv-border bg-jpv-surface p-4 text-sm leading-7 text-jpv-muted [&_img]:max-w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto'
      data-legacy-html-preserved='true'
      // The value is the migration-generated safeHtml field, never source html.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
