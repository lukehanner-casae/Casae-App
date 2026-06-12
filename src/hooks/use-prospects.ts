import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PropertyProspect } from '@/lib/types'

export const PROSPECT_STAGES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'viewing-booked', label: 'Viewing Booked' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'proposal-sent', label: 'Proposal Sent' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'secured', label: 'Secured' },
  { value: 'dead', label: 'Dead' },
] as const

export const PROSPECT_SOURCES = [
  { value: 'kaylin-outreach', label: 'Kaylin Outreach' },
  { value: 'agent', label: 'Agent' },
  { value: 'private', label: 'Private' },
  { value: 'referral', label: 'Referral' },
] as const

export const PRIORITY_SUBURBS = [
  'Innaloo',
  'Woodlands',
  'Doubleview',
  'Scarborough',
  'Stirling',
  'Osborne Park',
] as const

export function useProspects() {
  return useQuery({
    queryKey: ['prospects'],
    queryFn: async (): Promise<PropertyProspect[]> => {
      const { data, error } = await supabase
        .from('property_prospects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as PropertyProspect[]
    },
  })
}

export function useCreateProspect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (prospect: Partial<PropertyProspect>) => {
      const { error } = await supabase.from('property_prospects').insert(prospect)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}

export function useUpdateProspect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: Partial<PropertyProspect> & { id: string }) => {
      const { error } = await supabase
        .from('property_prospects')
        .update(patch)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['prospects'] }),
  })
}
