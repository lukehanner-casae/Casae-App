import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { BedDouble, Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/auth/AuthProvider'
import { useProfiles, profileName } from '@/hooks/use-profiles'
import { useProperties } from '@/hooks/use-properties'
import {
  PRIORITY_SUBURBS,
  PROSPECT_SOURCES,
  PROSPECT_STAGES,
  useCreateProspect,
  useProspects,
  useUpdateProspect,
} from '@/hooks/use-prospects'
import { formatAud, todayIso } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ProspectStage, PropertyProspect } from '@/lib/types'

const PORTFOLIO_TARGET = 20

function CreateProspectDialog() {
  const { user } = useAuth()
  const { data: profiles } = useProfiles()
  const createProspect = useCreateProspect()
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState('')
  const [suburb, setSuburb] = useState('')
  const [estRooms, setEstRooms] = useState('')
  const [estHeadLease, setEstHeadLease] = useState('')
  const [estRoomIncome, setEstRoomIncome] = useState('')
  const [source, setSource] = useState('')
  const [assignedTo, setAssignedTo] = useState(() => user?.id ?? 'unassigned')
  const [notes, setNotes] = useState('')

  const projectedMargin =
    estHeadLease && estRoomIncome
      ? Number(estRoomIncome) - Number(estHeadLease)
      : null

  const submit = () => {
    if (!address.trim() || !suburb.trim()) {
      toast.error('Address and suburb are required')
      return
    }
    createProspect.mutate(
      {
        address: address.trim(),
        suburb: suburb.trim(),
        est_rooms: estRooms ? Number(estRooms) : null,
        est_weekly_head_lease: estHeadLease ? Number(estHeadLease) : null,
        est_weekly_room_income: estRoomIncome ? Number(estRoomIncome) : null,
        projected_weekly_margin: projectedMargin,
        source: (source || null) as PropertyProspect['source'],
        stage: 'prospect',
        first_contact_date: todayIso(),
        assigned_to_user_id: assignedTo === 'unassigned' ? null : assignedTo,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success('Prospect added')
          setOpen(false)
          setAddress('')
          setSuburb('')
          setEstRooms('')
          setEstHeadLease('')
          setEstRoomIncome('')
          setSource('')
          setNotes('')
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Add prospect
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            New prospect
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prospect-address">Address</Label>
            <Input
              id="prospect-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Suburb</Label>
            <Select value={suburb} onValueChange={setSuburb}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select suburb" />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_SUBURBS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prospect-rooms">Est. rooms</Label>
              <Input
                id="prospect-rooms"
                type="number"
                min="1"
                value={estRooms}
                onChange={(e) => setEstRooms(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prospect-lease">Head lease/wk</Label>
              <Input
                id="prospect-lease"
                type="number"
                min="0"
                value={estHeadLease}
                onChange={(e) => setEstHeadLease(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prospect-income">Room income/wk</Label>
              <Input
                id="prospect-income"
                type="number"
                min="0"
                value={estRoomIncome}
                onChange={(e) => setEstRoomIncome(e.target.value)}
              />
            </div>
          </div>
          {projectedMargin != null && (
            <p className="font-body text-sm">
              Projected weekly margin:{' '}
              <strong
                className={cn(
                  'font-heading text-lg',
                  projectedMargin >= 0 ? 'text-sage' : 'text-vacant',
                )}
              >
                {formatAud(projectedMargin)}
              </strong>
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                {PROSPECT_SOURCES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Assigned to</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {(profiles ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name || p.email}
                    {p.id === user?.id ? ' (you)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prospect-notes">Notes</Label>
            <Textarea
              id="prospect-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <Button
            className="w-full"
            onClick={submit}
            disabled={createProspect.isPending}
          >
            Add prospect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ProspectCard({ prospect }: { prospect: PropertyProspect }) {
  const { user } = useAuth()
  const { data: profiles } = useProfiles()
  const updateProspect = useUpdateProspect()

  return (
    <Card>
      <CardContent className="space-y-2 p-3">
        <div>
          <p className="font-body text-sm font-medium leading-tight text-navy">
            {prospect.address}
          </p>
          <p className="font-body text-xs text-muted-foreground">
            {prospect.suburb}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 font-body text-xs text-muted-foreground">
          {prospect.est_rooms != null && (
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" />
              {prospect.est_rooms}
            </span>
          )}
          {prospect.projected_weekly_margin != null && (
            <Badge
              variant="outline"
              className={cn(
                prospect.projected_weekly_margin >= 0
                  ? 'border-sage/40 bg-sage/10 text-sage'
                  : 'border-vacant/40 bg-red-50 text-vacant',
              )}
            >
              {formatAud(prospect.projected_weekly_margin)}/wk
            </Badge>
          )}
        </div>
        <p className="font-body text-xs text-muted-foreground">
          {PROSPECT_SOURCES.find((s) => s.value === prospect.source)?.label ??
            'Source unknown'}
          {prospect.assigned_to_user_id
            ? prospect.assigned_to_user_id === user?.id
              ? ' · assigned to you'
              : ` · ${profileName(profiles, prospect.assigned_to_user_id)}`
            : ''}
        </p>
        <Select
          value={prospect.stage}
          onValueChange={(v) =>
            updateProspect.mutate(
              { id: prospect.id, stage: v as ProspectStage },
              {
                onSuccess: () =>
                  toast.success(
                    `Moved to ${PROSPECT_STAGES.find((s) => s.value === v)?.label ?? v}`,
                  ),
                onError: (e) => toast.error(e.message),
              },
            )
          }
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROSPECT_STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}

export default function PipelinePage() {
  const { data: prospects, isLoading } = useProspects()
  const { data: properties } = useProperties()
  const [suburbFilter, setSuburbFilter] = useState('all')

  const filtered = useMemo(() => {
    let list = prospects ?? []
    if (suburbFilter !== 'all') {
      list = list.filter((p) => p.suburb === suburbFilter)
    }
    return list
  }, [prospects, suburbFilter])

  const byStage = useMemo(() => {
    const map = new Map<ProspectStage, PropertyProspect[]>()
    for (const stage of PROSPECT_STAGES) map.set(stage.value, [])
    for (const p of filtered) map.get(p.stage)?.push(p)
    return map
  }, [filtered])

  const negotiationPlus = (prospects ?? []).filter(
    (p) => p.stage === 'negotiating' || p.stage === 'secured',
  )
  const avgMargin =
    negotiationPlus.length > 0
      ? negotiationPlus.reduce(
          (s, p) => s + (p.projected_weekly_margin ?? 0),
          0,
        ) / negotiationPlus.length
      : null

  const propertyCount = (properties ?? []).length

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Acquisition Pipeline"
        actions={<CreateProspectDialog />}
      />

      {/* Summary + progress */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-x-5 gap-y-1 font-body text-sm">
              {PROSPECT_STAGES.map((s) => (
                <span key={s.value} className="text-muted-foreground">
                  {s.label}{' '}
                  <strong className="text-navy">
                    {(byStage.get(s.value) ?? []).length}
                  </strong>
                </span>
              ))}
            </div>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              Avg projected margin (negotiating+):{' '}
              <strong className="text-navy">
                {avgMargin == null ? '—' : `${formatAud(avgMargin)}/wk`}
              </strong>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="font-body text-sm text-muted-foreground">
              <strong className="font-heading text-2xl font-semibold text-navy">
                {propertyCount} of {PORTFOLIO_TARGET}
              </strong>{' '}
              properties · target February 2027
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

      <div className="flex items-center gap-2">
        <Select value={suburbFilter} onValueChange={setSuburbFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suburbs</SelectItem>
            {PRIORITY_SUBURBS.map((s) => (
              <SelectItem key={s} value={s}>
                {s} (priority)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban board */}
      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-48 w-60 shrink-0" />
          ))}
        </div>
      ) : (
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="flex min-w-max gap-3">
          {PROSPECT_STAGES.map((stage) => {
            const cards = byStage.get(stage.value) ?? []
            return (
              <div
                key={stage.value}
                className="w-60 shrink-0 rounded-md border border-stone bg-muted/40 p-2"
              >
                <p className="mb-2 px-1 font-body text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {stage.label}{' '}
                  <span className="font-normal">({cards.length})</span>
                </p>
                <div className="space-y-2">
                  {cards.map((p) => (
                    <ProspectCard key={p.id} prospect={p} />
                  ))}
                  {cards.length === 0 && (
                    <p className="px-1 pb-1 font-body text-xs text-muted-foreground/60">
                      No prospects
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      )}
    </div>
  )
}
