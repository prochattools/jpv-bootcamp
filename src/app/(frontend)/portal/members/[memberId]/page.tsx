import { notFound } from 'next/navigation'
import Link from 'next/link'

import { CommunityRichText } from '@/components/community/CommunityRichText'
import { MemberFollowButton } from '@/components/portal/MemberFollowButton'
import { requirePortalAccess } from '@/lib/auth/requirePortalAccess'
import { getMemberProfileDetail } from '@/lib/payloadCourse/memberDirectory'

type MemberProfilePageProps = {
  params: Promise<{ memberId: string }>
}

export default async function MemberProfilePage({ params }: MemberProfilePageProps) {
  const { actor } = await requirePortalAccess('/portal/members')

  const { memberId } = await params
  const profile = await getMemberProfileDetail(memberId, actor.memberId)
  if (!profile) notFound()

  return (
    <div className='max-w-2xl'>
      <div className='mb-4'>
        <Link className='text-sm text-jpv-muted hover:text-jpv-brand-deep' href='/portal/members'>
          ← Back to members
        </Link>
      </div>

      <div className='rounded-jpv-panel border border-jpv-border bg-jpv-canvas p-6'>
        <div className='flex items-start gap-4'>
          {profile.avatarUrl ? (
            <img
              alt={profile.displayName}
              className='h-16 w-16 shrink-0 rounded-full object-cover'
              src={profile.avatarUrl}
            />
          ) : (
            <div aria-hidden='true' className='flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-jpv-surface text-2xl font-semibold text-jpv-brand-deep'>
              {profile.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className='min-w-0'>
            <h1 className='text-xl font-semibold text-jpv-ink'>{profile.displayName}</h1>
            {!profile.isSelf ? <MemberFollowButton initialFollowing={profile.follow.isFollowing} memberId={profile.memberId} /> : null}
            <p className='mt-2 text-xs text-jpv-muted'>{profile.follow.followerCount} follower{profile.follow.followerCount === 1 ? '' : 's'}</p>
            {profile.website ? (
              <a
                className='mt-1 block truncate text-sm text-jpv-brand-deep hover:underline'
                href={profile.website}
                rel='noopener noreferrer'
                target='_blank'
              >
                {profile.website}
              </a>
            ) : null}
          </div>
        </div>

        {profile.coverImageUrl ? (
          <div className='mt-4'>
            <img
              alt={`${profile.displayName} cover`}
              className='h-32 w-full rounded-jpv-card object-cover'
              src={profile.coverImageUrl}
            />
          </div>
        ) : null}

        {profile.biography ? (
          <div className='mt-4 text-sm text-jpv-ink'>
            <p className='jpv-eyebrow mb-2'>About</p>
            <div className='rounded-jpv-card bg-jpv-surface px-4 py-3 text-sm text-jpv-muted'>
              <CommunityRichText value={profile.biography} />
            </div>
          </div>
        ) : null}

        {Object.values(profile.socialLinks).some(Boolean) ? (
          <div className='mt-4'>
            <p className='jpv-eyebrow mb-2'>Links</p>
            <ul className='flex flex-wrap gap-2'>
              {profile.socialLinks.instagram ? (
                <li>
                  <a className='text-sm text-jpv-brand-deep hover:underline' href={profile.socialLinks.instagram} rel='noopener noreferrer' target='_blank'>
                    Instagram
                  </a>
                </li>
              ) : null}
              {profile.socialLinks.twitter ? (
                <li>
                  <a className='text-sm text-jpv-brand-deep hover:underline' href={profile.socialLinks.twitter} rel='noopener noreferrer' target='_blank'>
                    X / Twitter
                  </a>
                </li>
              ) : null}
              {profile.socialLinks.linkedin ? (
                <li>
                  <a className='text-sm text-jpv-brand-deep hover:underline' href={profile.socialLinks.linkedin} rel='noopener noreferrer' target='_blank'>
                    LinkedIn
                  </a>
                </li>
              ) : null}
              {profile.socialLinks.facebook ? (
                <li>
                  <a className='text-sm text-jpv-brand-deep hover:underline' href={profile.socialLinks.facebook} rel='noopener noreferrer' target='_blank'>
                    Facebook
                  </a>
                </li>
              ) : null}
              {profile.socialLinks.youtube ? (
                <li>
                  <a className='text-sm text-jpv-brand-deep hover:underline' href={profile.socialLinks.youtube} rel='noopener noreferrer' target='_blank'>
                    YouTube
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
