import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export const DOCUMENT_TYPES = [
  'Head Lease',
  'Lodging Agreement',
  'Condition Report',
  'Bond Lodgement',
  'Insurance',
  'BAS',
  'Other',
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export interface DocumentRow {
  id: string
  property_id: string
  lodger_id: string | null
  type: string
  filename: string
  storage_path: string
  notes: string | null
  uploaded_by: string | null
  uploaded_at: string
}

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

export function useDocuments(filter: {
  propertyId?: string
  lodgerId?: string
}) {
  return useQuery({
    queryKey: [
      'documents',
      { propertyId: filter.propertyId ?? null, lodgerId: filter.lodgerId ?? null },
    ],
    queryFn: async (): Promise<DocumentRow[]> => {
      let q = supabase
        .from('documents')
        .select('*')
        .order('uploaded_at', { ascending: false })
      if (filter.propertyId) q = q.eq('property_id', filter.propertyId)
      if (filter.lodgerId) q = q.eq('lodger_id', filter.lodgerId)
      const { data, error } = await q
      if (error) throw error
      return data as DocumentRow[]
    },
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      propertyId,
      lodgerId,
      type,
      notes,
      file,
      uploadedBy,
    }: {
      propertyId: string
      lodgerId: string | null
      type: DocumentType
      notes: string | null
      file: File
      uploadedBy: string | null
    }) => {
      const safeName = file.name.replace(/[^A-Za-z0-9_.-]+/g, '_')
      const safeType = type.replace(/\s+/g, '-').toLowerCase()
      const path = `${propertyId}/${safeType}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(path, file)
      if (uploadError) throw uploadError
      const { error } = await supabase.from('documents').insert({
        property_id: propertyId,
        lodger_id: lodgerId,
        type,
        filename: file.name,
        storage_path: path,
        notes,
        uploaded_by: uploadedBy,
      })
      if (error) {
        // Don't leave an orphaned file if the metadata insert fails.
        await supabase.storage.from('documents').remove([path])
        throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (doc: DocumentRow) => {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id)
      if (error) throw error
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.storage_path])
      if (storageError) throw storageError
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })
}

/** Open a short-lived signed URL that downloads the file. */
export async function downloadDocument(doc: {
  storage_path: string
  filename: string
}) {
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(doc.storage_path, 60, { download: doc.filename })
  if (error) throw error
  window.open(data.signedUrl, '_blank')
}

/** Signed URL for displaying a stored image (inspection photos). */
export function useSignedDocumentUrl(path: string | null) {
  return useQuery({
    queryKey: ['document-url', path],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(path!, 60 * 60)
      if (error) throw error
      return data.signedUrl
    },
  })
}
