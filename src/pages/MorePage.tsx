import { NavLink } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { navItems, mobileNavItems } from '@/components/nav-items'

const primaryPaths = new Set(mobileNavItems.map((i) => i.to))

export default function MorePage() {
  const items = navItems.filter((i) => !primaryPaths.has(i.to))

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="More" />
      <div className="divide-y divide-stone rounded-md border border-stone bg-card">
        {items.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="flex items-center gap-3 px-4 py-3.5 font-body text-sm text-navy transition-colors hover:bg-muted"
          >
            <Icon className="h-4 w-4 text-sage" />
            <span className="flex-1">{label}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </NavLink>
        ))}
      </div>
    </div>
  )
}
