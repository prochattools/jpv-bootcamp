import Link from 'next/link'

import { requirePortalMember } from '@/lib/auth/requirePortalMember'
import { getMembershipReadModel } from '@/lib/billing/membershipReadModel'
import { listActiveMembers } from '@/lib/payloadCourse/memberDirectory'

export default async function MembersDirectoryPage() {
  const { payload } = await requirePortalMember('/portal/members')

  const [members, membership] = await Promise.all([
    listActiveMembers(),
    getMembershipReadModel(payload),
  ])

  return (
    <div>
      <div className='mb-6'>
        <h1 className='text-2xl font-semibold text-jpv-ink'>Members</h1>
        <p className='mt-1 text-sm text-jpv-muted'>{membership.members.activeProfiles} active member{membership.members.activeProfiles !== 1 ? 's' : ''}</p>
      </div>

      {members.length === 0 ? (
        <p className='text-jpv-muted'>No members to display.</p>
      ) : (
        <ul className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
          {members.map((member) => (
            <li key={member.memberId}>
              <Link
                className='flex items-center gap-3 rounded-jpv-card border border-jpv-border bg-jpv-canvas p-4 transition hover:border-jpv-brand-deep hover:shadow-sm'
                href={`/portal/members/${member.memberId}`}
              >
                {member.avatarUrl ? (
                  <img
                    alt={member.displayName}
                    className='h-10 w-10 shrink-0 rounded-full object-cover'
                    src={member.avatarUrl}
                  />
                ) : (
                  <div aria-hidden='true' className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-jpv-surface text-sm font-semibold text-jpv-brand-deep'>
                    {member.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className='min-w-0 truncate text-sm font-medium text-jpv-ink'>{member.displayName}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
