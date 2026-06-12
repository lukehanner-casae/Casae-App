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
import { useRecordMoveOut, type LodgerWithRoom } from '@/hooks/use-lodgers'
import { lodgerName, todayIso } from '@/lib/format'

export default function MoveOutDialog({
  lodger,
  trigger,
}: {
  lodger: LodgerWithRoom
  trigger: ReactNode
}) {
  const recordMoveOut = useRecordMoveOut()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(lodger.expected_move_out ?? todayIso())

  const submit = () => {
    recordMoveOut.mutate(
      { lodger, moveOutDate: date },
      {
        onSuccess: () => {
          toast.success(
            'Move-out recorded — room vacant, end-of-tenancy clean scheduled, bond now tracked for return',
          )
          setOpen(false)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            Record move-out
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="font-body text-sm text-muted-foreground">
            {lodgerName(lodger)} —{' '}
            {lodger.room?.property?.display_name ?? 'no property'}
            {lodger.room ? `, ${lodger.room.room_name}` : ''}. This sets the
            lodger to former, marks the room vacant, schedules an
            end-of-tenancy clean, and keeps the bond on the books until its
            return is recorded.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="move-out-date">Move-out date</Label>
            <Input
              id="move-out-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            variant="destructive"
            onClick={submit}
            disabled={recordMoveOut.isPending}
          >
            Record move-out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
