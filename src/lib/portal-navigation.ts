import { getPayload } from 'payload'
import config from '@payload-config'
import { DEFAULT_PORTAL_NAV_ITEMS } from './portal-nav-seed'

export type PortalNavItem = {
  label: string
  href: string
  iconName: string | null
  navGroup: string
  groupSortOrder: number
  itemSortOrder: number
  highlighted: boolean
}

export type PortalNavGroup = {
  title: string
  sortOrder: number
  items: PortalNavItem[]
}

export async function getPortalNavigation(): Promise<{
  pinned: PortalNavItem[]
  groups: PortalNavGroup[]
}> {
  try {
    const payload = await getPayload({ config })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (payload as any).find({
      collection: 'payload_portal_nav_items',
      where: { status: { equals: 'active' } },
      sort: 'groupSortOrder',
      limit: 100,
      depth: 0,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = result.docs
    if (items.length === 0) {
      return buildNavFromDefaults()
    }

    const pinned: PortalNavItem[] = []
    const groupMap = new Map<string, PortalNavGroup>()

    for (const item of items) {
      const navItem: PortalNavItem = {
        label: item.label,
        href: item.href,
        iconName: item.iconName ?? null,
        navGroup: item.navGroup,
        groupSortOrder: item.groupSortOrder ?? 0,
        itemSortOrder: item.itemSortOrder ?? 0,
        highlighted: item.highlighted ?? false,
      }

      if (item.navGroup === '_pinned' || item.highlighted) {
        pinned.push(navItem)
      } else {
        if (!groupMap.has(item.navGroup)) {
          groupMap.set(item.navGroup, {
            title: item.navGroup,
            sortOrder: item.groupSortOrder ?? 0,
            items: [],
          })
        }
        groupMap.get(item.navGroup)!.items.push(navItem)
      }
    }

    const groups = Array.from(groupMap.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
    for (const group of groups) {
      group.items.sort((a, b) => a.itemSortOrder - b.itemSortOrder)
    }
    pinned.sort((a, b) => a.itemSortOrder - b.itemSortOrder)

    return { pinned, groups }
  } catch {
    return buildNavFromDefaults()
  }
}

function buildNavFromDefaults() {
  const pinned: PortalNavItem[] = []
  const groupMap = new Map<string, PortalNavGroup>()

  for (const item of DEFAULT_PORTAL_NAV_ITEMS) {
    const navItem: PortalNavItem = {
      label: item.label,
      href: item.href,
      iconName: item.iconName,
      navGroup: item.navGroup,
      groupSortOrder: item.groupSortOrder,
      itemSortOrder: item.itemSortOrder,
      highlighted: item.highlighted,
    }

    if (item.navGroup === '_pinned' || item.highlighted) {
      pinned.push(navItem)
    } else {
      if (!groupMap.has(item.navGroup)) {
        groupMap.set(item.navGroup, {
          title: item.navGroup,
          sortOrder: item.groupSortOrder,
          items: [],
        })
      }
      groupMap.get(item.navGroup)!.items.push(navItem)
    }
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => a.sortOrder - b.sortOrder)
  for (const group of groups) {
    group.items.sort((a, b) => a.itemSortOrder - b.itemSortOrder)
  }
  pinned.sort((a, b) => a.itemSortOrder - b.itemSortOrder)

  return { pinned, groups }
}
