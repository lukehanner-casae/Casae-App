import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, DoorOpen, Sparkles, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useProperties } from '@/hooks/use-properties'
import { useLodgers } from '@/hooks/use-lodgers'
import { useMaintenanceJobs } from '@/hooks/use-maintenance'
import { useCleans } from '@/hooks/use-cleans'
import {
  daysSince,
  daysUntil,
  formatAud,
  formatAudCents,
  formatDate,
  lodgerName,
  todayIso,
} from '@/lib/format'
import { bondStats, portfolioMetrics } from '@/lib/metrics'
import { priorityClass } from '@/components/maintenance/priority'
import { cn } from '@/lib/utils'
import type { PropertyWithRooms, RoomWithLodgers } from '@/lib/types'

const PORTFOLIO_TARGET = 20
const TARGET_LABEL = 'February 2027'

// ---------------------------------------------------------------------------
// Vacancy cost ticker
// ---------------------------------------------------------------------------

type Vacancy = {
  property: PropertyWithRooms
  room: RoomWithLodgers
  /**
   * When the room became vacant: rooms.vacated_at (set by the move-out flow),
   * falling back to the latest former lodger move-out for rooms vacated
   * before vacated_at existed, else today.
   */
  vacantSince: string
}

function findVacancies(properties: PropertyWithRooms[]): Vacancy[] {
  const out: Vacancy[] = []
  for (const property of properties) {
    for (const room of property.rooms) {
      if (room.status !== 'vacant') continue
      const lastMoveOut = room.lodgers
        .filter((l) => l.status === 'former' && l.expected_move_out)
        .map((l) => l.expected_move_out!)
        .sort()
        .at(-1)
      out.push({
        property,
        room,
        vacantSince: room.vacated_at ?? lastMoveOut ?? todayIso(),
      })
    }
  }
  return out
}

function VacancyRow({ vacancy }: { vacancy: Vacancy }) {
  const { property, room, vacantSince } = vacancy
  const [, tick] = useState(0)

  // Re-render every second so the foregone-income counter visibly climbs.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const dailyCost = (room.weekly_rent ?? 0) / 7
  const start = new Date(vacantSince)
  start.setHours(0, 0, 0, 0)
  const elapsedDays = Math.max(0, (Date.now() - start.getTime()) / 86_400_000)
  const cost = dailyCost * elapsedDays
  const wholeDays = daysSince(vacantSince) ?? 0

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone px-4 py-3 last:border-b-0">
      <div>
        <p className="font-body text-sm font-medium text-navy">
          {property.display_name} · {room.room_name}
        </p>
        <p className="font-body text-xs text-muted-foreground">
          {wholeDays} {wholeDays === 1 ? 'day' : 'days'} vacant ·{' '}
          {formatAud(room.weekly_rent)}/wk forgone
        </p>
      </div>
      <p className="font-heading text-2xl font-semibold tabular-nums text-vacant">
        −{formatAudCents(cost)}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Upcoming events (next 14 days)
// ---------------------------------------------------------------------------

type UpcomingEvent = {
  date: string
  icon: typeof DoorOpen
  label: string
  detail: string
  badge?: { text: string; className: string }
}

export default function DashboardPage() {
  const { data: properties, isLoading } = useProperties()
  const { data: lodgers } = useLodgers()
  const { data: jobs } = useMaintenanceJobs()
  const { data: cleans } = useCleans()

  const metrics = portfolioMetrics(properties ?? [])
  const bonds = bondStats(lodgers ?? [])
  const vacancies = findVacancies(properties ?? [])
  const propertyCount = (properties ?? []).length

  const occupancyPct =
    metrics.totalRooms > 0
      ? Math.round((metrics.occupiedRooms / metrics.totalRooms) * 100)
      : 0

  const events = useMemo<UpcomingEvent[]>(() => {
    const list: UpcomingEvent[] = []
    const today = todayIso()

    for (const lodger of lodgers ?? []) {
      if (lodger.status !== 'current' || !lodger.expected_move_out) continue
      const days = daysUntil(lodger.expected_move_out)
      if (days == null || days < 0 || days > 14) continue
      list.push({
        date: lodger.expected_move_out,
        icon: DoorOpen,
        label: `Move-out — ${lodgerName(lodger)}`,
        detail: `${lodger.room?.property?.display_name ?? ''} · ${lodger.room?.room_name ?? ''} · ${formatDate(lodger.expected_move_out)}`,
      })
    }

    for (const job of jobs ?? []) {
      if (job.status !== 'open' && job.status !== 'in-progress') continue
      if (job.priority !== 'urgent' && job.priority !== 'high') continue
      list.push({
        date: job.created_at.slice(0, 10),
        icon: Wrench,
        label: job.title,
        detail: `${job.property?.display_name ?? ''}${job.room ? ` · ${job.room.room_name}` : ''}`,
        badge: {
          text: job.priority,
          className: priorityClass[job.priority],
        },
      })
    }

    for (const clean of cleans ?? []) {
      if (clean.status !== 'scheduled' || !clean.scheduled_date) continue
      const days = daysUntil(clean.scheduled_date)
      if (days == null || days < 0 || days > 1) continue
      list.push({
        date: clean.scheduled_date,
        icon: Sparkles,
        label: `Clean — ${clean.property?.display_name ?? ''}`,
        detail: `${clean.scheduled_date === today ? 'Today' : 'Tomorrow'}${clean.assigned_to ? ` · ${clean.assigned_to}` : ''}`,
      })
    }

    return list.sort((a, b) => a.date.localeCompare(b.date))
  }, [lodgers, jobs, cleans])

  const monthlyRunRate = (metrics.margin * 52) / 12
  const vacancyCostWeekly = metrics.fullMargin - metrics.margin

  const pulse = [
    { label: 'Weekly Room Income', value: formatAud(metrics.occupiedIncome) },
    { label: 'Weekly Head Lease', value: formatAud(metrics.headLease) },
    { label: 'Weekly Margin', value: formatAud(metrics.margin), signature: true },
    {
      label: 'Portfolio Occupancy',
      value: `${metrics.occupiedRooms} / ${metrics.totalRooms}`,
      sub: `${occupancyPct}% occupied`,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-heading text-4xl font-semibold text-navy">
          Dashboard
        </h1>
        <div className="mt-2 h-0.5 w-12 bg-sage" />
      </div>

      {/* Portfolio pulse */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <Card key={i}>
                <CardContent className="space-y-3 pt-5">
                  <Skeleton className="mx-auto h-3 w-2/3" />
                  <Skeleton className="mx-auto h-12 w-1/2" />
                </CardContent>
              </Card>
            ))
          : pulse.map(({ label, value, sub, signature }) => (
          <Card key={label}>
            <CardContent className="pt-5 text-center">
              <p className="font-body text-xs uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p
                className={cn(
                  'font-heading font-semibold text-navy',
                  signature ? 'text-5xl lg:text-7xl' : 'text-4xl lg:text-5xl',
                )}
              >
                {value}
              </p>
              {signature ? (
                <div className="mx-auto mt-2 h-1 w-16 bg-sage" />
              ) : null}
              {sub ? (
                <p className="mt-1 font-body text-xs text-muted-foreground">
                  {sub}
                </p>
              ) : null}
            </CardContent>
          </Card>
          ))}
      </div>

      {/* Vacancy cost ticker */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-xl text-navy">
            Vacancy Cost
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {vacancies.length === 0 ? (
            <p className="px-4 pb-4 font-body text-sm font-medium text-sage">
              Portfolio fully occupied — no income being forgone.
            </p>
          ) : (
            vacancies.map((v) => (
              <VacancyRow key={v.room.id} vacancy={v} />
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Bond float */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-xl text-navy">
              Bond Float
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-5xl font-semibold text-navy">
              {formatAud(bonds.totalHeld)}
            </p>
            <p className="mt-1 font-body text-sm text-muted-foreground">
              held across {bonds.heldCount} lodgers ·{' '}
              {bonds.dueIn30DaysCount === 0
                ? 'none due for return in 30 days'
                : `${formatAud(bonds.dueIn30Days)} due for return in 30 days`}
            </p>
          </CardContent>
        </Card>

        {/* Portfolio progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-xl text-navy">
              Portfolio Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-body text-sm text-muted-foreground">
              <strong className="font-heading text-3xl font-semibold text-navy">
                {propertyCount} of {PORTFOLIO_TARGET}
              </strong>{' '}
              properties · target {TARGET_LABEL}
            </p>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-sage"
                style={{
                  width: `${Math.min(100, (propertyCount / PORTFOLIO_TARGET) * 100)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Upcoming events */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-heading text-xl text-navy">
              <CalendarClock className="h-4 w-4 text-sage" /> Next 14 days
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {events.length === 0 ? (
              <p className="px-4 pb-4 font-body text-sm text-muted-foreground">
                Nothing scheduled in the next fortnight.
              </p>
            ) : (
              events.map((event, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-stone px-4 py-2.5 last:border-b-0"
                >
                  <event.icon className="h-4 w-4 shrink-0 text-sage" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-body text-sm font-medium text-navy">
                      {event.label}
                    </p>
                    <p className="truncate font-body text-xs text-muted-foreground">
                      {event.detail}
                    </p>
                  </div>
                  {event.badge ? (
                    <Badge
                      className={cn('capitalize', event.badge.className)}
                    >
                      {event.badge.text}
                    </Badge>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Weekly margin snapshot */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-xl text-navy">
              Weekly Margin Snapshot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 font-body text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Full-occupancy potential
              </span>
              <span className="font-medium text-navy">
                {formatAud(metrics.fullMargin)}/wk
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current margin</span>
              <span className="font-medium text-navy">
                {formatAud(metrics.margin)}/wk
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cost of vacancies</span>
              <span
                className={cn(
                  'font-medium',
                  vacancyCostWeekly > 0 ? 'text-vacant' : 'text-sage',
                )}
              >
                {vacancyCostWeekly > 0
                  ? `−${formatAud(vacancyCostWeekly)}/wk`
                  : 'None'}
              </span>
            </div>
            <div className="border-t border-stone pt-2.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly run rate</span>
                <span className="font-medium text-navy">
                  {formatAud(monthlyRunRate)}
                </span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">Annual run rate</span>
                <span className="font-medium text-navy">
                  {formatAud(metrics.margin * 52)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
