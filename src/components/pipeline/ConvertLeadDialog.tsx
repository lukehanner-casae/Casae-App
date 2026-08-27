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
  useConvertPipelineTenant,
  type PipelineTenantWithRelations,
} from '@/hooks/use-pipeline-tenants'
import { addDaysIso, daysUntil, formatAud, formatDate, todayIso } from '@/lib/format'

/**
 * Move-in: converts a pipeline tenant into an Active Lodger in a room. Lead
 * history (viewing date, source) stays on the pipeline record. If the room
 * has an active vacate notice, the replacement is confirmed and — once the
 * move-in date arrives — the notice closes out and the room stays occupied.
 */
export default function ConvertLeadDialog({
  tenant,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  tenant: PipelineTenantWithRelations
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { data: properties } = useProperties()
  const convert = useConvertPipelineTenant()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  const defaultPropertyId = tenant.vacancy?.property_id ?? tenant.property_interest ?? ''
  const defaultRoomId = tenant.vacancy?.room_id ?? tenant.room_interest ?? ''
  const defaultMoveIn =
    tenant.vacancy && (daysUntil(tenant.vacancy.vacate_date) ?? -1) >= 0
      ? addDaysIso(tenant.vacancy.vacate_date, 1)
      : todayIso()

  const [propertyId, setPropertyId] = useState(defaultPropertyId)
  const [roomId, setRoomId] = useState(defaultRoomId)
  const [moveIn, setMoveIn] = useState(defaultMoveIn)
  const [bond, setBond] = useState('')

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setPropertyId(defaultPropertyId)
      setRoomId(defaultRoomId)
      setMoveIn(defaultMoveIn)
      setBond('')
    }
  }

  const rooms = useMemo(
    () =>
      [...(properties?.find((p) => p.id === propertyId)?.rooms ?? [])].sort((a, b) =>
        a.room_name.localeCompare(b.room_name, undefined, { numeric: true }),
      ),
    [properties, propertyId],
  )
  const room = rooms.find((r) => r.id === roomId)
  const roomHasOtherResident =
    room?.status === 'occupied' && room.lodgers.some((l) => l.status === 'current')
  const bondSuggestion = room?.weekly_rent != null ? room.weekly_rent * 2 : null

  const submit = () => {
    if (!roomId) {
      toast.error('Pick the room they are moving into')
      return
    }
    if (!moveIn) {
      toast.error('Move-in date is required')
      return
    }
    convert.mutate(
      {
        tenantId: tenant.id,
        roomId,
        moveInDate: moveIn,
        bondAmount: bond ? Number(bond) : null,
      },
      {
        onSuccess: () => {
          toast.success(`${tenant.name} is now an active lodger in ${room?.room_name ?? 'the room'}`)
          setOpen(false)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            Move in {tenant.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="font-body text-sm text-muted-foreground">
            Creates their lodger record, links it back to this lead
            {tenant.source ? ` (${tenant.source}` : ''}
            {tenant.viewing_date
              ? `${tenant.source ? ', ' : ' ('}viewed ${formatDate(tenant.viewing_date)})`
              : tenant.source
                ? ')'
                : ''}
            , and fills the room.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Property</Label>
              <Select
                value={propertyId}
                onValueChange={(v) => {
                  setPropertyId(v)
                  setRoomId('')
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
              <Select value={roomId} onValueChange={setRoomId} disabled={!propertyId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.room_name}
                      {r.status === 'vacant'
                        ? ' (vacant)'
                        : r.next_vacate_date
                          ? ` (vacating ${formatDate(r.next_vacate_date)})`
                          : ' (occupied)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {roomHasOtherResident && !room?.next_vacate_date ? (
            <p className="font-body text-xs text-warning">
              This room is occupied with no vacate notice logged. Log a notice for
              the current lodger first unless the room is shared.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="convert-move-in">Move-in date</Label>
              <Input
                id="convert-move-in"
                type="date"
                value={moveIn}
                onChange={(e) => setMoveIn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="convert-bond">Bond (AUD)</Label>
              <Input
                id="convert-bond"
                type="number"
                min="0"
                value={bond}
                onChange={(e) => setBond(e.target.value)}
                placeholder={bondSuggestion != null ? String(bondSuggestion) : ''}
              />
            </div>
          </div>

          {room ? (
            <p className="font-body text-xs text-muted-foreground">
              {room.room_name} · {formatAud(room.weekly_rent)}/wk
              {bondSuggestion != null ? ` · bond is usually 2× rent (${formatAud(bondSuggestion)})` : ''}
              . {(daysUntil(moveIn) ?? 0) > 0
                ? 'A future move-in is saved as pending until the date arrives.'
                : 'Move-in today or earlier makes them a current lodger straight away.'}
            </p>
          ) : null}

          <Button className="w-full" onClick={submit} disabled={convert.isPending}>
            Convert to active lodger
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
