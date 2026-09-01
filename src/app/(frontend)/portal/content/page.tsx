import Link from 'next/link'

import { ContentCardImage } from '@/components/portal/ContentCardImage'
import { AdminGate } from '@/components/portal/AdminGate'
import { PortalAnnouncementComposer } from '@/components/portal/PortalAnnouncementComposer'
import { PortalAnnouncementManagement } from '@/components/portal/PortalAnnouncementManagement'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { listPublishedMemberContent } from '@/lib/payloadContent/memberContent'
import { listPortalAdminUpdates } from '@/lib/portalAdmin/announcementCommands'
import { listMemberGroups } from '@/lib/portalAdmin/memberGroupCommands'

function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(date)
}

export default async function PortalContentPage() {
  // Member boundary remains the equivalent of requirePortalMember('/portal/content'); admins use the shared access context for Admin Mode. The member projection is the listPublishedMemberContent(payload) contract.
  const { actor, payload } = await requirePortalAccess('/portal/content')
  const isAdmin = actor.kind === 'admin'
  const [content, adminData, adminGroups, adminUpdates] = await Promise.all([
    listPublishedMemberContent(payload, isAdmin ? null : actor.memberId, { includeRestricted: isAdmin }),
    isAdmin
      ? payload.find({ collection: 'payload_members', where: { accountStatus: { equals: 'active' } }, limit: 500, depth: 0, overrideAccess: true })
      : Promise.resolve(null),
    isAdmin ? listMemberGroups(payload) : Promise.resolve([]),
    isAdmin ? listPortalAdminUpdates(payload) : Promise.resolve([]),
  ])

  return (
    <div className='space-y-6'>
      <header className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6 shadow-jpv-card sm:p-8'>
        <p className='jpv-eyebrow'>Member content</p>
        <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Updates and resources</h1>
        <p className='mt-3 max-w-3xl text-sm leading-6 text-jpv-muted'>
          Published programme pages, announcements, pictures, videos, and downloads appear here.
        </p>
      </header>

      {adminData ? (
        <AdminGate>
          <PortalAnnouncementComposer
            members={adminData.docs.map((member: { id: string | number; [key: string]: unknown }) => ({ id: String(member.id), label: String(member.displayName ?? member.name ?? member.email ?? 'Member') }))}
            groups={adminGroups.map((group) => ({ id: group.id, label: `${group.name} (${group.memberCount})` }))}
          />
        </AdminGate>
      ) : null}

      {adminData ? (
        <AdminGate>
          <PortalAnnouncementManagement updates={adminUpdates} />
        </AdminGate>
      ) : null}

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
