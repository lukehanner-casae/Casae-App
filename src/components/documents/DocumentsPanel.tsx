import { useState } from 'react'
import { toast } from 'sonner'
import { Download, FileText, Trash2, Upload } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import EmptyState from '@/components/EmptyState'
import ListSkeleton from '@/components/ListSkeleton'
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
import {
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  downloadDocument,
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
  type DocumentRow,
  type DocumentType,
} from '@/hooks/use-documents'
import { useLodgers } from '@/hooks/use-lodgers'
import { formatDate, lodgerName } from '@/lib/format'

function UploadDocumentDialog({
  propertyId,
  fixedLodgerId,
}: {
  propertyId: string
  fixedLodgerId?: string
}) {
  const { user } = useAuth()
  const { data: lodgers } = useLodgers()
  const uploadDocument = useUploadDocument()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<DocumentType>('Other')
  const [lodgerId, setLodgerId] = useState(fixedLodgerId ?? '')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const propertyLodgers = (lodgers ?? []).filter(
    (l) => l.room?.property_id === propertyId,
  )

  const submit = () => {
    if (!file) {
      toast.error('Choose a file to upload')
      return
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      toast.error('File must be 20MB or less')
      return
    }
    uploadDocument.mutate(
      {
        propertyId,
        lodgerId: (fixedLodgerId ?? lodgerId) || null,
        type,
        notes: notes.trim() || null,
        file,
        uploadedBy: user?.id ?? null,
      },
      {
        onSuccess: () => {
          toast.success('Document uploaded')
          setOpen(false)
          setNotes('')
          setFile(null)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="h-4 w-4" /> Upload document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-navy">
            Upload document
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as DocumentType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!fixedLodgerId && (
            <div className="space-y-1.5">
              <Label>Lodger (optional)</Label>
              <Select
                value={lodgerId || 'none'}
                onValueChange={(v) => setLodgerId(v === 'none' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Whole property" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Whole property</SelectItem>
                  {propertyLodgers.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {lodgerName(l)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="doc-file">File (JPEG / PNG / PDF, max 20MB)</Label>
            <Input
              id="doc-file"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-notes">Notes</Label>
            <Textarea
              id="doc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          <Button
            className="w-full"
            onClick={submit}
            disabled={uploadDocument.isPending}
          >
            {uploadDocument.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DocumentRowItem({ doc }: { doc: DocumentRow }) {
  const deleteDocument = useDeleteDocument()

  const download = () =>
    downloadDocument(doc).catch((e) => toast.error(e.message))

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-stone px-3 py-3 last:border-b-0">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm font-medium text-navy">
          {doc.filename}
        </p>
        <p className="truncate font-body text-xs text-muted-foreground">
          Uploaded {formatDate(doc.uploaded_at)}
          {doc.notes ? ` · ${doc.notes}` : ''}
        </p>
      </div>
      <Badge variant="outline" className="border-stone bg-muted text-navy">
        {doc.type}
      </Badge>
      <Button size="sm" variant="secondary" onClick={download}>
        <Download className="h-4 w-4" />
        <span className="sr-only sm:not-sr-only">Download</span>
      </Button>
      <ConfirmDialog
        title="Delete document?"
        description={`"${doc.filename}" will be permanently deleted.`}
        onConfirm={() =>
          deleteDocument.mutate(doc, {
            onSuccess: () => toast.success('Document deleted'),
            onError: (e) => toast.error(e.message),
          })
        }
        trigger={
          <Button size="sm" variant="ghost" className="text-vacant">
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">Delete</span>
          </Button>
        }
      />
    </div>
  )
}

/**
 * Document list + upload. Used on the property detail Documents tab
 * (propertyId) and the lodger profile (propertyId + lodgerId, list filtered
 * to that lodger).
 */
export default function DocumentsPanel({
  propertyId,
  lodgerId,
}: {
  propertyId?: string
  lodgerId?: string
}) {
  const { data: documents, isLoading } = useDocuments({
    propertyId,
    lodgerId,
  })

  return (
    <div className="space-y-4">
      {propertyId && (documents ?? []).length > 0 ? (
        <div className="flex justify-end">
          <UploadDocumentDialog
            propertyId={propertyId}
            fixedLodgerId={lodgerId}
          />
        </div>
      ) : null}
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : (documents ?? []).length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload head leases, agreements and condition reports to keep everything in one place."
          action={
            propertyId ? (
              <UploadDocumentDialog
                propertyId={propertyId}
                fixedLodgerId={lodgerId}
              />
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-md border border-stone bg-card">
          {(documents ?? []).map((doc) => (
            <DocumentRowItem key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  )
}
