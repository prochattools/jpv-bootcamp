const logoSrc = '/images/jpv-logo.png'

export function JPVAdminLogo() {
  return (
    <img
      alt='JPV Bootcamp Portal'
      src={logoSrc}
      style={{
        display: 'block',
        height: 'auto',
        margin: '0 auto',
        maxWidth: 280,
        objectFit: 'contain',
        width: '100%',
      }}
    />
  )
}

export function JPVAdminIcon() {
  return (
    <img
      alt='JPV Bootcamp Portal'
      src={logoSrc}
      style={{
        display: 'block',
        height: 32,
        objectFit: 'contain',
        width: 32,
      }}
    />
  )
}

export function JPVAdminLoginBranding() {
  return (
    <section
      aria-label='JPV Bootcamp admin sign-in'
      style={{
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 24,
        textAlign: 'center',
      }}
    >
      <img
        alt='JPV Bootcamp Portal'
        src={logoSrc}
        style={{
          display: 'block',
          height: 'auto',
          maxWidth: 260,
          objectFit: 'contain',
          width: '100%',
        }}
      />
      <div>
        <p
          style={{
            color: '#153f2e',
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1.25,
            margin: 0,
          }}
        >
          JPV Bootcamp Portal
        </p>
        <p
          style={{
            color: '#64736c',
            fontSize: 13,
            lineHeight: 1.5,
            margin: '6px 0 0',
          }}
        >
          Administrator sign-in
        </p>
      </div>
    </section>
  )
}
