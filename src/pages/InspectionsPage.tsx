import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Camera, ChevronRight, ClipboardCheck, Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import ListSkeleton from '@/components/ListSkeleton'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import { useProperties } from '@/hooks/use-properties'
import {
  INSPECTION_CONDITIONS,
  useCreateInspection,
  useInspections,
} from '@/hooks/use-inspections'
import { conditionClass } from '@/components/inspections/condition'
import { formatDate, todayIso } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { InspectionCondition } from '@/lib/types'

function CreateInspectionDialog() {
  const { data: properties } = useProperties()
  const createInspection = useCreateInspection()
  const [open, setOpen] = useState(false)
  const [propertyId, setPropertyId] = useState('')
  const [scheduledDate, setScheduledDate] = useState(todayIso())
  const [conductedDate, setConductedDate] = useState('')
  const [conductedBy, setConductedBy] = useState('')
  const [condition, setCondition] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [followUpRequired, setFollowUpRequired] = useState(false)
  const [followUpNotes, setFollowUpNotes] = useState('')

  const reset = () => {
    setPropertyId('')
    setScheduledDate(todayIso())
    setConductedDate('')
    setConductedBy('')
    setCondition('')
    setNotes('')
    setPhotos([])
    setFollowUpRequired(false)
    setFollowUpNotes('')
  }

  const submit = () => {
    if (!propertyId || !scheduledDate) {
      toast.error('Property and scheduled date are required')
      return
    }
    createInspection.mutate(
      {
        inspection: {
          property_id: propertyId,
          scheduled_date: scheduledDate,
          conducted_date: conductedDate || null,
          conducted_by: conductedBy.trim() || null,
          overall_condition: (condition || null) as InspectionCondition | null,
          notes: notes.trim() || null,
          follow_up_required: followUpRequired,
          follow_up_notes: followUpRequired
            ? followUpNotes.trim() || null
            : null,
        },
        photos,
      },
      {
        onSuccess: () => {
          toast.success('Inspection saved')
          setOpen(false)
          reset()
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New inspection
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            New inspection
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="insp-scheduled">Scheduled</Label>
              <Input
                id="insp-scheduled"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="insp-conducted">Conducted (optional)</Label>
              <Input
                id="insp-conducted"
                type="date"
                value={conductedDate}
                onChange={(e) => setConductedDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="insp-by">Conducted by</Label>
            <Input
              id="insp-by"
              value={conductedBy}
              onChange={(e) => setConductedBy(e.target.value)}
              placeholder="e.g. Erin"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Overall condition</Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Not assessed yet" />
              </SelectTrigger>
              <SelectContent>
                {INSPECTION_CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="insp-notes">Notes</Label>
            <Textarea
              id="insp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="insp-photos">Photos (JPEG / PNG)</Label>
            <Input
              id="insp-photos"
              type="file"
              accept="image/jpeg,image/png"
              multiple
              onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
            />
            {photos.length > 0 && (
              <p className="font-body text-xs text-muted-foreground">
                {photos.length} photo{photos.length === 1 ? '' : 's'} selected
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="insp-followup"
              checked={followUpRequired}
              onCheckedChange={(v) => setFollowUpRequired(v === true)}
            />
            <Label htmlFor="insp-followup">Follow-up required</Label>
          </div>
          {followUpRequired && (
            <div className="space-y-1.5">
              <Label htmlFor="insp-followup-notes">Follow-up notes</Label>
              <Textarea
                id="insp-followup-notes"
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                rows={2}
              />
            </div>
          )}
          <Button
            className="w-full"
            onClick={submit}
            disabled={createInspection.isPending}
          >
            {createInspection.isPending ? 'Saving…' : 'Save inspection'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function InspectionsPage() {
  const { data: properties } = useProperties()
  const { data: inspections, isLoading } = useInspections()
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const filtered = useMemo(() => {
    let list = inspections ?? []
    if (propertyFilter !== 'all') {
      list = list.filter((i) => i.property_id === propertyFilter)
    }
    if (fromDate) {
      list = list.filter((i) => i.scheduled_date && i.scheduled_date >= fromDate)
    }
    if (toDate) {
      list = list.filter((i) => i.scheduled_date && i.scheduled_date <= toDate)
    }
    return list
  }, [inspections, propertyFilter, fromDate, toDate])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Inspections"
        description="Routine property inspections — condition, photos, follow-ups."
        actions={<CreateInspectionDialog />}
      />

      <div className="flex flex-wrap items-center gap-2">
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
        <div className="flex items-center gap-2">
          <Input
            type="date"
            className="w-[150px]"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
          />
          <span className="font-body text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="w-[150px]"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
          />
        </div>
      </div>

      {isLoading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No inspections"
          description="Nothing matches the current filters. Schedule an inspection to record condition, photos and follow-ups."
          action={<CreateInspectionDialog />}
        />
      ) : (
        <div className="rounded-md border border-stone bg-card">
          {filtered.map((inspection) => (
            <Link
              key={inspection.id}
              to={`/inspections/${inspection.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-stone px-3 py-3 transition-colors last:border-b-0 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="font-body text-sm font-medium text-navy">
                  {inspection.property?.display_name ?? '—'} ·{' '}
                  {formatDate(inspection.scheduled_date)}
                </p>
                <p className="truncate font-body text-xs text-muted-foreground">
                  {inspection.conducted_date
                    ? `Conducted ${formatDate(inspection.conducted_date)}${
                        inspection.conducted_by
                          ? ` by ${inspection.conducted_by}`
                          : ''
                      }`
                    : 'Not conducted yet'}
                </p>
              </div>
              {inspection.photo_paths.length > 0 && (
                <span className="flex items-center gap-1 font-body text-xs text-muted-foreground">
                  <Camera className="h-3.5 w-3.5" />
                  {inspection.photo_paths.length}
                </span>
              )}
              {inspection.follow_up_required && (
                <Badge
                  variant="outline"
                  className="border-amber-500/40 bg-amber-50 text-amber-700"
                >
                  Follow-up
                </Badge>
              )}
              {inspection.overall_condition ? (
                <Badge
                  variant="outline"
                  className={cn(
                    'capitalize',
                    conditionClass[inspection.overall_condition],
                  )}
                >
                  {inspection.overall_condition}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-stone bg-muted text-muted-foreground"
                >
                  Scheduled
                </Badge>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
