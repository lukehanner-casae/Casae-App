import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  DoorOpen,
  MoreHorizontal,
} from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import EmptyState from '@/components/EmptyState'
import ListSkeleton from '@/components/ListSkeleton'
import ConvertLeadDialog from '@/components/pipeline/ConvertLeadDialog'
import { MatchLeadToVacancyDialog } from '@/components/vacancies/MatchLeadDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePipelineTenants } from '@/hooks/use-pipeline-tenants'
import { useProperties } from '@/hooks/use-properties'
import {
  useCancelVacateNotice,
  useCompleteVacateNotice,
  useUnmatchLead,
  useUpdateVacateNotice,
  useVacateNotices,
  type VacateNoticeWithRelations,
} from '@/hooks/use-vacate-notices'
import { daysUntil, formatDate, lodgerName } from '@/lib/format'
import {
  DAYS_BUCKETS,
  REPLACEMENT_STATUSES,
  daysUntilBadgeClass,
  inDaysBucket,
  replacementLabel,
  type DaysBucket,
} from '@/lib/occupancy'
import { cn } from '@/lib/utils'
import type { ReplacementStatus } from '@/lib/types'

type SortKey = 'vacate_date' | 'property' | 'lodger' | 'replacement'
type SortDir = 'asc' | 'desc'

const replacementClass: Record<ReplacementStatus, string> = {
  unassigned: 'border-vacant/40 bg-red-50 text-vacant',
  lead_assigned: 'border-warning/50 bg-amber-50 text-amber-700',
  confirmed: 'border-sage/40 bg-sage/10 text-sage',
}

export function DaysUntilBadge({ date }: { date: string }) {
  const days = daysUntil(date) ?? 0
  return (
    <Badge variant="outline" className={cn('tabular-nums', daysUntilBadgeClass(days))}>
      {days < 0 ? `${-days}d overdue` : days === 0 ? 'Today' : `${days}d`}
    </Badge>
  )
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  active: boolean
  dir: SortDir
  onSort: (k: SortKey) => void
  className?: string
}) {
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 font-body',
          active ? 'text-navy' : 'text-muted-foreground hover:text-navy',
        )}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </TableHead>
  )
}

type NoticeDialog = 'match' | 'convert' | 'vacated' | 'cancel' | null

function NoticeActions({ notice }: { notice: VacateNoticeWithRelations }) {
  const { data: tenants } = usePipelineTenants()
  const unmatch = useUnmatchLead()
  const cancel = useCancelVacateNotice()
  const complete = useCompleteVacateNotice()
  // Dialogs live outside the menu so closing the menu doesn't unmount them.
  const [dialog, setDialog] = useState<NoticeDialog>(null)
  const matched = tenants?.find((t) => t.id === notice.replacement_pipeline_tenant_id)
  const canConvert = matched && ['lead', 'viewing_booked', 'viewed'].includes(matched.status)
  const close = (open: boolean) => {
    if (!open) setDialog(null)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-xs" variant="ghost" aria-label="Notice actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog('match')}>
            {matched ? 'Change matched lead' : 'Match a lead'}
          </DropdownMenuItem>
          {canConvert ? (
            <DropdownMenuItem onSelect={() => setDialog('convert')}>
              Move in {matched!.name}
            </DropdownMenuItem>
          ) : null}
          {matched ? (
            <DropdownMenuItem
              onSelect={() =>
                unmatch.mutate(notice.id, {
                  onSuccess: () => toast.success('Lead unassigned'),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              Unassign lead
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog('vacated')}>
            Lodger has left — mark vacated
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setDialog('cancel')}
            className="text-vacant focus:text-vacant"
          >
            Cancel notice (lodger staying)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'match' ? (
        <MatchLeadToVacancyDialog notice={notice} open onOpenChange={close} />
      ) : null}
      {dialog === 'convert' && matched ? (
        <ConvertLeadDialog tenant={matched} open onOpenChange={close} />
      ) : null}
      {dialog === 'vacated' ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title="Mark room as vacated now?"
          description={`${notice.lodger ? lodgerName(notice.lodger) : 'The lodger'} becomes a former lodger and ${notice.room?.room_name ?? 'the room'} counts as vacant from today (or the vacate date if earlier).`}
          confirmLabel="Mark vacated"
          onConfirm={() =>
            complete.mutate(notice.id, {
              onSuccess: () => toast.success('Room marked vacant'),
              onError: (e) => toast.error(e.message),
            })
          }
        />
      ) : null}
      {dialog === 'cancel' ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title="Cancel this vacate notice?"
          description="The lodger goes back to current and the room leaves the vacate pipeline. Any matched lead is unassigned."
          confirmLabel="Cancel notice"
          onConfirm={() =>
            cancel.mutate(notice.id, {
              onSuccess: () => toast.success('Notice cancelled — lodger is staying'),
              onError: (e) => toast.error(e.message),
            })
          }
        />
      ) : null}
    </>
  )
}

/**
 * The vacate pipeline: rooms with an active notice, soonest first, with the
 * replacement status for each. `limit` renders a compact preview (dashboard).
 */
export default function VacatePipelineTable({
  limit,
  showFilters = true,
}: {
  limit?: number
  showFilters?: boolean
}) {
  const { data: notices, isLoading } = useVacateNotices()
  const { data: properties } = useProperties()
  const updateNotice = useUpdateVacateNotice()
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [bucketFilter, setBucketFilter] = useState<'all' | DaysBucket>('all')
  const [replacementFilter, setReplacementFilter] = useState('all')
  const [includeClosed, setIncludeClosed] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('vacate_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const onSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir('asc')
    }
  }

  const rows = useMemo(() => {
    let list = (notices ?? []).filter((n) =>
      includeClosed ? true : n.status === 'active',
    )
    if (propertyFilter !== 'all') list = list.filter((n) => n.property_id === propertyFilter)
    if (bucketFilter !== 'all') {
      list = list.filter((n) => inDaysBucket(daysUntil(n.vacate_date) ?? 0, bucketFilter))
    }
    if (replacementFilter !== 'all') {
      list = list.filter((n) => n.replacement_status === replacementFilter)
    }
    const dir = sortDir === 'asc' ? 1 : -1
    const key = (n: VacateNoticeWithRelations): string => {
      switch (sortKey) {
        case 'property':
          return `${n.property?.display_name ?? ''} ${n.room?.room_name ?? ''}`
        case 'lodger':
          return n.lodger ? lodgerName(n.lodger) : ''
        case 'replacement':
          return String(REPLACEMENT_STATUSES.findIndex((s) => s.value === n.replacement_status))
        default:
          return n.vacate_date
      }
    }
    list = [...list].sort((a, b) => {
      // Closed notices always sink below active ones.
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1
      return key(a).localeCompare(key(b), undefined, { numeric: true }) * dir
    })
    return limit ? list.slice(0, limit) : list
  }, [notices, includeClosed, propertyFilter, bucketFilter, replacementFilter, sortKey, sortDir, limit])

  const setReplacement = (n: VacateNoticeWithRelations, value: ReplacementStatus) =>
    updateNotice.mutate(
      { id: n.id, replacement_status: value },
      {
        onSuccess: () => toast.success(`Replacement: ${replacementLabel(value)}`),
        onError: (e) => toast.error(e.message),
      },
    )

  if (isLoading) return <ListSkeleton rows={limit ?? 5} />

  return (
    <div className="space-y-3">
      {showFilters ? (
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
          <Select
            value={bucketFilter}
            onValueChange={(v) => setBucketFilter(v as 'all' | DaysBucket)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any timeframe</SelectItem>
              {DAYS_BUCKETS.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={replacementFilter} onValueChange={setReplacementFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any replacement</SelectItem>
              {REPLACEMENT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="ml-auto flex items-center gap-2 font-body text-xs text-muted-foreground">
            <Switch checked={includeClosed} onCheckedChange={setIncludeClosed} />
            Include completed
          </label>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="No rooms coming vacant"
          description={
            (notices ?? []).some((n) => n.status === 'active')
              ? 'Nothing matches the current filters.'
              : 'When a lodger gives notice, log it and the room will appear here with a countdown.'
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Property" sortKey="property" active={sortKey === 'property'} dir={sortDir} onSort={onSort} />
                <TableHead>Room</TableHead>
                <SortHeader label="Outgoing lodger" sortKey="lodger" active={sortKey === 'lodger'} dir={sortDir} onSort={onSort} />
                <SortHeader label="Vacate date" sortKey="vacate_date" active={sortKey === 'vacate_date'} dir={sortDir} onSort={onSort} />
                <TableHead>Days until vacant</TableHead>
                <SortHeader label="Replacement" sortKey="replacement" active={sortKey === 'replacement'} dir={sortDir} onSort={onSort} />
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((n) => {
                const closed = n.status !== 'active'
                return (
                  <TableRow key={n.id} className={cn(closed && 'opacity-60')}>
                    <TableCell className="font-medium text-navy">
                      <Link
                        to={`/properties/${n.property_id}`}
                        className="underline-offset-2 hover:underline"
                      >
                        {n.property?.display_name ?? '—'}
                      </Link>
                    </TableCell>
                    <TableCell>{n.room?.room_name ?? '—'}</TableCell>
                    <TableCell>
                      {n.lodger ? (
                        <Link
                          to={`/lodgers/${n.lodger.id}`}
                          className="text-navy underline-offset-2 hover:underline"
                        >
                          {lodgerName(n.lodger)}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(n.vacate_date)}</TableCell>
                    <TableCell>
                      {closed ? (
                        <Badge variant="outline" className="border-stone capitalize text-muted-foreground">
                          {n.status}
                        </Badge>
                      ) : (
                        <DaysUntilBadge date={n.vacate_date} />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {closed ? (
                          <Badge variant="outline" className={replacementClass[n.replacement_status]}>
                            {replacementLabel(n.replacement_status)}
                          </Badge>
                        ) : (
                          <Select
                            value={n.replacement_status}
                            onValueChange={(v) => setReplacement(n, v as ReplacementStatus)}
                          >
                            <SelectTrigger
                              className={cn('h-7 w-[150px] text-xs', replacementClass[n.replacement_status])}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {REPLACEMENT_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>
                                  {s.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {n.replacement ? (
                          <Link
                            to={`/pipeline?highlight=${n.replacement.id}`}
                            className="font-body text-xs text-muted-foreground underline-offset-2 hover:underline"
                          >
                            {n.replacement.name}
                          </Link>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{closed ? null : <NoticeActions notice={n} />}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
