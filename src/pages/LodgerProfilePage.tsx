import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, DoorOpen, FileText, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import LodgerFormDialog from '@/components/lodgers/LodgerFormDialog'
import MoveOutDialog from '@/components/lodgers/MoveOutDialog'
import { useAuth } from '@/auth/AuthProvider'
import { useLodger, useUpdateLodger } from '@/hooks/use-lodgers'
import {
  appendNote,
  formatAud,
  formatDate,
  lodgerName,
  parseNotes,
} from '@/lib/format'
import { cn } from '@/lib/utils'

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="font-body text-xs text-muted-foreground">{label}</p>
      <p className="font-body text-sm text-navy">{value ?? '—'}</p>
    </div>
  )
}

export default function LodgerProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { data: lodger, isLoading } = useLodger(id)
  const updateLodger = useUpdateLodger()
  const [note, setNote] = useState('')

  if (isLoading) {
    return <p className="font-body text-sm text-muted-foreground">Loading…</p>
  }
  if (!lodger) {
    return (
      <p className="font-body text-sm text-muted-foreground">
        Lodger not found.
      </p>
    )
  }

  const notes = parseNotes(lodger.notes)

  const addNote = () => {
    if (!note.trim()) return
    updateLodger.mutate(
      { id: lodger.id, notes: appendNote(lodger.notes, note, user?.email) },
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
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/lodgers"
        className="inline-flex items-center gap-1.5 font-body text-sm text-muted-foreground hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> All lodgers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-semibold text-navy">
            {lodgerName(lodger)}
          </h1>
          <div className="mt-2 h-0.5 w-12 bg-sage" />
          <div className="mt-3 flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'capitalize',
                lodger.status === 'current'
                  ? 'border-sage/40 bg-sage/10 text-sage'
                  : lodger.status === 'pending'
                    ? 'border-warning/50 bg-amber-50 text-amber-700'
                    : 'border-stone bg-muted text-muted-foreground',
              )}
            >
              {lodger.status}
            </Badge>
            {lodger.room?.property && (
              <Link
                to={`/properties/${lodger.room.property.id}`}
                className="font-body text-sm text-muted-foreground underline-offset-2 hover:underline"
              >
                {lodger.room.property.display_name} · {lodger.room.room_name}
              </Link>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <LodgerFormDialog
            lodger={lodger}
            trigger={
              <Button size="sm" variant="secondary">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            }
          />
          {lodger.status !== 'former' && (
            <MoveOutDialog
              lodger={lodger}
              trigger={
                <Button size="sm" variant="destructive">
                  <DoorOpen className="h-4 w-4" /> Record move-out
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-4 pt-4 sm:grid-cols-3">
          <Field label="Email" value={lodger.email} />
          <Field label="Phone" value={lodger.phone} />
          <Field
            label="Rent / week"
            value={formatAud(lodger.room?.weekly_rent)}
          />
          <Field label="Move-in" value={formatDate(lodger.move_in_date)} />
          <Field
            label="Expected move-out"
            value={formatDate(lodger.expected_move_out)}
          />
          <Field
            label="Bond"
            value={
              lodger.bond_amount == null
                ? '—'
                : `${formatAud(lodger.bond_amount)}${
                    lodger.bond_returned_date
                      ? ` (returned ${formatDate(lodger.bond_returned_date)})`
                      : lodger.bond_received_date
                        ? ` (received ${formatDate(lodger.bond_received_date)})`
                        : ' (pending receipt)'
                  }`
            }
          />
          <Field
            label="Agreement"
            value={
              lodger.lodging_agreement_signed
                ? `Signed${lodger.lodging_agreement_date ? ` ${formatDate(lodger.lodging_agreement_date)}` : ''}`
                : 'Not signed'
            }
          />
          {lodger.is_couple && (
            <Field label="Couple partner" value={lodger.partner_name} />
          )}
          <Field
            label="Emergency contact"
            value={
              lodger.emergency_contact_name
                ? `${lodger.emergency_contact_name}${lodger.emergency_contact_phone ? ` · ${lodger.emergency_contact_phone}` : ''}`
                : '—'
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-xl text-navy">
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notes.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground">
              No notes yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {notes.map((n, i) => (
                <li
                  key={i}
                  className="rounded-sm border border-stone bg-muted/50 px-2.5 py-1.5 font-body text-xs"
                >
                  {n}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note…"
              onKeyDown={(e) => e.key === 'Enter' && addNote()}
            />
            <Button
              variant="secondary"
              onClick={addNote}
              disabled={updateLodger.isPending}
            >
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-xl text-navy">
            Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-md border border-dashed border-stone p-6">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <p className="font-body text-sm text-muted-foreground">
              Document storage (lodging agreements, condition reports) arrives
              with the Document Storage feature. Files currently live in
              SharePoint.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
