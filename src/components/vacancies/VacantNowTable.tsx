import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useProperties } from '@/hooks/use-properties'
import { daysSince, formatAud, formatDate } from '@/lib/format'
import { findVacantRooms } from '@/lib/metrics'
import { cn } from '@/lib/utils'

/**
 * Rooms vacant today, longest-vacant first, with the asking rate so the team
 * can see what each empty room is worth while it's being remarketed.
 */
export default function VacantNowTable() {
  const { data: properties } = useProperties()
  const rows = findVacantRooms(properties ?? [])

  if (rows.length === 0) {
    return (
      <p className="font-body text-sm font-medium text-sage">
        No rooms vacant right now.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-md border border-stone bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Property</TableHead>
            <TableHead>Room</TableHead>
            <TableHead className="text-right">Asking rate</TableHead>
            <TableHead>Vacant since</TableHead>
            <TableHead>Days vacant</TableHead>
            <TableHead className="text-right">Forgone / wk</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ property, room, vacantSince }) => {
            const days = daysSince(vacantSince)
            return (
              <TableRow key={room.id}>
                <TableCell className="font-medium text-navy">
                  <Link
                    to={`/properties/${property.id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {property.display_name}
                  </Link>
                </TableCell>
                <TableCell>
                  {room.room_name}
                  {room.is_ensuite ? (
                    <Badge variant="outline" className="ml-2 border-stone text-xs">
                      Ensuite
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-right font-medium text-navy">
                  {room.weekly_rent == null ? (
                    <span className="text-warning">not set</span>
                  ) : (
                    `${formatAud(room.weekly_rent)}/wk`
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(vacantSince)}</TableCell>
                <TableCell>
                  {days == null ? (
                    '—'
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn(
                        'tabular-nums',
                        days >= 14
                          ? 'border-vacant/40 bg-red-50 text-vacant'
                          : days >= 7
                            ? 'border-warning/50 bg-amber-50 text-amber-700'
                            : 'border-stone text-navy',
                      )}
                    >
                      {days}d
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-vacant">
                  {room.weekly_rent == null ? '—' : `−${formatAud(room.weekly_rent)}`}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
