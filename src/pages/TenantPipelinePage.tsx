import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { MoreHorizontal, Plus, Search, UserPlus } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import EmptyState from '@/components/EmptyState'
import ListSkeleton from '@/components/ListSkeleton'
import PageHeader from '@/components/PageHeader'
import ConvertLeadDialog from '@/components/pipeline/ConvertLeadDialog'
import LeadFormDialog from '@/components/pipeline/LeadFormDialog'
import { MatchVacancyToLeadDialog } from '@/components/vacancies/MatchLeadDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
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
import {
  useDeletePipelineTenant,
  usePipelineTenants,
  useUpdatePipelineTenant,
  type PipelineTenantWithRelations,
} from '@/hooks/use-pipeline-tenants'
import { useProperties } from '@/hooks/use-properties'
import { daysUntil, formatDate } from '@/lib/format'
import {
  OPEN_LEAD_STAGES,
  PIPELINE_SOURCES,
  PIPELINE_STAGES,
  conversionRate,
  isOpenLead,
  pipelineHealth,
  stageLabel,
} from '@/lib/occupancy'
import { cn } from '@/lib/utils'
import type { PipelineTenantStatus } from '@/lib/types'

const stageClass: Record<PipelineTenantStatus, string> = {
  lead: 'border-stone bg-muted text-navy',
  viewing_booked: 'border-warning/50 bg-amber-50 text-amber-700',
  viewed: 'border-navy/30 bg-navy/5 text-navy',
  active: 'border-sage/40 bg-sage/10 text-sage',
  notice_given: 'border-vacant/40 bg-red-50 text-vacant',
  vacated: 'border-stone bg-muted text-muted-foreground',
}

function StageCell({ tenant }: { tenant: PipelineTenantWithRelations }) {
  const update = useUpdatePipelineTenant()
  const [convertOpen, setConvertOpen] = useState(false)

  if (!isOpenLead(tenant)) {
    return (
      <Badge variant="outline" className={stageClass[tenant.status]}>
        {stageLabel(tenant.status)}
      </Badge>
    )
  }

  return (
    <>
      <Select
        value={tenant.status}
        onValueChange={(v) => {
          // Becoming an active lodger goes through the move-in action so the
          // lodger record and room are created together.
          if (v === 'active') {
            setConvertOpen(true)
            return
          }
          update.mutate(
            { id: tenant.id, status: v as PipelineTenantStatus },
            {
              onSuccess: () => toast.success(`Moved to ${stageLabel(v as PipelineTenantStatus)}`),
              onError: (e) => toast.error(e.message),
            },
          )
        }}
      >
        <SelectTrigger className={cn('h-7 w-[150px] text-xs', stageClass[tenant.status])}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PIPELINE_STAGES.filter((s) => OPEN_LEAD_STAGES.includes(s.value) || s.value === 'active').map(
            (s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
                {s.value === 'active' ? ' (move in…)' : ''}
              </SelectItem>
            ),
          )}
        </SelectContent>
      </Select>
      {convertOpen ? (
        <ConvertLeadDialog tenant={tenant} open onOpenChange={setConvertOpen} />
      ) : null}
    </>
  )
}

type TenantDialog = 'edit' | 'match' | 'convert' | 'delete' | null

function TenantActions({ tenant }: { tenant: PipelineTenantWithRelations }) {
  const remove = useDeletePipelineTenant()
  // Dialogs live outside the menu so closing the menu doesn't unmount them.
  const [dialog, setDialog] = useState<TenantDialog>(null)
  const open = isOpenLead(tenant)
  const close = (next: boolean) => {
    if (!next) setDialog(null)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-xs" variant="ghost" aria-label="Lead actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setDialog('edit')}>Edit</DropdownMenuItem>
          {open ? (
            <>
              <DropdownMenuItem onSelect={() => setDialog('match')}>
                {tenant.linked_vacancy_id ? 'Change matched vacancy' : 'Match to a vacancy'}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog('convert')}>
                Move in — convert to lodger
              </DropdownMenuItem>
            </>
          ) : null}
          {tenant.linked_lodger_id ? (
            <DropdownMenuItem asChild>
              <Link to={`/lodgers/${tenant.linked_lodger_id}`}>Open lodger profile</Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setDialog('delete')}
            className="text-vacant focus:text-vacant"
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === 'edit' ? (
        <LeadFormDialog tenant={tenant} open onOpenChange={close} />
      ) : null}
      {dialog === 'match' ? (
        <MatchVacancyToLeadDialog tenant={tenant} open onOpenChange={close} />
      ) : null}
      {dialog === 'convert' ? (
        <ConvertLeadDialog tenant={tenant} open onOpenChange={close} />
      ) : null}
      {dialog === 'delete' ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title="Delete this lead?"
          description={`${tenant.name} is removed from the pipeline${tenant.linked_lodger_id ? ' (their lodger record stays)' : ''}. Leads who viewed but didn't take a room are worth keeping for remarketing.`}
          onConfirm={() =>
            remove.mutate(tenant.id, {
              onSuccess: () => toast.success('Lead deleted'),
              onError: (e) => toast.error(e.message),
            })
          }
        />
      ) : null}
    </>
  )
}

export default function TenantPipelinePage() {
  const { data: tenants, isLoading } = usePipelineTenants()
  const { data: properties } = useProperties()
  const [searchParams] = useSearchParams()
  const highlight = searchParams.get('highlight')
  // A link from the vacate pipeline should land on the lead whatever stage it's in.
  const [stageFilter, setStageFilter] = useState(highlight ? 'all' : 'open')
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [search, setSearch] = useState('')

  const health = pipelineHealth(tenants ?? [])
  const conversion = conversionRate(tenants ?? [])

  const filtered = useMemo(() => {
    let list = tenants ?? []
    const query = search.trim().toLowerCase()
    if (query) {
      return list.filter((t) =>
        [t.name, t.email, t.phone].filter(Boolean).join(' ').toLowerCase().includes(query),
      )
    }
    if (stageFilter === 'open') list = list.filter(isOpenLead)
    else if (stageFilter !== 'all') list = list.filter((t) => t.status === stageFilter)
    if (propertyFilter !== 'all') {
      list = list.filter(
        (t) => t.property_interest === propertyFilter || t.vacancy?.property_id === propertyFilter,
      )
    }
    if (sourceFilter !== 'all') list = list.filter((t) => t.source === sourceFilter)
    return list
  }, [tenants, stageFilter, propertyFilter, sourceFilter, search])

  const addButton = (
    <LeadFormDialog
      trigger={
        <Button size="sm">
          <Plus className="h-4 w-4" /> Log viewing / lead
        </Button>
      }
    />
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Tenant Pipeline"
        description="Every prospective and departing lodger in one list — from first enquiry to move-in to notice."
        actions={addButton}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Leads', value: health.lead },
          { label: 'Viewing booked', value: health.viewingBooked },
          { label: 'Viewed', value: health.viewed },
          { label: 'Unmatched to a vacancy', value: health.unmatched },
          {
            label: `Conversion · ${conversion.windowDays}d`,
            value: conversion.pct == null ? '—' : `${conversion.pct}%`,
            sub: `${conversion.converted} of ${conversion.leads} leads`,
          },
        ].map((t) => (
          <Card key={t.label}>
            <CardContent className="pt-4 text-center">
              <p className="font-body text-xs uppercase tracking-wide text-muted-foreground">
                {t.label}
              </p>
              <p className="font-heading text-4xl font-semibold text-navy">{t.value}</p>
              {t.sub ? (
                <p className="font-body text-xs text-muted-foreground">{t.sub}</p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[240px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="pl-8"
            aria-label="Search leads"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open leads</SelectItem>
            {PIPELINE_STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
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
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {PIPELINE_SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No leads here"
          description={
            search.trim()
              ? `Nothing matches "${search.trim()}".`
              : 'Log every viewing as it happens — the viewed pool is your remarketing list the next time a room comes up.'
          }
          action={addButton}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-stone bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Interested in</TableHead>
                <TableHead>Viewing</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Matched vacancy</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => {
                const viewingDays = daysUntil(t.viewing_date)
                return (
                  <TableRow
                    key={t.id}
                    id={`lead-${t.id}`}
                    className={cn(highlight === t.id && 'bg-sage/10')}
                  >
                    <TableCell>
                      <p className="font-medium text-navy">{t.name}</p>
                      <p className="font-body text-xs text-muted-foreground">
                        {t.email}
                        {t.phone ? ` · ${t.phone}` : ''}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StageCell tenant={t} />
                    </TableCell>
                    <TableCell>
                      {t.property?.display_name ?? '—'}
                      {t.room?.room_name ? ` · ${t.room.room_name}` : ''}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(t.viewing_date)}
                      {viewingDays != null && viewingDays >= 0 && t.status === 'viewing_booked' ? (
                        <span className="block text-xs text-muted-foreground">
                          {viewingDays === 0 ? 'today' : `in ${viewingDays}d`}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="capitalize">
                      {PIPELINE_SOURCES.find((s) => s.value === t.source)?.label ?? '—'}
                    </TableCell>
                    <TableCell>
                      {t.vacancy ? (
                        <Link to="/vacancies" className="text-navy underline-offset-2 hover:underline">
                          {t.vacancy.property?.display_name} · {t.vacancy.room?.room_name}
                          <span className="block text-xs text-muted-foreground">
                            vacates {formatDate(t.vacancy.vacate_date)}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(t.created_at)}
                    </TableCell>
                    <TableCell>
                      <TenantActions tenant={t} />
                    </TableCell>
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
