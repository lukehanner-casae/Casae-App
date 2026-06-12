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
} from '@/hooks/use-xero'
import { cn } from '@/lib/utils'
import { formatAud, formatDateTime, todayIso } from '@/lib/format'
import {
  XERO_RANGE_LABELS,
  xeroRangeDates,
  type PnLAccountLine,
  type XeroRangeKey,
} from '@/lib/xero'

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
    return (pnl.data ?? [])
      .map((r) => ({ ...r, propertyName: nameOf(r.propertyId) ?? r.optionName }))
      .sort((a, b) => a.propertyName.localeCompare(b.propertyName))
  }, [pnl.data, properties])

  const totals = rows.reduce(
    (acc, r) => ({
      income: acc.income + r.summary.income,
      expenses: acc.expenses + r.summary.expenses,
      net: acc.net + r.summary.net,
    }),
    { income: 0, expenses: 0, net: 0 },
  )

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
        <ListSkeleton rows={5} />
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
                <Fragment key={row.trackingOptionId}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() =>
                      setExpanded((prev) => ({
                        ...prev,
                        [row.trackingOptionId]: !prev[row.trackingOptionId],
                      }))
                    }
                  >
                    <TableCell className="text-muted-foreground">
                      {expanded[row.trackingOptionId] ? (
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
                  {expanded[row.trackingOptionId] && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell />
                      <TableCell colSpan={4}>
                        <div className="grid grid-cols-1 gap-4 py-1 sm:grid-cols-2">
                          <AccountList
                            title="Top income accounts"
                            lines={row.summary.topIncome}
                          />
                          <AccountList
                            title="Top expense accounts"
                            lines={row.summary.topExpenses}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
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
