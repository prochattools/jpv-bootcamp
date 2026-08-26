import Link from 'next/link'

export function JPVAdminDashboardNav() {
  return (
    <Link
      href='/admin'
      className='nav__link'
      aria-label='Dashboard'
    >
      <span aria-hidden='true'>⌂</span>
      <span>Dashboard</span>
    </Link>
  )
}
