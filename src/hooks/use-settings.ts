import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AppSetting } from '@/lib/types'

export function useAppSetting(key: string) {
  return useQuery({
    queryKey: ['app-settings', key],
    queryFn: async (): Promise<AppSetting | null> => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', key)
        .maybeSingle()
      if (error) throw error
      return data as AppSetting | null
    },
  })
}

export function useSetAppSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string | null }) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onSuccess: (_data, { key }) =>
      qc.invalidateQueries({ queryKey: ['app-settings', key] }),
  })
}
