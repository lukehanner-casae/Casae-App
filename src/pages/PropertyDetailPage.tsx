import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MaintenancePanel from '@/components/maintenance/MaintenancePanel'
import CleansPanel from '@/components/cleaning/CleansPanel'
import FitoutPanel from '@/components/fitout/FitoutPanel'
import { useProperty } from '@/hooks/use-properties'
import { activeLodger } from '@/lib/metrics'
import { formatAud, formatDate, lodgerName } from '@/lib/format'
import { propertyMetrics } from '@/lib/metrics'
import { cn } from '@/lib/utils'
import type { Lodger, RoomWithLodgers } from '@/lib/types'

function BondStatus({ lodger }: { lodger: Lodger | undefined }) {
  if (!lodger || lodger.bond_amount == null) {
    return <span className="text-muted-foreground">—</span>
  }
  if (lodger.bond_returned_date) {
    return (
      <span className="text-muted-foreground">
        Returned {formatDate(lodger.bond_returned_date)}
      </span>
    )
  }
  if (!lodger.bond_received_date) {
    return (
      <span className="font-medium text-warning">
        {formatAud(lodger.bond_amount)} pending
      </span>
    )
  }
  return <span className="text-sage">{formatAud(lodger.bond_amount)} held</span>
}

function RoomCard({ room }: { room: RoomWithLodgers }) {
  const lodger = activeLodger(room)
  const vacant = room.status === 'vacant'

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                vacant ? 'bg-vacant' : 'bg-sage',
              )}
            />
            <h3 className="font-heading text-xl font-semibold text-navy">
              {room.room_name}
            </h3>
            {room.is_couple_room && (
              <Badge variant="outline" className="border-stone text-xs">
                Couple
              </Badge>
            )}
            {room.is_ensuite && (
              <Badge variant="outline" className="border-stone text-xs">
                Ensuite
              </Badge>
            )}
            {room.size_category === 'small' && (
              <Badge variant="outline" className="border-stone text-xs">
                Small
              </Badge>
            )}
          </div>
          <p className="font-heading text-xl font-semibold text-navy">
            {formatAud(room.weekly_rent)}
            <span className="font-body text-xs text-muted-foreground">/wk</span>
          </p>
        </div>

        {lodger ? (
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-body text-sm sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Lodger</p>
              <Link
                to={`/lodgers/${lodger.id}`}
                className="font-medium text-navy underline-offset-2 hover:underline"
              >
                {lodgerName(lodger)}
              </Link>
              {lodger.status === 'pending' && (
                <Badge
                  variant="outline"
                  className="ml-2 border-warning/50 bg-amber-50 text-amber-700"
                >
                  Pending
                </Badge>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Move-in</p>
              <p>{formatDate(lodger.move_in_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expected move-out</p>
              <p>{formatDate(lodger.expected_move_out)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bond</p>
              <BondStatus lodger={lodger} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Agreement</p>
              {lodger.lodging_agreement_signed ? (
                <span className="flex items-center gap-1 text-sage">
                  <Check className="h-3.5 w-3.5" /> Signed
                </span>
              ) : (
                <span className="flex items-center gap-1 text-vacant">
                  <X className="h-3.5 w-3.5" /> Not signed
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-3 font-body text-sm font-medium text-vacant">
            Vacant
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data: property, isLoading } = useProperty(id)

  if (isLoading) {
    return (
      <p className="font-body text-sm text-muted-foreground">Loading…</p>
    )
  }
  if (!property) {
    return (
      <p className="font-body text-sm text-muted-foreground">
        Property not found.
      </p>
    )
  }

  const m = propertyMetrics(property)
  const rooms = [...property.rooms].sort((a, b) =>
    a.room_name.localeCompare(b.room_name, undefined, { numeric: true }),
  )

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/properties"
        className="mb-4 inline-flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> All properties
      </Link>

      <div className="mb-6">
        <h1 className="font-heading text-4xl font-semibold text-navy">
          {property.display_name}
        </h1>
        <div className="mt-2 h-0.5 w-12 bg-sage" />
        <p className="mt-2 font-body text-sm text-muted-foreground">
          {property.address}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 font-body text-sm">
          <span>
            Head lease{' '}
            <strong className="font-heading text-lg text-navy">
              {formatAud(m.headLease)}
            </strong>
            /wk
          </span>
          <span>
            Room income{' '}
            <strong className="font-heading text-lg text-navy">
              {formatAud(m.occupiedIncome)}
            </strong>
            /wk
          </span>
          <span>
            Margin{' '}
            <strong
              className={cn(
                'font-heading text-lg',
                m.margin >= 0 ? 'text-sage' : 'text-vacant',
              )}
            >
              {formatAud(m.margin)}
            </strong>
            /wk
          </span>
          <span>
            Occupancy{' '}
            <strong className="font-heading text-lg text-navy">
              {m.occupiedRooms}/{m.totalRooms}
            </strong>
          </span>
        </div>
      </div>

      <Tabs defaultValue="rooms">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="cleans">Cleans</TabsTrigger>
          <TabsTrigger value="fitout">Fitout</TabsTrigger>
        </TabsList>
        <TabsContent value="rooms" className="mt-4 space-y-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </TabsContent>
        <TabsContent value="maintenance" className="mt-4">
          <MaintenancePanel fixedPropertyId={property.id} />
        </TabsContent>
        <TabsContent value="cleans" className="mt-4">
          <CleansPanel fixedPropertyId={property.id} />
        </TabsContent>
        <TabsContent value="fitout" className="mt-4">
          <FitoutPanel property={property} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
