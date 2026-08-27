import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { invalidateOccupancy } from '@/hooks/use-vacate-notices'
import type { Lodger, PipelineTenant, Property, Room, VacateNotice } from '@/lib/types'

export type PipelineTenantWithRelations = PipelineTenant & {
  property: Pick<Property, 'id' | 'display_name'> | null
  room: Pick<Room, 'id' | 'room_name'> | null
  lodger: Pick<Lodger, 'id' | 'status'> | null
  vacancy:
    | (Pick<VacateNotice, 'id' | 'vacate_date' | 'status' | 'room_id' | 'property_id'> & {
        property: Pick<Property, 'display_name'> | null
        room: Pick<Room, 'room_name'> | null
      })
    | null
}

const TENANT_SELECT = `*,
  property:properties(id, display_name),
  room:rooms(id, room_name),
  lodger:lodgers(id, status),
  vacancy:vacate_notices!pipeline_tenants_linked_vacancy_id_fkey(id, vacate_date, status, room_id, property_id, property:properties(display_name), room:rooms(room_name))`

export function usePipelineTenants() {
  return useQuery({
    queryKey: ['pipeline_tenants'],
    queryFn: async (): Promise<PipelineTenantWithRelations[]> => {
      const { data, error } = await supabase
        .from('pipeline_tenants')
        .select(TENANT_SELECT)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as PipelineTenantWithRelations[]
    },
  })
}

export function useCreatePipelineTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tenant: Partial<PipelineTenant>) => {
      const { data, error } = await supabase
        .from('pipeline_tenants')
        .insert(tenant)
        .select()
        .single()
      if (error) throw error
      return data as PipelineTenant
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline_tenants'] }),
  })
}

export function useUpdatePipelineTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<PipelineTenant> & { id: string }) => {
      const { error } = await supabase.from('pipeline_tenants').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateOccupancy(qc),
  })
}

export function useDeletePipelineTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pipeline_tenants').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateOccupancy(qc),
  })
}

/**
 * Move-in: converts a lead into a lodger in the given room, keeps the lead
 * history on the pipeline record, and closes out the room's vacate notice
 * when the move-in date has arrived.
 */
export function useConvertPipelineTenant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      tenantId: string
      roomId: string
      moveInDate: string
      bondAmount?: number | null
    }) => {
      const { data, error } = await supabase.rpc('convert_pipeline_tenant', {
        p_tenant_id: input.tenantId,
        p_room_id: input.roomId,
        p_move_in_date: input.moveInDate,
        p_bond_amount: input.bondAmount ?? null,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => invalidateOccupancy(qc),
  })
}
