import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { todayIso } from '@/lib/format'
import type { Lodger, Property, Room } from '@/lib/types'

export type LodgerWithRoom = Lodger & {
  room: (Room & { property: Property | null }) | null
}

const LODGER_SELECT = '*, room:rooms(*, property:properties(*))'

export function useLodgers() {
  return useQuery({
    queryKey: ['lodgers'],
    queryFn: async (): Promise<LodgerWithRoom[]> => {
      const { data, error } = await supabase
        .from('lodgers')
        .select(LODGER_SELECT)
        .order('first_name')
      if (error) throw error
      return data as LodgerWithRoom[]
    },
  })
}

export function useLodger(id: string | undefined) {
  return useQuery({
    queryKey: ['lodgers', id],
    enabled: !!id,
    queryFn: async (): Promise<LodgerWithRoom> => {
      const { data, error } = await supabase
        .from('lodgers')
        .select(LODGER_SELECT)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as LodgerWithRoom
    },
  })
}

function invalidateLodgerData(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['lodgers'] })
  qc.invalidateQueries({ queryKey: ['properties'] })
}

export function useCreateLodger() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (lodger: Partial<Lodger>) => {
      const { data, error } = await supabase
        .from('lodgers')
        .insert(lodger)
        .select()
        .single()
      if (error) throw error
      // A current lodger occupies their room.
      if (lodger.room_id && lodger.status !== 'former') {
        await supabase
          .from('rooms')
          .update({ status: 'occupied', vacated_at: null })
          .eq('id', lodger.room_id)
      }
      return data as Lodger
    },
    onSuccess: () => invalidateLodgerData(qc),
  })
}

export function useUpdateLodger() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Lodger> & { id: string }) => {
      const { error } = await supabase.from('lodgers').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateLodgerData(qc),
  })
}

/**
 * Move-out flow: lodger becomes former, room becomes vacant, an end-of-tenancy
 * clean is scheduled for the move-out date, and the bond stays on the books
 * until bond_returned_date is recorded (bond return tracking).
 */
export function useRecordMoveOut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      lodger,
      moveOutDate,
    }: {
      lodger: LodgerWithRoom
      moveOutDate: string
    }) => {
      const { error } = await supabase
        .from('lodgers')
        .update({ status: 'former', expected_move_out: moveOutDate })
        .eq('id', lodger.id)
      if (error) throw error

      if (lodger.room_id) {
        const { error: roomError } = await supabase
          .from('rooms')
          .update({
            status: 'vacant',
            vacated_at: new Date(moveOutDate).toISOString(),
          })
          .eq('id', lodger.room_id)
        if (roomError) throw roomError
      }

      if (lodger.room?.property_id) {
        const { error: cleanError } = await supabase.from('cleans').insert({
          property_id: lodger.room.property_id,
          scheduled_date: moveOutDate >= todayIso() ? moveOutDate : todayIso(),
          clean_type: 'end-of-tenancy',
          status: 'scheduled',
          notes: `Auto-created on move-out of ${lodger.first_name ?? ''} ${lodger.last_name ?? ''} (${lodger.room?.room_name ?? 'room'})`.trim(),
        })
        if (cleanError) throw cleanError
      }
    },
    onSuccess: () => {
      invalidateLodgerData(qc)
      qc.invalidateQueries({ queryKey: ['cleans'] })
    },
  })
}
