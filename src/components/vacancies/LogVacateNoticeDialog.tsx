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
import { Textarea } from '@/components/ui/textarea'
import { useProperties } from '@/hooks/use-properties'
import { useLogVacateNotice } from '@/hooks/use-vacate-notices'
import { formatDate, lodgerName, todayIso } from '@/lib/format'
import type { Lodger } from '@/lib/types'

/** Lodgers who can give notice: living in the room and not already on notice. */
function eligible(l: Lodger): boolean {
  return l.status === 'current' || l.status === 'pending'
}

/**
 * "Log Vacate Notice": Property → Room → Lodger (auto-filled from the room's
 * occupant) → Vacate date. Lodger becomes notice_given and the room enters
 * the vacate pipeline. Any team login can do this.
 */
export default function LogVacateNoticeDialog({
  trigger,
  defaultPropertyId,
  defaultRoomId,
  defaultLodgerId,
}: {
  trigger: ReactNode
  defaultPropertyId?: string
  defaultRoomId?: string
  defaultLodgerId?: string
}) {
  const { data: properties } = useProperties()
  const logNotice = useLogVacateNotice()
  const [open, setOpen] = useState(false)
  const [propertyId, setPropertyId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [lodgerId, setLodgerId] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')

  const property = properties?.find((p) => p.id === propertyId)
  const rooms = useMemo(
    () =>
      [...(property?.rooms ?? [])].sort((a, b) =>
        a.room_name.localeCompare(b.room_name, undefined, { numeric: true }),
      ),
    [property],
  )
  const room = rooms.find((r) => r.id === roomId)
  const lodgers = (room?.lodgers ?? []).filter(eligible)
  const lodger = lodgers.find((l) => l.id === lodgerId)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) return
    const p = defaultPropertyId ?? ''
    const r = defaultRoomId ?? ''
    const roomLodgers =
      properties
        ?.find((x) => x.id === p)
        ?.rooms.find((x) => x.id === r)
        ?.lodgers.filter(eligible) ?? []
    const l = defaultLodgerId ?? roomLodgers[0]?.id ?? ''
    setPropertyId(p)
    setRoomId(r)
    setLodgerId(l)
    setDate(roomLodgers.find((x) => x.id === l)?.expected_move_out ?? '')
    setNotes('')
  }

  const pickRoom = (id: string) => {
    setRoomId(id)
    const occupants =
      rooms.find((r) => r.id === id)?.lodgers.filter(eligible) ?? []
    const first = occupants[0]
    setLodgerId(first?.id ?? '')
    setDate(first?.expected_move_out ?? '')
  }

  const pickLodger = (id: string) => {
    setLodgerId(id)
    const l = lodgers.find((x) => x.id === id)
    if (l?.expected_move_out) setDate(l.expected_move_out)
  }

  const submit = () => {
    if (!propertyId || !roomId || !lodgerId) {
      toast.error('Select the property, room and lodger')
      return
    }
    if (!date) {
      toast.error('Vacate date is required')
      return
    }
    logNotice.mutate(
      {
        property_id: propertyId,
        room_id: roomId,
        lodger_id: lodgerId,
        vacate_date: date,
        notes: notes.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(
            `Notice logged — ${room?.room_name ?? 'room'} vacates ${formatDate(date)}`,
          )
          setOpen(false)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            Log vacate notice
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Property</Label>
            <Select
              value={propertyId}
              onValueChange={(v) => {
                setPropertyId(v)
                setRoomId('')
                setLodgerId('')
                setDate('')
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select property" />
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
            <Select value={roomId} onValueChange={pickRoom} disabled={!propertyId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => {
                  const occupants = r.lodgers.filter(eligible)
                  return (
                    <SelectItem key={r.id} value={r.id} disabled={occupants.length === 0}>
                      {r.room_name}
                      {r.status === 'notice_given'
                        ? ' — notice already given'
                        : occupants.length === 0
                          ? ' — vacant'
                          : ` — ${lodgerName(occupants[0])}`}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Lodger</Label>
            <Select value={lodgerId} onValueChange={pickLodger} disabled={!roomId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select lodger" />
              </SelectTrigger>
              <SelectContent>
                {lodgers.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {lodgerName(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lodgers.length > 1 ? (
              <p className="font-body text-xs text-muted-foreground">
                This room has more than one lodger — check the right one is selected.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vacate-date">Vacate date</Label>
            <Input
              id="vacate-date"
              type="date"
              min={todayIso()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vacate-notes">Notes (optional)</Label>
            <Textarea
              id="vacate-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason, forwarding details, anything for the handover…"
            />
          </div>

          {lodger ? (
            <p className="font-body text-sm text-muted-foreground">
              {lodgerName(lodger)} will be marked <strong className="text-navy">Notice Given</strong>
              {date ? ` and ${room?.room_name} enters the vacate pipeline for ${formatDate(date)}` : ''}.
              The room flips to vacant automatically on that date unless a replacement has moved in.
            </p>
          ) : null}

          <Button
            className="w-full"
            onClick={submit}
            disabled={logNotice.isPending}
          >
            Log vacate notice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
