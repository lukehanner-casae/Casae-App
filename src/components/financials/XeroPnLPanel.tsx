import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Link2, RefreshCw } from 'lucide-react'
import EmptyState from '@/components/EmptyState'
import ListSkeleton from '@/components/ListSkeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useProperties } from '@/hooks/use-properties'
import {
  useXeroConnection,
  useXeroPnL,
  useXeroTrackingMap,
  type XeroPnLProgress,
  type XeroPnLRow,
} from '@/hooks/use-xero'
import { cn } from '@/lib/utils'
import { formatAud, formatDateTime, todayIso } from '@/lib/format'
import {
  combinePnLSummaries,
  overheadPnLSummary,
  XERO_RANGE_LABELS,
  xeroRangeDates,
  type PnLAccountLine,
  type XeroRangeKey,
} from '@/lib/xero'

const OVERHEADS_KEY = '__overheads__'

function SyncProgress({ progress }: { progress: XeroPnLProgress }) {
  return (
    <div className="space-y-1.5">
      <p className="font-body text-sm text-muted-foreground">
        {progress.done === 0
          ? 'Contacting Xero… the first sync can take a moment while the connection wakes up.'
          : `Pulling P&L reports from Xero — ${progress.done} of ${progress.total} done…`}
      </p>
      <div className="flex gap-1">
        {Array.from({ length: progress.total }, (_, i) => (
          <div
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              i < progress.done ? 'bg-sage' : 'bg-muted',
            )}
          />
        ))}
      </div>
    </div>
  )
}

function AccountList({
  title,
  lines,
}: {
  title: string
  lines: PnLAccountLine[]
}) {
  return (
    <div>
      <p className="font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {lines.length === 0 ? (
        <p className="mt-1 font-body text-sm text-muted-foreground">—</p>
      ) : (
        <ul className="mt-1 space-y-0.5">
          {lines.map((l) => (
            <li
              key={l.name}
              className="flex justify-between gap-4 font-body text-sm"
            >
              <span className="text-navy">{l.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatAud(l.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function XeroPnLPanel() {
  const { data: connection, isLoading: connectionLoading } = useXeroConnection()
  const { data: trackingMap, isLoading: mapLoading } = useXeroTrackingMap()
  const { data: properties } = useProperties()

  const [rangeKey, setRangeKey] = useState<XeroRangeKey>('this-month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState(todayIso())

  const { from, to } =
    rangeKey === 'custom'
      ? { from: customFrom || null, to: customTo || null }
      : xeroRangeDates(rangeKey)

  const connected = connection?.connected ?? false
  const pnl = useXeroPnL(from, to, trackingMap, connected)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const rows = useMemo(() => {
    const nameOf = (id: string) =>
      properties?.find((p) => p.id === id)?.display_name
    // One row per property — several tracking options (e.g. BR1/BR2) can map
    // to the same property, so group and sum them.
    const groups = new Map<string, XeroPnLRow[]>()
    for (const r of pnl.data?.rows ?? []) {
      const list = groups.get(r.propertyId) ?? []
      list.push(r)
      groups.set(r.propertyId, list)
    }
    return [...groups.entries()]
      .map(([propertyId, options]) => ({
        propertyId,
        propertyName: nameOf(propertyId) ?? options[0].optionName,
        options,
        summary: combinePnLSummaries(options.map((o) => o.summary)),
      }))
      .sort((a, b) => a.propertyName.localeCompare(b.propertyName))
  }, [pnl.data, properties])

  // Untracked overheads (bank fees, software, bookkeeping, …) = whole-org
  // P&L minus the tracked per-property reports. The portfolio total is the
  // org P&L itself, so it reflects true bottom-line profit.
  const overheads = useMemo(
    () =>
      pnl.data
        ? overheadPnLSummary(
            pnl.data.overall,
            pnl.data.rows.map((r) => r.summary),
          )
        : null,
    [pnl.data],
  )
  const hasOverheads =
    !!overheads && (overheads.income !== 0 || overheads.expenses !== 0)
  const totals = pnl.data?.overall ?? { income: 0, expenses: 0, net: 0 }

  if (connectionLoading || mapLoading) return <ListSkeleton rows={4} />

  if (!connected) {
    return (
      <EmptyState
        icon={Link2}
        title="Xero not connected"
        description="Connect the Cross Pond Capital Xero organisation to pull per-property profit & loss."
        action={
          <Button asChild>
            <Link to="/settings">Connect in Settings</Link>
          </Button>
        }
      />
    )
  }

  const mappedCount =
    trackingMap?.options.filter((o) => o.propertyId).length ?? 0
  if (mappedCount === 0) {
    return (
      <EmptyState
        icon={Link2}
        title="No tracking categories mapped"
        description="Xero is connected, but no tracking options are matched to properties yet. Set the mapping under Settings → Integrations."
        action={
          <Button asChild>
            <Link to="/settings">Map in Settings</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Range selector + sync */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Date range</Label>
          <Select
            value={rangeKey}
            onValueChange={(v) => setRangeKey(v as XeroRangeKey)}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(XERO_RANGE_LABELS) as [XeroRangeKey, string][]
              ).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {rangeKey === 'custom' && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="pnl-from">From</Label>
              <Input
                id="pnl-from"
                type="date"
                className="w-[150px]"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pnl-to">To</Label>
              <Input
                id="pnl-to"
                type="date"
                className="w-[150px]"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </>
        )}
        <div className="ml-auto flex items-center gap-3">
          {pnl.isFetching && pnl.progress && !pnl.isLoading && (
            <p className="font-body text-xs text-muted-foreground tabular-nums">
              {pnl.progress.done}/{pnl.progress.total} reports
            </p>
          )}
          <p className="font-body text-xs text-muted-foreground">
            Last synced{' '}
            {pnl.dataUpdatedAt
              ? formatDateTime(new Date(pnl.dataUpdatedAt).toISOString())
              : '—'}
          </p>
          <Button
            variant="secondary"
            onClick={() => pnl.refetch()}
            disabled={pnl.isFetching || !from || !to}
          >
            <RefreshCw
              className={cn('h-4 w-4', pnl.isFetching && 'animate-spin')}
            />
            Sync now
          </Button>
        </div>
      </div>

      {rangeKey === 'custom' && (!from || !to) ? (
        <p className="font-body text-sm text-muted-foreground">
          Pick a from and to date to run the report.
        </p>
      ) : pnl.isLoading ? (
        <div className="space-y-3">
          {pnl.progress && <SyncProgress progress={pnl.progress} />}
          <ListSkeleton rows={5} />
        </div>
      ) : pnl.error ? (
        <p className="font-body text-sm text-destructive">
          Couldn't load the P&L from Xero: {pnl.error.message}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Income</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <Fragment key={row.propertyId}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [row.propertyId]: !prev[row.propertyId],
                      }))
                    }
                  >
                    <TableCell className="text-muted-foreground">
                      {expanded[row.propertyId] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-navy">
                      {row.propertyName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAud(row.summary.income)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAud(row.summary.expenses)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-medium tabular-nums',
                        row.summary.net >= 0 ? 'text-sage' : 'text-destructive',
                      )}
                    >
                      {formatAud(row.summary.net)}
                    </TableCell>
                  </TableRow>
                  {expanded[row.propertyId] && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell />
                      <TableCell colSpan={4}>
                        <div className="space-y-4 py-1">
                          {row.options.length > 1 && (
                            <div>
                              <p className="font-body text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Tracking options
                              </p>
                              <ul className="mt-1 space-y-0.5">
                                {row.options.map((o) => (
                                  <li
                                    key={o.trackingOptionId}
                                    className="flex flex-wrap justify-between gap-x-4 font-body text-sm"
                                  >
                                    <span className="text-navy">
                                      {o.optionName}
                                    </span>
                                    <span className="tabular-nums text-muted-foreground">
                                      {formatAud(o.summary.income)} in ·{' '}
                                      {formatAud(o.summary.expenses)} out ·{' '}
                                      <span
                                        className={
                                          o.summary.net >= 0
                                            ? 'text-sage'
                                            : 'text-destructive'
                                        }
                                      >
                                        {formatAud(o.summary.net)} net
                                      </span>
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <AccountList
                              title="Top income accounts"
                              lines={row.summary.topIncome}
                            />
                            <AccountList
                              title="Top expense accounts"
                              lines={row.summary.topExpenses}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              {hasOverheads && overheads && (
                <Fragment>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [OVERHEADS_KEY]: !prev[OVERHEADS_KEY],
                      }))
                    }
                  >
                    <TableCell className="text-muted-foreground">
                      {expanded[OVERHEADS_KEY] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-navy">Overheads</span>
                      <span className="ml-2 font-body text-xs text-muted-foreground">
                        not tagged to a property
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAud(overheads.income)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatAud(overheads.expenses)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-medium tabular-nums',
                        overheads.net >= 0 ? 'text-sage' : 'text-destructive',
                      )}
                    >
                      {formatAud(overheads.net)}
                    </TableCell>
                  </TableRow>
                  {expanded[OVERHEADS_KEY] && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell />
                      <TableCell colSpan={4}>
                        <div className="grid grid-cols-1 gap-4 py-1 sm:grid-cols-2">
                          <AccountList
                            title="Top income accounts"
                            lines={overheads.topIncome}
                          />
                          <AccountList
                            title="Top expense accounts"
                            lines={overheads.topExpenses}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )}
              <TableRow className="bg-muted/50 font-medium hover:bg-muted/50">
                <TableCell />
                <TableCell className="text-navy">Portfolio total</TableCell>
                <TableCell className="text-right tabular-nums text-navy">
                  {formatAud(totals.income)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-navy">
                  {formatAud(totals.expenses)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums',
                    totals.net >= 0 ? 'text-sage' : 'text-destructive',
                  )}
                >
                  {formatAud(totals.net)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      <p className="font-body text-xs text-muted-foreground">
        Showing top accounts per category — view full detail in Xero.
      </p>
    </div>
  )
}
