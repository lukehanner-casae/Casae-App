import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePipelineTenants } from '@/hooks/use-pipeline-tenants'
import {
  useMatchLeadToVacancy,
  useVacateNotices,
  type VacateNoticeWithRelations,
} from '@/hooks/use-vacate-notices'
import { daysUntil, formatDate } from '@/lib/format'
import { isOpenLead, stageLabel } from '@/lib/occupancy'
import type { PipelineTenant } from '@/lib/types'

/** From a vacate-pipeline row: pick an open lead to line up for the room. */
export function MatchLeadToVacancyDialog({
  notice,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  notice: VacateNoticeWithRelations
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { data: tenants } = usePipelineTenants()
  const match = useMatchLeadToVacancy()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [tenantId, setTenantId] = useState(notice.replacement_pipeline_tenant_id ?? '')

  // Leads interested in this property first, then the rest, newest first.
  const candidates = useMemo(() => {
    const open = (tenants ?? []).filter(isOpenLead)
    const score = (t: PipelineTenant) =>
      t.room_interest === notice.room_id ? 0 : t.property_interest === notice.property_id ? 1 : 2
    return [...open].sort((a, b) => score(a) - score(b))
  }, [tenants, notice])

  const submit = () => {
    if (!tenantId) {
      toast.error('Pick a lead')
      return
    }
    match.mutate(
      { tenantId, noticeId: notice.id },
      {
        onSuccess: () => {
          toast.success('Lead assigned to the vacancy')
          setOpen(false)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) setTenantId(notice.replacement_pipeline_tenant_id ?? '')
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            Match a lead
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="font-body text-sm text-muted-foreground">
            {notice.property?.display_name} · {notice.room?.room_name} vacates{' '}
            {formatDate(notice.vacate_date)}. Choose the lead you're lining up
            for this room; they'll be marked as the replacement.
          </p>
          <div className="space-y-1.5">
            <Label>Lead</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an open lead" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · {stageLabel(t.status)}
                    {t.property?.display_name ? ` · ${t.property.display_name}` : ''}
                    {t.linked_vacancy_id && t.linked_vacancy_id !== notice.id
                      ? ' (matched elsewhere)'
                      : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidates.length === 0 ? (
              <p className="font-body text-xs text-muted-foreground">
                No open leads yet — log a viewing from the Pipeline page first.
              </p>
            ) : null}
          </div>
          <Button className="w-full" onClick={submit} disabled={match.isPending}>
            Assign lead
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** From a pipeline row: pick an upcoming vacancy for this lead. */
export function MatchVacancyToLeadDialog({
  tenant,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  tenant: PipelineTenant
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { data: notices } = useVacateNotices()
  const match = useMatchLeadToVacancy()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const [noticeId, setNoticeId] = useState(tenant.linked_vacancy_id ?? '')

  const candidates = useMemo(() => {
    const active = (notices ?? []).filter((n) => n.status === 'active')
    const score = (n: VacateNoticeWithRelations) =>
      n.room_id === tenant.room_interest
        ? 0
        : n.property_id === tenant.property_interest
          ? 1
          : 2
    return [...active].sort(
      (a, b) => score(a) - score(b) || a.vacate_date.localeCompare(b.vacate_date),
    )
  }, [notices, tenant])

  const submit = () => {
    if (!noticeId) {
      toast.error('Pick a vacancy')
      return
    }
    match.mutate(
      { tenantId: tenant.id, noticeId },
      {
        onSuccess: () => {
          toast.success(`${tenant.name} matched to the vacancy`)
          setOpen(false)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) setNoticeId(tenant.linked_vacancy_id ?? '')
      }}
    >
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            Match to a vacancy
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="font-body text-sm text-muted-foreground">
            Line {tenant.name} up for a room that's coming vacant.
          </p>
          <div className="space-y-1.5">
            <Label>Upcoming vacancy</Label>
            <Select value={noticeId} onValueChange={setNoticeId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a vacancy" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((n) => {
                  const days = daysUntil(n.vacate_date) ?? 0
                  return (
                    <SelectItem key={n.id} value={n.id}>
                      {n.property?.display_name} · {n.room?.room_name} ·{' '}
                      {formatDate(n.vacate_date)} ({days}d)
                      {n.replacement && n.replacement.id !== tenant.id
                        ? ` · currently ${n.replacement.name}`
                        : ''}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {candidates.length === 0 ? (
              <p className="font-body text-xs text-muted-foreground">
                No rooms are in the vacate pipeline right now.
              </p>
            ) : null}
          </div>
          <Button className="w-full" onClick={submit} disabled={match.isPending}>
            Match to vacancy
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
