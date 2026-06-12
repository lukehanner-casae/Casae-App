import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Receipt } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import ListSkeleton from '@/components/ListSkeleton'
import ExpenseFormDialog from '@/components/expenses/ExpenseFormDialog'
import XeroPnLPanel from '@/components/financials/XeroPnLPanel'
import { Card, CardContent } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useExpenses } from '@/hooks/use-expenses'
import { useFitoutItems } from '@/hooks/use-fitout'
import { useProperties } from '@/hooks/use-properties'
import { formatAud, formatAudCents, formatDate } from '@/lib/format'
import { paybackWeeks, propertyMetrics } from '@/lib/metrics'

function HubdocToggle() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          <Switch checked={false} aria-readonly disabled />
        </span>
      </TooltipTrigger>
      <TooltipContent>Configure in Settings to enable</TooltipContent>
    </Tooltip>
  )
}

function ExpensesTab() {
  const { data: expenses, isLoading } = useExpenses()
  const { data: properties } = useProperties()
  const [propertyFilter, setPropertyFilter] = useState('all')

  const filtered = useMemo(() => {
    let list = expenses ?? []
    if (propertyFilter !== 'all') {
      list = list.filter((e) => e.property_id === propertyFilter)
    }
    return list
  }, [expenses, propertyFilter])

  const runningTotal = filtered.reduce((s, e) => s + (e.amount ?? 0), 0)

  const byProperty = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>()
    for (const p of properties ?? []) {
      map.set(p.id, { name: p.display_name, total: 0 })
    }
    for (const e of expenses ?? []) {
      if (!e.property_id) continue
      const entry = map.get(e.property_id)
      if (entry) entry.total += e.amount ?? 0
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [expenses, properties])

  const portfolioTotal = (expenses ?? []).reduce(
    (s, e) => s + (e.amount ?? 0),
    0,
  )

  return (
    <div className="space-y-4">
      {/* Portfolio summary */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-body text-xs text-muted-foreground">
                Portfolio expenses (all time)
              </p>
              <p className="font-heading text-3xl font-semibold text-navy">
                {formatAudCents(portfolioTotal)}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 font-body text-sm">
              {byProperty.map((p) => (
                <span key={p.name} className="text-muted-foreground">
                  {p.name}{' '}
                  <strong className="text-navy">{formatAud(p.total)}</strong>
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
        <p className="font-body text-sm text-muted-foreground">
          Running total{' '}
          <strong className="text-navy">{formatAudCents(runningTotal)}</strong>
        </p>
        <div className="ml-auto">
          <ExpenseFormDialog />
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses logged"
          description="Nothing matches the current filter. Log expenses with receipts to keep the books tidy for Xero."
          action={<ExpenseFormDialog />}
        />
      ) : (
      <div className="overflow-x-auto rounded-md border border-stone bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Receipt</TableHead>
              <TableHead>HubDoc</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{formatDate(expense.expense_date)}</TableCell>
                  <TableCell>{expense.property?.display_name ?? '—'}</TableCell>
                  <TableCell>{expense.category ?? '—'}</TableCell>
                  <TableCell className="max-w-[240px] truncate">
                    {expense.description ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAudCents(expense.amount)}
                  </TableCell>
                  <TableCell>
                    {expense.receipt_url ? (
                      <Receipt
                        className="h-4 w-4 text-sage"
                        aria-label="Receipt attached"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <HubdocToggle />
                  </TableCell>
                </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}
    </div>
  )
}

function FitoutTab() {
  const { data: properties } = useProperties()
  const { data: items } = useFitoutItems()

  const rows = useMemo(() => {
    return (properties ?? [])
      .map((p) => {
        const total = (items ?? [])
          .filter((i) => i.property_id === p.id)
          .reduce((s, i) => s + (i.cost ?? 0), 0)
        const margin = propertyMetrics(p).margin
        return {
          id: p.id,
          name: p.display_name,
          total,
          margin,
          payback: paybackWeeks(total, margin),
        }
      })
      .sort((a, b) => (a.payback ?? Infinity) - (b.payback ?? Infinity))
  }, [properties, items])

  return (
    <div className="space-y-4">
      <p className="font-body text-sm text-muted-foreground">
        Properties ranked by payback period (fitout spend ÷ weekly margin).
        Log fitout items from each property's Fitout tab.
      </p>
      <div className="overflow-x-auto rounded-md border border-stone bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Property</TableHead>
              <TableHead className="text-right">Fitout spend</TableHead>
              <TableHead className="text-right">Weekly margin</TableHead>
              <TableHead className="text-right">Payback</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <Link
                    to={`/properties/${row.id}`}
                    className="font-medium text-navy underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  {formatAud(row.total)}
                </TableCell>
                <TableCell className="text-right">
                  {formatAud(row.margin)}
                </TableCell>
                <TableCell className="text-right font-medium text-navy">
                  {row.payback == null
                    ? '—'
                    : row.total === 0
                      ? 'Paid back'
                      : `${row.payback} wks`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default function FinancialsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Financials"
        description="Per-property P&L from Xero, the expense log with receipts, and fitout payback across the portfolio."
      />
      <Tabs defaultValue="xero">
        <TabsList>
          <TabsTrigger value="xero">Xero P&amp;L</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="fitout">Fitout Tracker</TabsTrigger>
        </TabsList>
        <TabsContent value="xero" className="mt-4">
          <XeroPnLPanel />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab />
        </TabsContent>
        <TabsContent value="fitout" className="mt-4">
          <FitoutTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
