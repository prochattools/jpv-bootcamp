import React from 'react'

const logoSrc = '/images/jpv-logo.jpg'

export function JPVAdminLogo() {
  return (
    <div
      aria-label='JPV Bootcamp'
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        justifyContent: 'center',
        margin: '0 auto',
        maxWidth: 320,
        textAlign: 'center',
      }}
    >
      <img
        alt='JPV • Jesus Property Venture logo'
        src={logoSrc}
        style={{
          borderRadius: 18,
          display: 'block',
          height: 104,
          objectFit: 'cover',
          width: 104,
        }}
      />
      <div>
        <div style={{ fontSize: 28, fontWeight: 750, letterSpacing: '-0.03em' }}>JPV Bootcamp</div>
        <div style={{ fontSize: 13, marginTop: 5, opacity: 0.68 }}>Course & Content Management</div>
      </div>
    </div>
  )
}

export function JPVAdminIcon() {
  return (
    <img
      alt='JPV Bootcamp'
      src={logoSrc}
      style={{
        borderRadius: 9,
        display: 'block',
        height: 34,
        objectFit: 'cover',
        width: 34,
      }}
    />
  )
}

const navGroups = [
  {
    label: 'Course Prototype',
    links: [
      { href: '/app/collections/payload_courses', label: 'Courses' },
      { href: '/app/collections/payload_course_modules', label: 'Modules' },
      { href: '/app/collections/payload_lessons', label: 'Lessons' },
      { href: '/app/collections/payload_course_access_preview', label: 'Access Preview' },
    ],
  },
  {
    label: 'Content',
    links: [
      { href: '/app/collections/payload_pages', label: 'Pages' },
      { href: '/app/collections/payload_posts', label: 'Posts' },
      { href: '/app/collections/payload_categories', label: 'Categories' },
      { href: '/app/collections/payload_media', label: 'Media' },
    ],
  },
  {
    label: 'Administration',
    links: [{ href: '/app/collections/payload_users', label: 'Administrators' }],
  },
]

export function JPVAdminNav() {
  return (
    <nav
      aria-label='JPV Bootcamp administration'
      style={{
        minHeight: '100%',
        padding: '24px 18px',
      }}
    >
      <a
        href='/app'
        style={{
          alignItems: 'center',
          color: 'inherit',
          display: 'flex',
          gap: 12,
          marginBottom: 30,
          textDecoration: 'none',
        }}
      >
        <JPVAdminIcon />
        <div>
          <div style={{ fontSize: 16, fontWeight: 750 }}>JPV Bootcamp</div>
          <div style={{ fontSize: 11, marginTop: 2, opacity: 0.62 }}>Management Portal</div>
        </div>
      </a>

      <a
        href='/course-preview'
        style={{
          border: '1px solid currentColor',
          borderRadius: 8,
          color: 'inherit',
          display: 'block',
          fontSize: 13,
          fontWeight: 650,
          marginBottom: 26,
          opacity: 0.82,
          padding: '10px 12px',
          textAlign: 'center',
          textDecoration: 'none',
        }}
      >
        Open Course Preview
      </a>

      {navGroups.map((group) => (
        <section key={group.label} style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 750,
              letterSpacing: '0.12em',
              marginBottom: 9,
              opacity: 0.55,
              textTransform: 'uppercase',
            }}
          >
            {group.label}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {group.links.map((link) => (
              <a
                href={link.href}
                key={link.href}
                style={{
                  borderRadius: 7,
                  color: 'inherit',
                  fontSize: 15,
                  padding: '9px 10px',
                  textDecoration: 'none',
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </section>
      ))}
    </nav>
  )
}
