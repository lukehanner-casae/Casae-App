import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { addDaysIso, todayIso } from '@/lib/format'
import type { Clean, Property, Recurrence } from '@/lib/types'

export type CleanWithProperty = Clean & { property: Property | null }

export function useCleans(propertyId?: string) {
  return useQuery({
    queryKey: ['cleans', { propertyId: propertyId ?? null }],
    queryFn: async (): Promise<CleanWithProperty[]> => {
      let q = supabase
        .from('cleans')
        .select('*, property:properties(*)')
        .order('scheduled_date')
      if (propertyId) q = q.eq('property_id', propertyId)
      const { data, error } = await q
      if (error) throw error
      return data as CleanWithProperty[]
    },
  })
}

export function useCreateClean() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (clean: Partial<Clean>) => {
      const { error } = await supabase.from('cleans').insert(clean)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cleans'] }),
  })
}

export function useUpdateClean() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Clean> & { id: string }) => {
      const { error } = await supabase.from('cleans').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cleans'] }),
  })
}

/**
 * Recurring setup: generates scheduled cleans 8 weeks forward from the start
 * date at the chosen cadence (weekly / fortnightly). Re-running replaces any
 * future unstarted cleans of the same cadence instead of duplicating them.
 */
export function useCreateRecurringCleans() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      propertyId,
      startDate,
      recurrence,
      assignedTo,
    }: {
      propertyId: string
      startDate: string
      recurrence: Exclude<Recurrence, 'none'>
      assignedTo: string | null
    }) => {
      const { error: deleteError } = await supabase
        .from('cleans')
        .delete()
        .eq('property_id', propertyId)
        .eq('recurrence', recurrence)
        .eq('status', 'scheduled')
        .gte('scheduled_date', todayIso())
      if (deleteError) throw deleteError

      const stepDays = recurrence === 'weekly' ? 7 : 14
      const rows: Partial<Clean>[] = []
      for (let day = 0; day <= 56; day += stepDays) {
        rows.push({
          property_id: propertyId,
          scheduled_date: addDaysIso(startDate, day),
          clean_type: 'routine',
          assigned_to: assignedTo,
          status: 'scheduled',
          recurrence,
        })
      }
      const { error } = await supabase.from('cleans').insert(rows)
      if (error) throw error
      return rows.length
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cleans'] }),
  })
}
