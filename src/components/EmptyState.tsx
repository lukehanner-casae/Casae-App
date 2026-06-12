import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/** Friendly empty state with an optional CTA (e.g. a dialog trigger). */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-stone bg-card px-6 py-10 text-center">
      <Icon className="h-8 w-8 text-stone" />
      <p className="font-heading text-xl font-semibold text-navy">{title}</p>
      {description ? (
        <p className="max-w-sm font-body text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
