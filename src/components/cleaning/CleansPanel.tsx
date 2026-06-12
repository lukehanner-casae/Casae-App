import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CalendarPlus, Check, Plus, Repeat } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import {
  useCleans,
  useCreateClean,
  useCreateRecurringCleans,
  useUpdateClean,
  type CleanWithProperty,
} from '@/hooks/use-cleans'
import { formatDate, todayIso } from '@/lib/format'
import type { CleanType } from '@/lib/types'

const CLEAN_TYPES: { value: CleanType; label: string }[] = [
  { value: 'routine', label: 'Routine' },
  { value: 'end-of-tenancy', label: 'End of tenancy' },
  { value: 'pre-move-in', label: 'Pre move-in' },
]

const cleanTypeClass: Record<CleanType, string> = {
  routine: 'border-stone bg-muted text-navy',
  'end-of-tenancy': 'border-amber-500/40 bg-amber-50 text-amber-700',
  'pre-move-in': 'border-sage/40 bg-sage/10 text-sage',
}

/** Monday of the week containing the given date, as YYYY-MM-DD. */
function weekStart(dateIso: string): string {
  const d = new Date(dateIso)
  const day = (d.getDay() + 6) % 7 // Mon = 0
  d.setDate(d.getDate() - day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function AddCleanDialog({ fixedPropertyId }: { fixedPropertyId?: string }) {
  const { data: properties } = useProperties()
  const createClean = useCreateClean()
  const [open, setOpen] = useState(false)
  const [propertyId, setPropertyId] = useState(fixedPropertyId ?? '')
  const [date, setDate] = useState(todayIso())
  const [type, setType] = useState<CleanType>('routine')
  const [assignedTo, setAssignedTo] = useState('')
  const [notes, setNotes] = useState('')

  const submit = () => {
    if (!(fixedPropertyId ?? propertyId) || !date) {
      toast.error('Property and date are required')
      return
    }
    createClean.mutate(
      {
        property_id: fixedPropertyId ?? propertyId,
        scheduled_date: date,
        clean_type: type,
        assigned_to: assignedTo.trim() || null,
        notes: notes.trim() || null,
        status: 'scheduled',
      },
      {
        onSuccess: () => {
          toast.success('Clean scheduled')
          setOpen(false)
          setAssignedTo('')
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
          <Plus className="h-4 w-4" /> Add clean
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            Schedule a clean
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {!fixedPropertyId && (
            <div className="space-y-1.5">
              <Label>Property</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
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
          )}
          <div className="space-y-1.5">
            <Label htmlFor="clean-date">Date</Label>
            <Input
              id="clean-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CleanType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLEAN_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clean-assigned">Assigned to</Label>
            <Input
              id="clean-assigned"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="Cleaner name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clean-notes">Notes</Label>
            <Textarea
              id="clean-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <Button
            className="w-full"
            onClick={submit}
            disabled={createClean.isPending}
          >
            Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RecurringDialog({ fixedPropertyId }: { fixedPropertyId?: string }) {
  const { data: properties } = useProperties()
  const createRecurring = useCreateRecurringCleans()
  const [open, setOpen] = useState(false)
  const [propertyId, setPropertyId] = useState(fixedPropertyId ?? '')
  const [startDate, setStartDate] = useState(todayIso())
  const [recurrence, setRecurrence] = useState<'weekly' | 'fortnightly'>(
    'weekly',
  )
  const [assignedTo, setAssignedTo] = useState('')

  const submit = () => {
    const pid = fixedPropertyId ?? propertyId
    if (!pid || !startDate) {
      toast.error('Property and start date are required')
      return
    }
    createRecurring.mutate(
      {
        propertyId: pid,
        startDate,
        recurrence,
        assignedTo: assignedTo.trim() || null,
      },
      {
        onSuccess: (count) => {
          toast.success(`${count} cleans scheduled (8 weeks forward)`)
          setOpen(false)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Repeat className="h-4 w-4" /> Recurring
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            Recurring cleans
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="font-body text-sm text-muted-foreground">
            Auto-generates routine cleans 8 weeks forward.
          </p>
          {!fixedPropertyId && (
            <div className="space-y-1.5">
              <Label>Property</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
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
          )}
          <div className="space-y-1.5">
            <Label htmlFor="rec-start">First clean</Label>
            <Input
              id="rec-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Frequency</Label>
            <Select
              value={recurrence}
              onValueChange={(v) => setRecurrence(v as typeof recurrence)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="fortnightly">Fortnightly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rec-assigned">Assigned to</Label>
            <Input
              id="rec-assigned"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={submit}
            disabled={createRecurring.isPending}
          >
            <CalendarPlus className="h-4 w-4" /> Generate cleans
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CleanRow({
  clean,
  showProperty,
}: {
  clean: CleanWithProperty
  showProperty: boolean
}) {
  const updateClean = useUpdateClean()

  const complete = () =>
    updateClean.mutate(
      {
        id: clean.id,
        status: 'completed',
        completed_at: new Date().toISOString(),
      },
      {
        onSuccess: () => toast.success('Clean marked complete'),
        onError: (e) => toast.error(e.message),
      },
    )

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-stone px-3 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="font-body text-sm font-medium text-navy">
          {formatDate(clean.scheduled_date)}
          {showProperty ? ` · ${clean.property?.display_name ?? ''}` : ''}
        </p>
        <p className="truncate font-body text-xs text-muted-foreground">
          {clean.assigned_to ? `Assigned to ${clean.assigned_to}` : 'Unassigned'}
          {clean.notes ? ` · ${clean.notes}` : ''}
        </p>
      </div>
      <Badge variant="outline" className={cleanTypeClass[clean.clean_type]}>
        {CLEAN_TYPES.find((t) => t.value === clean.clean_type)?.label ??
          clean.clean_type}
      </Badge>
      {clean.status === 'scheduled' ? (
        <Button size="sm" variant="secondary" onClick={complete}>
          <Check className="h-4 w-4" /> Done
        </Button>
      ) : (
        <Badge
          variant="outline"
          className={
            clean.status === 'completed'
              ? 'border-sage/40 bg-sage/10 text-sage'
              : 'border-stone bg-muted text-muted-foreground'
          }
        >
          {clean.status === 'completed' ? 'Completed' : 'Skipped'}
        </Badge>
      )}
    </div>
  )
}

export default function CleansPanel({
  fixedPropertyId,
}: {
  fixedPropertyId?: string
}) {
  const { data: properties } = useProperties()
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [weekFilter, setWeekFilter] = useState('upcoming')
  const { data: cleans, isLoading } = useCleans(fixedPropertyId)

  const weeks = useMemo(() => {
    const set = new Set<string>()
    for (const c of cleans ?? []) {
      if (c.scheduled_date) set.add(weekStart(c.scheduled_date))
    }
    return [...set].sort()
  }, [cleans])

  const filtered = useMemo(() => {
    let list = cleans ?? []
    if (!fixedPropertyId && propertyFilter !== 'all') {
      list = list.filter((c) => c.property_id === propertyFilter)
    }
    const today = todayIso()
    if (weekFilter === 'upcoming') {
      list = list.filter(
        (c) =>
          c.status === 'scheduled' &&
          c.scheduled_date != null &&
          c.scheduled_date >= today,
      )
    } else if (weekFilter !== 'all') {
      list = list.filter(
        (c) => c.scheduled_date && weekStart(c.scheduled_date) === weekFilter,
      )
    }
    return list
  }, [cleans, propertyFilter, weekFilter, fixedPropertyId])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!fixedPropertyId && (
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[160px]">
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
        )}
        <Select value={weekFilter} onValueChange={setWeekFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {weeks.map((w) => (
              <SelectItem key={w} value={w}>
                Week of {formatDate(w)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <RecurringDialog fixedPropertyId={fixedPropertyId} />
          <AddCleanDialog fixedPropertyId={fixedPropertyId} />
        </div>
      </div>

      <div className="rounded-md border border-stone bg-card">
        {isLoading ? (
          <p className="p-4 font-body text-sm text-muted-foreground">
            Loading…
          </p>
        ) : filtered.length === 0 ? (
          <p className="p-4 font-body text-sm text-muted-foreground">
            No cleans match.
          </p>
        ) : (
          filtered.map((clean) => (
            <CleanRow
              key={clean.id}
              clean={clean}
              showProperty={!fixedPropertyId}
            />
          ))
        )}
      </div>
    </div>
  )
}
