import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Property, PropertyWithRooms, Room } from '@/lib/types'

const PROPERTY_SELECT = '*, rooms(*, lodgers(*))'

export function useProperties() {
  return useQuery({
    queryKey: ['properties'],
    queryFn: async (): Promise<PropertyWithRooms[]> => {
      const { data, error } = await supabase
        .from('properties')
        .select(PROPERTY_SELECT)
        .eq('status', 'active')
        .order('display_name')
      if (error) throw error
      return data as PropertyWithRooms[]
    },
  })
}

export function useProperty(id: string | undefined) {
  return useQuery({
    queryKey: ['properties', id],
    enabled: !!id,
    queryFn: async (): Promise<PropertyWithRooms> => {
      const { data, error } = await supabase
        .from('properties')
        .select(PROPERTY_SELECT)
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as PropertyWithRooms
    },
  })
}

export function useUpdateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Room> & { id: string }) => {
      const { error } = await supabase.from('rooms').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['properties'] })
      qc.invalidateQueries({ queryKey: ['lodgers'] })
    },
  })
}

export function useUpdateProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Property> & { id: string }) => {
      const { error } = await supabase.from('properties').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties'] }),
  })
}
