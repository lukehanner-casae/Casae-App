import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('display_name')
      if (error) throw error
      return data as Profile[]
    },
  })
}

/** Display name for a user id, falling back to email then a generic label. */
export function profileName(
  profiles: Profile[] | undefined,
  userId: string | null | undefined,
): string | null {
  if (!userId) return null
  const p = profiles?.find((p) => p.id === userId)
  return p?.display_name || p?.email || 'Unknown user'
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: Partial<Profile> & { id: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  })
}
