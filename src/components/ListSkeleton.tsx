import { Skeleton } from '@/components/ui/skeleton'

/** Row-shaped loading placeholder for the bordered list panels. */
export default function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-md border border-stone bg-card">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-b border-stone px-3 py-3 last:border-b-0"
        >
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  )
}
