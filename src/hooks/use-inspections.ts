import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Inspection, Property } from '@/lib/types'

export type InspectionWithProperty = Inspection & { property: Property | null }

export const INSPECTION_CONDITIONS = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
] as const

export function useInspections(propertyId?: string) {
  return useQuery({
    queryKey: ['inspections', { propertyId: propertyId ?? null }],
    queryFn: async (): Promise<InspectionWithProperty[]> => {
      let q = supabase
        .from('inspections')
        .select('*, property:properties(*)')
        .order('scheduled_date', { ascending: false })
      if (propertyId) q = q.eq('property_id', propertyId)
      const { data, error } = await q
      if (error) throw error
      return data as InspectionWithProperty[]
    },
  })
}

export function useInspection(id: string | undefined) {
  return useQuery({
    queryKey: ['inspections', 'detail', id],
    enabled: !!id,
    queryFn: async (): Promise<InspectionWithProperty | null> => {
      const { data, error } = await supabase
        .from('inspections')
        .select('*, property:properties(*)')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as InspectionWithProperty | null
    },
  })
}

/** Uploads inspection photos and returns their storage paths. */
async function uploadInspectionPhotos(
  inspectionId: string,
  files: File[],
): Promise<string[]> {
  const paths: string[] = []
  for (const file of files) {
    const safeName = file.name.replace(/[^A-Za-z0-9_.-]+/g, '_')
    const path = `inspections/${inspectionId}/${Date.now()}-${safeName}`
    const { error } = await supabase.storage
      .from('documents')
      .upload(path, file)
    if (error) throw error
    paths.push(path)
  }
  return paths
}

export function useCreateInspection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      inspection,
      photos,
    }: {
      inspection: Partial<Inspection>
      photos: File[]
    }) => {
      const { data, error } = await supabase
        .from('inspections')
        .insert(inspection)
        .select('id')
        .single()
      if (error) throw error
      if (photos.length > 0) {
        const paths = await uploadInspectionPhotos(data.id, photos)
        const { error: updateError } = await supabase
          .from('inspections')
          .update({ photo_paths: paths })
          .eq('id', data.id)
        if (updateError) throw updateError
      }
      return data.id as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections'] }),
  })
}

export function useUpdateInspection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      photos,
      ...patch
    }: Partial<Inspection> & { id: string; photos?: File[] }) => {
      let photo_paths: string[] | undefined
      if (photos && photos.length > 0) {
        const { data: current, error: fetchError } = await supabase
          .from('inspections')
          .select('photo_paths')
          .eq('id', id)
          .single()
        if (fetchError) throw fetchError
        const added = await uploadInspectionPhotos(id, photos)
        photo_paths = [...(current.photo_paths ?? []), ...added]
      }
      const { error } = await supabase
        .from('inspections')
        .update(photo_paths ? { ...patch, photo_paths } : patch)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections'] }),
  })
}

export function useDeleteInspection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inspection: Inspection) => {
      const { error } = await supabase
        .from('inspections')
        .delete()
        .eq('id', inspection.id)
      if (error) throw error
      if (inspection.photo_paths.length > 0) {
        await supabase.storage
          .from('documents')
          .remove(inspection.photo_paths)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inspections'] }),
  })
}
