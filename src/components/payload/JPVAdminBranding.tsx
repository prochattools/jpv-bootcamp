import { jpvBrand } from '@/lib/brand/jpvDesignSystem'

export function JPVAdminLogo() {
  return (
    <img
      alt={jpvBrand.logoAlt}
      src={jpvBrand.logoPath}
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
      alt={jpvBrand.logoAlt}
      src={jpvBrand.logoPath}
      style={{
        display: 'block',
        height: 32,
        objectFit: 'contain',
        width: 32,
      }}
    />
  )
}
