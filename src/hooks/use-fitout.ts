import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { uploadReceipt } from '@/hooks/use-expenses'
import type { FitoutItem } from '@/lib/types'

export const FITOUT_CATEGORIES = [
  'furniture',
  'appliances',
  'bedding',
  'smart-lock',
  'misc',
] as const

export function useFitoutItems(propertyId?: string) {
  return useQuery({
    queryKey: ['fitout', { propertyId: propertyId ?? null }],
    queryFn: async (): Promise<FitoutItem[]> => {
      let q = supabase
        .from('fitout_items')
        .select('*')
        .order('purchase_date', { ascending: false })
      if (propertyId) q = q.eq('property_id', propertyId)
      const { data, error } = await q
      if (error) throw error
      return data as FitoutItem[]
    },
  })
}

export function useCreateFitoutItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      item,
      receiptFile,
    }: {
      item: Partial<FitoutItem>
      receiptFile: File | null
    }) => {
      let receipt_url: string | null = null
      if (receiptFile && item.property_id) {
        receipt_url = await uploadReceipt(item.property_id, receiptFile)
      }
      const { error } = await supabase
        .from('fitout_items')
        .insert({ ...item, receipt_url })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fitout'] }),
  })
}
