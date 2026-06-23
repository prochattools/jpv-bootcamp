const logoSrc = '/images/jpv-logo.png'

export function JPVAdminLogo() {
  return (
    <img
      alt='JPV Bootcamp'
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
      alt='JPV Bootcamp'
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
