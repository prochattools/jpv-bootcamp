import Link from 'next/link'

import { AdminGate } from '@/components/portal/AdminGate'
import { MemberActivityFeed } from '@/components/portal/MemberActivityFeed'
import { MemberGroupsAdmin } from '@/components/portal/MemberGroupsAdmin'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { getMemberActivity } from '@/lib/payloadCourse/memberActivity'
import { listActiveMembers, listMemberGroupCandidates } from '@/lib/payloadCourse/memberDirectory'
import { listMemberGroups } from '@/lib/portalAdmin/memberGroupCommands'

type PageProps = {
  searchParams: Promise<{ activityPage?: string; memberSearch?: string }>
}

function pageNumber(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.floor(parsed))) : 1
}

export default async function MembersDirectoryPage({ searchParams }: PageProps) {
  const [{ activityPage: rawActivityPage, memberSearch }, { actor, payload }] = await Promise.all([
    searchParams,
    requirePortalAccess('/portal/members'),
  ])
  const activityPage = pageNumber(rawActivityPage)

  const [members, activity, adminGroups, groupCandidates] = await Promise.all([
    listActiveMembers(payload),
    getMemberActivity(payload, actor.kind === 'admin' ? { kind: 'admin' } : { kind: 'member', memberId: actor.memberId }, { page: activityPage }),
    actor.kind === 'admin' ? listMemberGroups(payload, true) : Promise.resolve([]),
    actor.kind === 'admin' ? listMemberGroupCandidates(payload) : Promise.resolve([]),
  ])
  const adminMemberOptions = actor.kind === 'admin'
    ? groupCandidates.map((member) => ({
        id: member.memberId,
        label: member.displayName,
        email: member.email,
        isAdministrator: member.isAdministrator,
      }))
    : []
  const filteredMembers = memberSearch?.trim()
    ? members.filter((member) => member.displayName.toLowerCase().includes(memberSearch.trim().toLowerCase()))
    : members
  const nextHref = `/portal/members?activityPage=${activityPage + 1}${memberSearch ? `&memberSearch=${encodeURIComponent(memberSearch)}` : ''}`

  return (
    <div className='space-y-8'>
      <div className='flex flex-wrap items-end justify-between gap-4'>
        <div>
          <p className='jpv-eyebrow'>Member portal</p>
          <h1 className='mt-2 text-3xl font-semibold tracking-tight text-jpv-ink'>Members</h1>
          <p className='mt-1 text-sm text-jpv-muted'>{members.length} active member{members.length !== 1 ? 's' : ''}</p>
        </div>
        <nav aria-label='Member directory sections' className='flex flex-wrap gap-2 text-sm'>
          <a className='jpv-button-secondary min-h-10' href='#activity'>Activity</a>
          <a className='jpv-button-secondary min-h-10' href='#members'>Members</a>
          {actor.kind === 'admin' ? <a className='jpv-button-secondary min-h-10' href='#groups'>Groups</a> : null}
        </nav>
      </div>

      <div id='activity'><MemberActivityFeed activity={activity} nextHref={activity.hasMore ? nextHref : undefined} /></div>

      <section className='space-y-4' id='members'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div><p className='jpv-eyebrow'>Directory</p><h2 className='mt-2 text-2xl font-semibold text-jpv-ink'>Active members</h2></div>
          {actor.kind === 'admin' ? <form><input aria-label='Search members' className='rounded-jpv-control border border-jpv-border bg-jpv-canvas px-3 py-2.5 text-sm' defaultValue={memberSearch ?? ''} name='memberSearch' placeholder='Search members…' /></form> : null}
        </div>
        {filteredMembers.length === 0 ? <p className='text-jpv-muted'>No members to display.</p> : <ul className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>{filteredMembers.map((member) => <li key={member.memberId}><Link className='flex items-center gap-3 rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4 transition hover:border-jpv-brand-deep hover:shadow-sm' href={`/portal/members/${encodeURIComponent(member.memberId)}`}>{member.avatarUrl ? <img alt={member.displayName} className='h-10 w-10 shrink-0 rounded-full object-cover' src={member.avatarUrl} /> : <div aria-hidden='true' className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jpv-surface text-sm font-semibold text-jpv-brand-deep'>{member.displayName.charAt(0).toUpperCase()}</div>}<span className='min-w-0 truncate text-sm font-medium text-jpv-ink'>{member.displayName}</span></Link></li>)}</ul>}
      </section>

      {actor.kind === 'admin' ? <div id='groups'><AdminGate><MemberGroupsAdmin groups={adminGroups} members={adminMemberOptions} /></AdminGate></div> : null}
    </div>
  )
}
