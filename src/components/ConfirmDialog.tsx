import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * Confirmation wrapper for destructive actions. Either renders `trigger` and
 * manages its own open state, or is driven by `open` / `onOpenChange` (e.g.
 * opened from a dropdown menu item, where a nested trigger would unmount
 * with the menu).
 */
export default function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Delete',
  onConfirm,
  open: controlledOpen,
  onOpenChange,
}: {
  trigger?: ReactNode
  title: string
  description?: ReactNode
  confirmLabel?: string
  onConfirm: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="font-body text-sm">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm()
              setOpen(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
