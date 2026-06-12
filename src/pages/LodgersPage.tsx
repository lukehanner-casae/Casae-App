import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Plus, X } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import BondFloatPanel from '@/components/lodgers/BondFloatPanel'
import LodgerFormDialog from '@/components/lodgers/LodgerFormDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLodgers } from '@/hooks/use-lodgers'
import { useProperties } from '@/hooks/use-properties'
import { daysUntil, formatAud, formatDate, lodgerName } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { LodgerStatus } from '@/lib/types'

const statusBadge: Record<LodgerStatus, string> = {
  current: 'border-sage/40 bg-sage/10 text-sage',
  pending: 'border-warning/50 bg-amber-50 text-amber-700',
  former: 'border-stone bg-muted text-muted-foreground',
}

function MoveOutCell({ date }: { date: string | null }) {
  const days = daysUntil(date)
  if (days == null) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        days >= 0 && days < 14 ? 'font-semibold text-vacant' : undefined,
      )}
    >
      {formatDate(date)}
      {days >= 0 ? (
        <span className="block text-xs opacity-80">in {days}d</span>
      ) : null}
    </span>
  )
}

export default function LodgersPage() {
  const { data: lodgers, isLoading } = useLodgers()
  const { data: properties } = useProperties()
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('current')

  const filtered = useMemo(() => {
    let list = lodgers ?? []
    if (propertyFilter !== 'all') {
      list = list.filter((l) => l.room?.property_id === propertyFilter)
    }
    if (statusFilter !== 'all') {
      list = list.filter((l) => l.status === statusFilter)
    }
    return list
  }, [lodgers, propertyFilter, statusFilter])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Lodgers"
        actions={
          <LodgerFormDialog
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> Add lodger
              </Button>
            }
          />
        }
      />

      <BondFloatPanel lodgers={lodgers ?? []} />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All properties</SelectItem>
            {(properties ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.display_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="former">Former</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-md border border-stone bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Room</TableHead>
              <TableHead className="text-right">Rent/wk</TableHead>
              <TableHead>Move-in</TableHead>
              <TableHead>Move-out</TableHead>
              <TableHead>Bond</TableHead>
              <TableHead>Agreement</TableHead>
              <TableHead>Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground">
                  No lodgers match.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((lodger) => (
                <TableRow key={lodger.id}>
                  <TableCell>
                    <Link
                      to={`/lodgers/${lodger.id}`}
                      className="font-medium text-navy underline-offset-2 hover:underline"
                    >
                      {lodgerName(lodger)}
                    </Link>
                    {lodger.status !== 'current' && (
                      <Badge
                        variant="outline"
                        className={cn(
                          'ml-2 capitalize',
                          statusBadge[lodger.status],
                        )}
                      >
                        {lodger.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {lodger.room?.property?.display_name ?? '—'}
                  </TableCell>
                  <TableCell>{lodger.room?.room_name ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    {formatAud(lodger.room?.weekly_rent)}
                  </TableCell>
                  <TableCell>{formatDate(lodger.move_in_date)}</TableCell>
                  <TableCell>
                    <MoveOutCell date={lodger.expected_move_out} />
                  </TableCell>
                  <TableCell>
                    {lodger.bond_returned_date ? (
                      <span className="text-muted-foreground">Returned</span>
                    ) : lodger.bond_received_date ? (
                      <span className="flex items-center gap-1 text-sage">
                        <Check className="h-3.5 w-3.5" />
                        {formatAud(lodger.bond_amount)}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-warning">
                        <X className="h-3.5 w-3.5" /> Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {lodger.lodging_agreement_signed ? (
                      <Check className="h-4 w-4 text-sage" />
                    ) : (
                      <X className="h-4 w-4 text-vacant" />
                    )}
                  </TableCell>
                  <TableCell>{lodger.phone ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
