import {
  LayoutDashboard,
  Building2,
  Users,
  Wrench,
  ClipboardCheck,
  Sparkles,
  Landmark,
  KanbanSquare,
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

export const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Properties', to: '/properties', icon: Building2 },
  { label: 'Lodgers', to: '/lodgers', icon: Users },
  { label: 'Maintenance', to: '/maintenance', icon: Wrench },
  { label: 'Inspections', to: '/inspections', icon: ClipboardCheck },
  { label: 'Cleaning', to: '/cleaning', icon: Sparkles },
  { label: 'Financials', to: '/financials', icon: Landmark },
  { label: 'Pipeline', to: '/pipeline', icon: KanbanSquare },
  { label: 'Contacts', to: '/contacts', icon: Contact },
  { label: 'Settings', to: '/settings', icon: Settings },
]

/** Bottom tab bar: 4 primary destinations + More (per brand spec). */
export const mobileNavItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Properties', to: '/properties', icon: Building2 },
  { label: 'Maintenance', to: '/maintenance', icon: Wrench },
  { label: 'More', to: '/more', icon: MoreHorizontal },
]
