import { Link } from 'react-router-dom'
import { AlertTriangle, Building2, Wrench } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useProperties } from '@/hooks/use-properties'
import { useMaintenanceJobs } from '@/hooks/use-maintenance'
import { formatAud, daysUntil } from '@/lib/format'
import { propertyMetrics, roomSquareClass } from '@/lib/metrics'
import { cn } from '@/lib/utils'
import type { PropertyWithRooms } from '@/lib/types'

function LeaseCountdown({ property }: { property: PropertyWithRooms }) {
  const days = daysUntil(property.head_lease_end)
  if (days == null) {
    return <span className="text-muted-foreground">Lease end not set</span>
  }
  if (days < 0) {
    return (
      <span className="flex items-center gap-1 font-medium text-vacant">
        <AlertTriangle className="h-3.5 w-3.5" /> Head lease expired
      </span>
    )
  }
  return (
    <span
      className={cn(
        'flex items-center gap-1',
        days < 90 ? 'font-medium text-warning' : 'text-muted-foreground',
      )}
    >
      {days < 90 ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
      {days} days until head lease expiry
    </span>
  )
}

function PropertyCard({
  property,
  openJobs,
}: {
  property: PropertyWithRooms
  openJobs: number
}) {
  const m = propertyMetrics(property)
  const rooms = [...property.rooms].sort((a, b) =>
    a.room_name.localeCompare(b.room_name, undefined, { numeric: true }),
  )

  return (
    <Link to={`/properties/${property.id}`} className="block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-2xl font-semibold text-navy">
            {property.display_name}
          </CardTitle>
          <p className="font-body text-sm text-muted-foreground">
            {property.suburb}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="font-body text-xs text-muted-foreground">
                Head lease
              </p>
              <p className="font-heading text-xl font-semibold text-navy">
                {formatAud(m.headLease)}
              </p>
            </div>
            <div>
              <p className="font-body text-xs text-muted-foreground">
                Room income
              </p>
              <p className="font-heading text-xl font-semibold text-navy">
                {formatAud(m.occupiedIncome)}
              </p>
            </div>
            <div>
              <p className="font-body text-xs text-muted-foreground">Margin</p>
              <p
                className={cn(
                  'font-heading text-xl font-semibold',
                  m.margin >= 0 ? 'text-sage' : 'text-vacant',
                )}
              >
                {formatAud(m.margin)}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-1.5 font-body text-xs text-muted-foreground">
              Rooms · {m.occupiedRooms} of {m.totalRooms} occupied
            </p>
            <div className="flex flex-wrap gap-1.5">
              {rooms.map((room) => (
                <span
                  key={room.id}
                  title={`${room.room_name} — ${room.status}`}
                  className={cn(
                    'h-5 w-5 rounded-sm border',
                    roomSquareClass(room),
                  )}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-stone pt-3 font-body text-xs">
            <LeaseCountdown property={property} />
            <span className="flex items-center gap-1 text-muted-foreground">
              <Wrench className="h-3.5 w-3.5" />
              {openJobs} open {openJobs === 1 ? 'job' : 'jobs'}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function PropertiesPage() {
  const { data: properties, isLoading } = useProperties()
  const { data: jobs } = useMaintenanceJobs()

  const openJobsByProperty = new Map<string, number>()
  for (const job of jobs ?? []) {
    if (job.status === 'open' || job.status === 'in-progress') {
      openJobsByProperty.set(
        job.property_id,
        (openJobsByProperty.get(job.property_id) ?? 0) + 1,
      )
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Properties"
        description="Weekly economics and room occupancy across the portfolio."
      />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-7 w-1/2" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (properties ?? []).length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties yet"
          description="Secured properties will appear here. Work the acquisition pipeline to land the first one."
          action={
            <Button asChild size="sm">
              <Link to="/pipeline">View pipeline</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(properties ?? []).map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              openJobs={openJobsByProperty.get(p.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
