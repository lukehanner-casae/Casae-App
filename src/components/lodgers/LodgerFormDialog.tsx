import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { useProperties } from '@/hooks/use-properties'
import {
  useCreateLodger,
  useUpdateLodger,
  type LodgerWithRoom,
} from '@/hooks/use-lodgers'
import type { Lodger, LodgerStatus } from '@/lib/types'

type FormState = {
  first_name: string
  last_name: string
  email: string
  phone: string
  property_id: string
  room_id: string
  move_in_date: string
  expected_move_out: string
  bond_amount: string
  bond_received_date: string
  lodging_agreement_signed: boolean
  lodging_agreement_date: string
  is_couple: boolean
  partner_name: string
  emergency_contact_name: string
  emergency_contact_phone: string
  status: LodgerStatus
}

const emptyForm: FormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  property_id: '',
  room_id: '',
  move_in_date: '',
  expected_move_out: '',
  bond_amount: '',
  bond_received_date: '',
  lodging_agreement_signed: false,
  lodging_agreement_date: '',
  is_couple: false,
  partner_name: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  status: 'current',
}

function toForm(lodger: LodgerWithRoom): FormState {
  return {
    first_name: lodger.first_name ?? '',
    last_name: lodger.last_name ?? '',
    email: lodger.email ?? '',
    phone: lodger.phone ?? '',
    property_id: lodger.room?.property_id ?? '',
    room_id: lodger.room_id ?? '',
    move_in_date: lodger.move_in_date ?? '',
    expected_move_out: lodger.expected_move_out ?? '',
    bond_amount: lodger.bond_amount?.toString() ?? '',
    bond_received_date: lodger.bond_received_date ?? '',
    lodging_agreement_signed: lodger.lodging_agreement_signed,
    lodging_agreement_date: lodger.lodging_agreement_date ?? '',
    is_couple: lodger.is_couple,
    partner_name: lodger.partner_name ?? '',
    emergency_contact_name: lodger.emergency_contact_name ?? '',
    emergency_contact_phone: lodger.emergency_contact_phone ?? '',
    status: lodger.status,
  }
}

export default function LodgerFormDialog({
  lodger,
  trigger,
}: {
  lodger?: LodgerWithRoom
  trigger: ReactNode
}) {
  const { data: properties } = useProperties()
  const createLodger = useCreateLodger()
  const updateLodger = useUpdateLodger()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setForm(lodger ? toForm(lodger) : emptyForm)
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const rooms =
    properties?.find((p) => p.id === form.property_id)?.rooms ?? []

  const submit = () => {
    if (!form.first_name.trim()) {
      toast.error('First name is required')
      return
    }
    const payload: Partial<Lodger> = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      room_id: form.room_id || null,
      move_in_date: form.move_in_date || null,
      expected_move_out: form.expected_move_out || null,
      bond_amount: form.bond_amount ? Number(form.bond_amount) : null,
      bond_received_date: form.bond_received_date || null,
      lodging_agreement_signed: form.lodging_agreement_signed,
      lodging_agreement_date: form.lodging_agreement_date || null,
      is_couple: form.is_couple,
      partner_name: form.is_couple ? form.partner_name.trim() || null : null,
      emergency_contact_name: form.emergency_contact_name.trim() || null,
      emergency_contact_phone: form.emergency_contact_phone.trim() || null,
      status: form.status,
    }
    const opts = {
      onSuccess: () => {
        toast.success(lodger ? 'Lodger updated' : 'Lodger added')
        setOpen(false)
      },
      onError: (e: Error) => toast.error(e.message),
    }
    if (lodger) {
      updateLodger.mutate({ id: lodger.id, ...payload }, opts)
    } else {
      createLodger.mutate(payload, opts)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            {lodger ? 'Edit lodger' : 'Add lodger'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First name</Label>
              <Input
                value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Last name</Label>
              <Input
                value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="is-couple"
              checked={form.is_couple}
              onCheckedChange={(v) => set('is_couple', v === true)}
            />
            <Label htmlFor="is-couple">Couple (shared agreement)</Label>
          </div>
          {form.is_couple && (
            <div className="space-y-1.5">
              <Label>Partner name</Label>
              <Input
                value={form.partner_name}
                onChange={(e) => set('partner_name', e.target.value)}
                placeholder="Second person on the agreement"
              />
            </div>
          )}

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
              <Label>Room</Label>
              <Select
                value={form.room_id}
                onValueChange={(v) => set('room_id', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.room_name}
                      {r.status === 'vacant'
                        ? ' (vacant)'
                        : r.status === 'notice_given'
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
              <Label>Move-in date</Label>
              <Input
                type="date"
                value={form.move_in_date}
                onChange={(e) => set('move_in_date', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expected move-out</Label>
              <Input
                type="date"
                value={form.expected_move_out}
                onChange={(e) => set('expected_move_out', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bond amount (AUD)</Label>
              <Input
                type="number"
                min="0"
                value={form.bond_amount}
                onChange={(e) => set('bond_amount', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Bond received</Label>
              <Input
                type="date"
                value={form.bond_received_date}
                onChange={(e) => set('bond_received_date', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 items-end gap-3">
            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id="agreement-signed"
                checked={form.lodging_agreement_signed}
                onCheckedChange={(v) =>
                  set('lodging_agreement_signed', v === true)
                }
              />
              <Label htmlFor="agreement-signed">Agreement signed</Label>
            </div>
            <div className="space-y-1.5">
              <Label>Agreement date</Label>
              <Input
                type="date"
                value={form.lodging_agreement_date}
                onChange={(e) => set('lodging_agreement_date', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Emergency contact</Label>
              <Input
                value={form.emergency_contact_name}
                onChange={(e) =>
                  set('emergency_contact_name', e.target.value)
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Emergency phone</Label>
              <Input
                value={form.emergency_contact_phone}
                onChange={(e) =>
                  set('emergency_contact_phone', e.target.value)
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => set('status', v as LodgerStatus)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="notice_given" disabled={form.status !== 'notice_given'}>
                  Notice given (via Log vacate notice)
                </SelectItem>
                <SelectItem value="former">Former</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full"
            onClick={submit}
            disabled={createLodger.isPending || updateLodger.isPending}
          >
            {lodger ? 'Save changes' : 'Add lodger'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
