import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  Lodger,
  PipelineTenant,
  Property,
  Room,
  VacateNotice,
} from '@/lib/types'

export type VacateNoticeWithRelations = VacateNotice & {
  property: Pick<Property, 'id' | 'display_name'> | null
  room: Pick<Room, 'id' | 'room_name' | 'weekly_rent' | 'status'> | null
  lodger: Pick<
    Lodger,
    'id' | 'first_name' | 'last_name' | 'partner_name' | 'is_couple' | 'phone' | 'email'
  > | null
  replacement: Pick<PipelineTenant, 'id' | 'name' | 'email' | 'phone' | 'status'> | null
}

// pipeline_tenants and vacate_notices reference each other, so the embed
// must name the FK it follows.
const NOTICE_SELECT = `*,
  property:properties(id, display_name),
  room:rooms(id, room_name, weekly_rent, status),
  lodger:lodgers(id, first_name, last_name, partner_name, is_couple, phone, email),
  replacement:pipeline_tenants!vacate_notices_replacement_pipeline_tenant_id_fkey(id, name, email, phone, status)`

/** Every query that reads occupancy state, invalidated together. */
export function invalidateOccupancy(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['vacate_notices'] })
  qc.invalidateQueries({ queryKey: ['pipeline_tenants'] })
  qc.invalidateQueries({ queryKey: ['lodgers'] })
  qc.invalidateQueries({ queryKey: ['properties'] })
}

/**
 * All vacate notices (active first, soonest first). Before reading, runs the
 * auto-vacancy job so rooms whose vacate date has passed are already flipped
 * — pg_cron does this nightly, this call covers the gap.
 */
export function useVacateNotices() {
  return useQuery({
    queryKey: ['vacate_notices'],
    queryFn: async (): Promise<VacateNoticeWithRelations[]> => {
      const { error: applyError } = await supabase.rpc('apply_passed_vacate_notices')
      if (applyError) console.warn('auto-vacancy check failed', applyError.message)

      const { data, error } = await supabase
        .from('vacate_notices')
        .select(NOTICE_SELECT)
        .order('status')
        .order('vacate_date')
      if (error) throw error
      return data as unknown as VacateNoticeWithRelations[]
    },
  })
}

export function useLogVacateNotice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      property_id: string
      room_id: string
      lodger_id: string
      vacate_date: string
      notes?: string | null
    }) => {
      const { data, error } = await supabase.rpc('log_vacate_notice', {
        p_property_id: input.property_id,
        p_room_id: input.room_id,
        p_lodger_id: input.lodger_id,
        p_vacate_date: input.vacate_date,
        p_notes: input.notes ?? null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => invalidateOccupancy(qc),
  })
}

export function useUpdateVacateNotice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: Partial<Pick<VacateNotice, 'vacate_date' | 'replacement_status' | 'notes'>> & {
      id: string
    }) => {
      const { error } = await supabase.from('vacate_notices').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateOccupancy(qc),
  })
}

export function useCancelVacateNotice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancel_vacate_notice', { p_notice_id: id })
      if (error) throw error
    },
    onSuccess: () => invalidateOccupancy(qc),
  })
}

/** The lodger has already left: close the notice out now rather than on the date. */
export function useCompleteVacateNotice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('complete_vacate_notice', {
        p_notice_id: id,
        p_source: 'manual',
      })
      if (error) throw error
    },
    onSuccess: () => invalidateOccupancy(qc),
  })
}

export function useMatchLeadToVacancy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ tenantId, noticeId }: { tenantId: string; noticeId: string }) => {
      const { error } = await supabase.rpc('match_lead_to_vacancy', {
        p_tenant_id: tenantId,
        p_notice_id: noticeId,
      })
      if (error) throw error
    },
    onSuccess: () => invalidateOccupancy(qc),
  })
}

export function useUnmatchLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (noticeId: string) => {
      const { error } = await supabase.rpc('unmatch_lead', { p_notice_id: noticeId })
      if (error) throw error
    },
    onSuccess: () => invalidateOccupancy(qc),
  })
}
