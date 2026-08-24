export type AdminActor = {
  kind: 'admin'
  administratorId: string
  email?: string
}

export type MemberActor = {
  kind: 'member'
  memberId: string
  email: string
}

export type PortalActor = AdminActor | MemberActor

export type PortalCapabilities = {
  isPlatformAdmin: boolean
}

export function derivePortalCapabilities(actor: PortalActor): PortalCapabilities {
  return {
    isPlatformAdmin: actor.kind === 'admin',
  }
}
