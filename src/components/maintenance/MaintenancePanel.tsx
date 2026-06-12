import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
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
import { useAuth } from '@/auth/AuthProvider'
import { useProperties } from '@/hooks/use-properties'
import {
  useCreateJob,
  useMaintenanceJobs,
  useUpdateJob,
  type JobWithRefs,
} from '@/hooks/use-maintenance'
import {
  appendNote,
  formatAud,
  formatDate,
  parseNotes,
  todayIso,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import type { JobPriority, JobStatus } from '@/lib/types'
import {
  priorityClass,
  priorityRank,
  statusClass,
  statusLabel,
} from '@/components/maintenance/priority'

const PRIORITIES: JobPriority[] = ['urgent', 'high', 'medium', 'low']

function CreateJobDialog({ fixedPropertyId }: { fixedPropertyId?: string }) {
  const { user } = useAuth()
  const { data: properties } = useProperties()
  const createJob = useCreateJob()
  const [open, setOpen] = useState(false)
  const [propertyId, setPropertyId] = useState(fixedPropertyId ?? '')
  const [roomId, setRoomId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<JobPriority>('medium')
  const [contractor, setContractor] = useState('')

  const rooms =
    properties?.find((p) => p.id === (fixedPropertyId ?? propertyId))?.rooms ?? []

  const submit = () => {
    if (!(fixedPropertyId ?? propertyId) || !title.trim()) {
      toast.error('Property and title are required')
      return
    }
    createJob.mutate(
      {
        property_id: fixedPropertyId ?? propertyId,
        room_id: roomId || null,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status: 'open',
        reported_by_user_id: user?.id ?? null,
        notes: contractor.trim()
          ? appendNote(null, `Contractor: ${contractor.trim()}`, user?.email)
          : null,
      },
      {
        onSuccess: () => {
          toast.success('Maintenance job created')
          setOpen(false)
          setTitle('')
          setDescription('')
          setRoomId('')
          setContractor('')
          setPriority('medium')
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> New job
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            New maintenance job
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
            <Label>Room (optional)</Label>
            <Select
              value={roomId || 'none'}
              onValueChange={(v) => setRoomId(v === 'none' ? '' : v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Whole property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Whole property</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.room_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-title">Title</Label>
            <Input
              id="job-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Leaking ensuite tap"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-desc">Description</Label>
            <Textarea
              id="job-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as JobPriority)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-contractor">Contractor (optional)</Label>
            <Input
              id="job-contractor"
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              placeholder="Free text for now"
            />
          </div>
          <Button
            className="w-full"
            onClick={submit}
            disabled={createJob.isPending}
          >
            Create job
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CompleteJobDialog({
  job,
  open,
  onOpenChange,
}: {
  job: JobWithRefs
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const updateJob = useUpdateJob()
  const [actualCost, setActualCost] = useState('')
  const [completedDate, setCompletedDate] = useState(todayIso())

  const submit = () => {
    updateJob.mutate(
      {
        id: job.id,
        status: 'completed',
        actual_cost: actualCost ? Number(actualCost) : null,
        completed_at: new Date(completedDate).toISOString(),
      },
      {
        onSuccess: () => {
          toast.success('Job completed')
          onOpenChange(false)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            Complete job
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="font-body text-sm text-muted-foreground">{job.title}</p>
          <div className="space-y-1.5">
            <Label htmlFor="actual-cost">Actual cost (AUD)</Label>
            <Input
              id="actual-cost"
              type="number"
              min="0"
              step="0.01"
              value={actualCost}
              onChange={(e) => setActualCost(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="completed-date">Completion date</Label>
            <Input
              id="completed-date"
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={submit}
            disabled={updateJob.isPending}
          >
            Mark completed
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function JobDetailDialog({
  job,
  open,
  onOpenChange,
}: {
  job: JobWithRefs
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const updateJob = useUpdateJob()
  const [note, setNote] = useState('')
  const notes = parseNotes(job.notes)

  const addNote = () => {
    if (!note.trim()) return
    updateJob.mutate(
      { id: job.id, notes: appendNote(job.notes, note, user?.email) },
      {
        onSuccess: () => {
          setNote('')
          toast.success('Note added')
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            {job.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 font-body text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn('capitalize', priorityClass[job.priority])}>
              {job.priority}
            </Badge>
            <Badge variant="outline" className={statusClass[job.status]}>
              {statusLabel[job.status]}
            </Badge>
            <span className="text-muted-foreground">
              {job.property?.display_name}
              {job.room ? ` · ${job.room.room_name}` : ''}
            </span>
          </div>
          {job.description ? <p>{job.description}</p> : null}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Created {formatDate(job.created_at)}</span>
            {job.completed_at ? (
              <span>
                Completed {formatDate(job.completed_at)} ·{' '}
                {formatAud(job.actual_cost)}
              </span>
            ) : null}
          </div>

          <div>
            <h3 className="mb-2 font-heading text-lg font-semibold text-navy">
              Notes
            </h3>
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No notes yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {notes.map((n, i) => (
                  <li
                    key={i}
                    className="rounded-sm border border-stone bg-muted/50 px-2.5 py-1.5 text-xs"
                  >
                    {n}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note…"
                onKeyDown={(e) => e.key === 'Enter' && addNote()}
              />
              <Button
                variant="secondary"
                onClick={addNote}
                disabled={updateJob.isPending}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function JobRow({ job, showProperty }: { job: JobWithRefs; showProperty: boolean }) {
  const updateJob = useUpdateJob()
  const [completing, setCompleting] = useState(false)
  const [viewing, setViewing] = useState(false)

  const advance = (status: JobStatus) =>
    updateJob.mutate(
      { id: job.id, status },
      { onError: (e) => toast.error(e.message) },
    )

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-stone px-3 py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => setViewing(true)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate font-body text-sm font-medium text-navy">
          {job.title}
        </p>
        <p className="truncate font-body text-xs text-muted-foreground">
          {showProperty ? `${job.property?.display_name ?? ''} · ` : ''}
          {job.room?.room_name ?? 'Whole property'} ·{' '}
          {formatDate(job.created_at)}
        </p>
      </button>
      <Badge className={cn('capitalize', priorityClass[job.priority])}>
        {job.priority}
      </Badge>
      <Badge variant="outline" className={statusClass[job.status]}>
        {statusLabel[job.status]}
      </Badge>
      {job.status === 'open' && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => advance('in-progress')}
        >
          Start
        </Button>
      )}
      {(job.status === 'open' || job.status === 'in-progress') && (
        <Button size="sm" onClick={() => setCompleting(true)}>
          Complete
        </Button>
      )}
      {job.status === 'completed' && job.actual_cost != null && (
        <span className="font-body text-xs text-muted-foreground">
          {formatAud(job.actual_cost)}
        </span>
      )}
      <CompleteJobDialog
        job={job}
        open={completing}
        onOpenChange={setCompleting}
      />
      <JobDetailDialog job={job} open={viewing} onOpenChange={setViewing} />
    </div>
  )
}

export default function MaintenancePanel({
  fixedPropertyId,
}: {
  fixedPropertyId?: string
}) {
  const { data: properties } = useProperties()
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [sort, setSort] = useState<'newest' | 'priority'>('newest')
  const { data: jobs, isLoading } = useMaintenanceJobs(fixedPropertyId)

  const filtered = useMemo(() => {
    let list = jobs ?? []
    if (!fixedPropertyId && propertyFilter !== 'all') {
      list = list.filter((j) => j.property_id === propertyFilter)
    }
    if (statusFilter === 'active') {
      list = list.filter(
        (j) => j.status === 'open' || j.status === 'in-progress',
      )
    } else if (statusFilter !== 'all') {
      list = list.filter((j) => j.status === statusFilter)
    }
    if (sort === 'priority') {
      list = [...list].sort(
        (a, b) => priorityRank[a.priority] - priorityRank[b.priority],
      )
    }
    return list
  }, [jobs, propertyFilter, statusFilter, sort, fixedPropertyId])

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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Open + In Progress</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="priority">By priority</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <CreateJobDialog fixedPropertyId={fixedPropertyId} />
        </div>
      </div>

      <div className="rounded-md border border-stone bg-card">
        {isLoading ? (
          <p className="p-4 font-body text-sm text-muted-foreground">
            Loading…
          </p>
        ) : filtered.length === 0 ? (
          <p className="p-4 font-body text-sm text-muted-foreground">
            No maintenance jobs match.
          </p>
        ) : (
          filtered.map((job) => (
            <JobRow key={job.id} job={job} showProperty={!fixedPropertyId} />
          ))
        )}
      </div>
    </div>
  )
}
