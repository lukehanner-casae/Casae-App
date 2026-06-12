import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Trash2, Wrench } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useSignedDocumentUrl } from '@/hooks/use-documents'
import {
  useDeleteInspection,
  useInspection,
  type InspectionWithProperty,
} from '@/hooks/use-inspections'
import { useCreateJob } from '@/hooks/use-maintenance'
import { conditionClass } from '@/components/inspections/condition'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { JobPriority } from '@/lib/types'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="font-body text-xs text-muted-foreground">{label}</p>
      <p className="font-body text-sm text-navy">{value ?? '—'}</p>
    </div>
  )
}

function InspectionPhoto({ path }: { path: string }) {
  const { data: url } = useSignedDocumentUrl(path)
  if (!url) {
    return (
      <div className="aspect-square animate-pulse rounded-md bg-muted" />
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt="Inspection photo"
        className="aspect-square w-full rounded-md border border-stone object-cover"
      />
    </a>
  )
}

const PRIORITIES: JobPriority[] = ['urgent', 'high', 'medium', 'low']

function CreateFollowUpJobDialog({
  inspection,
}: {
  inspection: InspectionWithProperty
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const createJob = useCreateJob()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(
    `Inspection follow-up — ${inspection.property?.display_name ?? 'property'}`,
  )
  const [description, setDescription] = useState(
    [inspection.follow_up_notes, inspection.notes]
      .filter(Boolean)
      .join('\n\n') ||
      `Follow-up from inspection on ${formatDate(inspection.scheduled_date)}.`,
  )
  const [priority, setPriority] = useState<JobPriority>('medium')

  const submit = () => {
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    createJob.mutate(
      {
        property_id: inspection.property_id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        status: 'open',
        reported_by_user_id: user?.id ?? null,
      },
      {
        onSuccess: () => {
          toast.success('Maintenance job created')
          setOpen(false)
          navigate('/maintenance')
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Wrench className="h-4 w-4" /> Create maintenance job from follow-up
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            New maintenance job
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="font-body text-sm text-muted-foreground">
            {inspection.property?.display_name} · pre-filled from this
            inspection.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="fu-title">Title</Label>
            <Input
              id="fu-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fu-desc">Description</Label>
            <Textarea
              id="fu-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
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

export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: inspection, isLoading } = useInspection(id)
  const deleteInspection = useDeleteInspection()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }
  if (!inspection) {
    return (
      <p className="font-body text-sm text-muted-foreground">
        Inspection not found.
      </p>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/inspections"
        className="inline-flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> All inspections
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-semibold text-navy">
            {inspection.property?.display_name ?? 'Inspection'}
          </h1>
          <div className="mt-2 h-0.5 w-12 bg-sage" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
            {inspection.follow_up_required && (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-50 text-amber-700"
              >
                Follow-up required
              </Badge>
            )}
            {inspection.property && (
              <Link
                to={`/properties/${inspection.property.id}`}
                className="font-body text-sm text-muted-foreground underline-offset-2 hover:underline"
              >
                View property
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <CreateFollowUpJobDialog inspection={inspection} />
          <ConfirmDialog
            title="Delete inspection?"
            description="The inspection and its photos will be permanently deleted."
            onConfirm={() =>
              deleteInspection.mutate(inspection, {
                onSuccess: () => {
                  toast.success('Inspection deleted')
                  navigate('/inspections')
                },
                onError: (e) => toast.error(e.message),
              })
            }
            trigger={
              <Button size="sm" variant="destructive">
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            }
          />
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-4 pt-4 sm:grid-cols-3">
          <Field
            label="Scheduled"
            value={formatDate(inspection.scheduled_date)}
          />
          <Field
            label="Conducted"
            value={
              inspection.conducted_date
                ? formatDate(inspection.conducted_date)
                : 'Not yet'
            }
          />
          <Field label="Conducted by" value={inspection.conducted_by} />
        </CardContent>
      </Card>

      {inspection.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-xl text-navy">
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap font-body text-sm text-navy">
              {inspection.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {inspection.follow_up_required && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-xl text-navy">
              Follow-up
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap font-body text-sm text-navy">
              {inspection.follow_up_notes ?? 'Follow-up required — no notes.'}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-xl text-navy">
            Photos ({inspection.photo_paths.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inspection.photo_paths.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground">
              No photos uploaded.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {inspection.photo_paths.map((path) => (
                <InspectionPhoto key={path} path={path} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
