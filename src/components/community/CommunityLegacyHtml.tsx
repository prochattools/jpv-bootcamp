type CommunityLegacyHtmlProps = {
  html: string
}

export function CommunityLegacyHtml({ html }: CommunityLegacyHtmlProps) {
  return (
    <div
      className='jpv-rich-text legacy-html-fragment my-5 max-w-full overflow-hidden rounded-jpv-card border border-jpv-border bg-jpv-surface p-4 text-sm leading-7 text-jpv-muted [&_a]:font-semibold [&_a]:text-jpv-brand-deep [&_a]:underline [&_a]:underline-offset-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-jpv-border [&_pre]:max-w-full [&_pre]:overflow-x-auto'
      data-legacy-html-preserved='true'
      // The value is the migration-generated safeHtml field, never source html.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
