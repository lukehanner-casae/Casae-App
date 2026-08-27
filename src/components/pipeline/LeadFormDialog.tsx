import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { useProperties } from '@/hooks/use-properties'
import {
  useCreatePipelineTenant,
  useUpdatePipelineTenant,
  type PipelineTenantWithRelations,
} from '@/hooks/use-pipeline-tenants'
import {
  PIPELINE_SOURCES,
  isOpenLead,
  stageFromViewingDate,
  stageLabel,
} from '@/lib/occupancy'
import type { PipelineTenant, PipelineTenantSource } from '@/lib/types'

type FormState = {
  name: string
  email: string
  phone: string
  property_id: string
  room_id: string
  viewing_date: string
  source: string
  notes: string
}

const emptyForm: FormState = {
  name: '',
  email: '',
  phone: '',
  property_id: '',
  room_id: '',
  viewing_date: '',
  source: '',
  notes: '',
}

function toForm(t: PipelineTenantWithRelations): FormState {
  return {
    name: t.name,
    email: t.email,
    phone: t.phone ?? '',
    property_id: t.property_interest ?? '',
    room_id: t.room_interest ?? '',
    viewing_date: t.viewing_date ?? '',
    source: t.source ?? '',
    notes: t.notes ?? '',
  }
}

/**
 * Quick-entry viewing / lead capture. Every viewing is saved as a pipeline
 * tenant so the viewed pool becomes the remarketing list for vacant rooms.
 */
export default function LeadFormDialog({
  tenant,
  trigger,
  defaultPropertyId,
  defaultRoomId,
  open: controlledOpen,
  onOpenChange,
}: {
  tenant?: PipelineTenantWithRelations
  trigger?: ReactNode
  defaultPropertyId?: string
  defaultRoomId?: string
  /** Controlled mode: mount on demand from a menu item instead of a trigger. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { user } = useAuth()
  const { data: properties } = useProperties()
  const createTenant = useCreatePipelineTenant()
  const updateTenant = useUpdatePipelineTenant()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen
  const initialForm = (): FormState =>
    tenant
      ? toForm(tenant)
      : {
          ...emptyForm,
          property_id: defaultPropertyId ?? '',
          room_id: defaultRoomId ?? '',
        }
  const [form, setForm] = useState<FormState>(initialForm)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setForm(initialForm())
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const rooms = properties?.find((p) => p.id === form.property_id)?.rooms ?? []
  const inferredStage = stageFromViewingDate(form.viewing_date || null)
  // Stage follows the viewing date only while the record is still a lead.
  const stageFollowsDate = !tenant || isOpenLead(tenant)

  const submit = () => {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    const email = form.email.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('A valid email is required')
      return
    }
    const payload: Partial<PipelineTenant> = {
      name: form.name.trim(),
      email,
      phone: form.phone.trim() || null,
      property_interest: form.property_id || null,
      room_interest: form.room_id || null,
      viewing_date: form.viewing_date || null,
      source: (form.source || null) as PipelineTenantSource | null,
      notes: form.notes.trim() || null,
    }
    if (stageFollowsDate) payload.status = inferredStage

    const opts = {
      onSuccess: () => {
        toast.success(
          tenant
            ? 'Lead updated'
            : `Lead saved as ${stageLabel(inferredStage)}`,
        )
        setOpen(false)
      },
      onError: (e: Error) => toast.error(e.message),
    }
    if (tenant) {
      updateTenant.mutate({ id: tenant.id, ...payload }, opts)
    } else {
      createTenant.mutate({ ...payload, created_by: user?.id ?? null }, opts)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            {tenant ? 'Edit lead' : 'Log a viewing / lead'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lead-name">Name</Label>
            <Input
              id="lead-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-phone">Phone (optional)</Label>
              <Input
                id="lead-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Property</Label>
              <Select
                value={form.property_id}
                onValueChange={(v) => {
                  set('property_id', v)
                  set('room_id', '')
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {(properties ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Room (if known)</Label>
              <Select
                value={form.room_id}
                onValueChange={(v) => set('room_id', v)}
                disabled={!form.property_id}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.room_name}
                      {r.status === 'vacant'
                        ? ' (vacant)'
                        : r.next_vacate_date
                          ? ' (vacating)'
                          : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-viewing">Viewing date</Label>
              <Input
                id="lead-viewing"
                type="date"
                value={form.viewing_date}
                onChange={(e) => set('viewing_date', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => set('source', v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea
              id="lead-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          {stageFollowsDate ? (
            <p className="font-body text-xs text-muted-foreground">
              Will be saved as{' '}
              <strong className="text-navy">{stageLabel(inferredStage)}</strong>
              {form.viewing_date
                ? ' based on the viewing date.'
                : ' — add a viewing date to book or record a viewing.'}
            </p>
          ) : null}

          <Button
            className="w-full"
            onClick={submit}
            disabled={createTenant.isPending || updateTenant.isPending}
          >
            {tenant ? 'Save changes' : 'Save lead'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
