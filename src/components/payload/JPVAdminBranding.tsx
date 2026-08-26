import { jpvBrand } from '@/lib/brand/jpvDesignSystem'

export function JPVAdminLogo() {
  return (
    <div className='jpv-admin-logo-surface'>
      <img
        alt={jpvBrand.logoAlt}
        className='jpv-admin-logo'
        src={jpvBrand.logoHorizontalPath}
      />
    </div>
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
        width: 'auto',
      }}
    />
  )
}
