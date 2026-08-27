import {
  LayoutDashboard,
  Building2,
  Users,
  ClipboardCheck,
  Landmark,
  Brain,
  DoorOpen,
  UserPlus,
  Contact,
  Settings,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  label: string
  to: string
  icon: LucideIcon
}

// Cleaning (/cleaning) and Maintenance (/maintenance) are deprecated for the
// occupancy pivot (Redesign Spec v2 §2.1): routes, pages and tables stay in
// place, they are simply not listed here. Add them back to re-enable.
export const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Vacancies', to: '/vacancies', icon: DoorOpen },
  { label: 'Pipeline', to: '/pipeline', icon: UserPlus },
  { label: 'Properties', to: '/properties', icon: Building2 },
  { label: 'Lodgers', to: '/lodgers', icon: Users },
  { label: 'Inspections', to: '/inspections', icon: ClipboardCheck },
  { label: 'Financials', to: '/financials', icon: Landmark },
  { label: 'Insights', to: '/insights', icon: Brain },
  { label: 'Contacts', to: '/contacts', icon: Contact },
  { label: 'Settings', to: '/settings', icon: Settings },
]

/** Bottom tab bar: primary destinations + More (per brand spec). */
export const mobileNavItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Vacancies', to: '/vacancies', icon: DoorOpen },
  { label: 'Pipeline', to: '/pipeline', icon: UserPlus },
  { label: 'Properties', to: '/properties', icon: Building2 },
  { label: 'More', to: '/more', icon: MoreHorizontal },
]
