import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Building2, Mail, Pencil, Phone, Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { useAuth } from '@/auth/AuthProvider'
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
} from '@/hooks/use-contacts'
import { useProperties } from '@/hooks/use-properties'
import { appendNote, formatDate, parseNotes, todayIso } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Contact, ContactType } from '@/lib/types'

const CONTACT_TYPES: { value: ContactType; label: string }[] = [
  { value: 'landlord', label: 'Landlord' },
  { value: 'agent', label: 'Agent' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'other', label: 'Other' },
]

const typeBadge: Record<ContactType, string> = {
  landlord: 'border-sage/40 bg-sage/10 text-sage',
  agent: 'border-blue-500/40 bg-blue-50 text-blue-700',
  contractor: 'border-amber-500/40 bg-amber-50 text-amber-700',
  other: 'border-stone bg-muted text-muted-foreground',
}

function contactName(c: Contact): string {
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ')
  return name || c.company_name || '—'
}

function ContactFormDialog({
  contact,
  trigger,
}: {
  contact?: Contact
  trigger: ReactNode
}) {
  const createContact = useCreateContact()
  const updateContact = useUpdateContact()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    type: 'other' as ContactType,
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    phone: '',
    trade_type: '',
    last_contact_date: '',
  })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setForm({
        type: contact?.type ?? 'other',
        first_name: contact?.first_name ?? '',
        last_name: contact?.last_name ?? '',
        company_name: contact?.company_name ?? '',
        email: contact?.email ?? '',
        phone: contact?.phone ?? '',
        trade_type: contact?.trade_type ?? '',
        last_contact_date: contact?.last_contact_date ?? '',
      })
    }
  }

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const submit = () => {
    if (!form.first_name.trim() && !form.company_name.trim()) {
      toast.error('A name or company is required')
      return
    }
    const payload = {
      type: form.type,
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      company_name: form.company_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      trade_type:
        form.type === 'contractor' ? form.trade_type.trim() || null : null,
      last_contact_date: form.last_contact_date || null,
    }
    const opts = {
      onSuccess: () => {
        toast.success(contact ? 'Contact updated' : 'Contact added')
        setOpen(false)
      },
      onError: (e: Error) => toast.error(e.message),
    }
    if (contact) {
      updateContact.mutate({ id: contact.id, ...payload }, opts)
    } else {
      createContact.mutate(payload, opts)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            {contact ? 'Edit contact' : 'Add contact'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => set('type', v as ContactType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input
              value={form.company_name}
              onChange={(e) => set('company_name', e.target.value)}
            />
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
          {form.type === 'contractor' && (
            <div className="space-y-1.5">
              <Label>Trade</Label>
              <Input
                value={form.trade_type}
                onChange={(e) => set('trade_type', e.target.value)}
                placeholder="plumber / electrician / …"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Last contact date</Label>
            <Input
              type="date"
              value={form.last_contact_date}
              onChange={(e) => set('last_contact_date', e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            onClick={submit}
            disabled={createContact.isPending || updateContact.isPending}
          >
            {contact ? 'Save changes' : 'Add contact'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ContactCard({
  contact,
  linkedProperties,
}: {
  contact: Contact
  linkedProperties: { id: string; name: string }[]
}) {
  const { user } = useAuth()
  const updateContact = useUpdateContact()
  const [note, setNote] = useState('')
  const notes = parseNotes(contact.notes)

  const addNote = () => {
    if (!note.trim()) return
    updateContact.mutate(
      {
        id: contact.id,
        notes: appendNote(contact.notes, note, user?.email),
        last_contact_date: todayIso(),
      },
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
    <Card>
      <CardContent className="space-y-3 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-heading text-xl font-semibold text-navy">
              {contactName(contact)}
            </p>
            {contact.company_name &&
              contactName(contact) !== contact.company_name && (
                <p className="font-body text-sm text-muted-foreground">
                  {contact.company_name}
                </p>
              )}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn('capitalize', typeBadge[contact.type])}
            >
              {contact.type}
              {contact.trade_type ? ` · ${contact.trade_type}` : ''}
            </Badge>
            <ContactFormDialog
              contact={contact}
              trigger={
                <Button size="icon" variant="ghost" className="h-7 w-7">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1 font-body text-sm text-muted-foreground">
          {contact.email && (
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> {contact.email}
            </span>
          )}
          {contact.phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> {contact.phone}
            </span>
          )}
          <span>Last contact {formatDate(contact.last_contact_date)}</span>
        </div>

        {linkedProperties.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 font-body text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            {linkedProperties.map((p) => (
              <Link
                key={p.id}
                to={`/properties/${p.id}`}
                className="rounded-sm border border-stone bg-muted/50 px-1.5 py-0.5 text-navy underline-offset-2 hover:underline"
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}

        <div>
          {notes.length > 0 && (
            <ul className="mb-2 space-y-1.5">
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
              placeholder="Log a call, email or note…"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && addNote()}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={addNote}
              disabled={updateContact.isPending}
            >
              Add
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ContactsPage() {
  const { data: contacts, isLoading } = useContacts()
  const { data: properties } = useProperties()
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = useMemo(() => {
    let list = contacts ?? []
    if (typeFilter !== 'all') {
      list = list.filter((c) => c.type === typeFilter)
    }
    return list
  }, [contacts, typeFilter])

  const linkedFor = (contactId: string) =>
    (properties ?? [])
      .filter(
        (p) =>
          p.landlord_contact_id === contactId ||
          p.agent_contact_id === contactId,
      )
      .map((p) => ({ id: p.id, name: p.display_name }))

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Contacts"
        actions={
          <ContactFormDialog
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> Add contact
              </Button>
            }
          />
        }
      />

      <div className="flex items-center gap-2">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {CONTACT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="font-body text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              linkedProperties={linkedFor(contact.id)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="font-body text-sm text-muted-foreground">
              No contacts match.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
