import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MaintenanceJob, Property, Room } from '@/lib/types'

export type JobWithRefs = MaintenanceJob & {
  property: Property | null
  room: Room | null
}

const JOB_SELECT = '*, property:properties(*), room:rooms(*)'

export function useMaintenanceJobs(propertyId?: string) {
  return useQuery({
    queryKey: ['maintenance', { propertyId: propertyId ?? null }],
    queryFn: async (): Promise<JobWithRefs[]> => {
      let q = supabase
        .from('maintenance_jobs')
        .select(JOB_SELECT)
        .order('created_at', { ascending: false })
      if (propertyId) q = q.eq('property_id', propertyId)
      const { data, error } = await q
      if (error) throw error
      return data as JobWithRefs[]
    },
  })
}

export function useCreateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (job: Partial<MaintenanceJob>) => {
      const { error } = await supabase.from('maintenance_jobs').insert(job)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }),
  })
}

export function useUpdateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: Partial<MaintenanceJob> & { id: string }) => {
      const { error } = await supabase
        .from('maintenance_jobs')
        .update(patch)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }),
  })
}
