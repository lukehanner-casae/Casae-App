import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Expense, Property } from '@/lib/types'

export type ExpenseWithProperty = Expense & { property: Property | null }

export const EXPENSE_CATEGORIES = [
  'Head Lease',
  'Utilities',
  'Maintenance & Repairs',
  'Cleaning',
  'Furnishings & Fitout',
  'Insurance',
  'Professional Services',
  'Other',
] as const

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async (): Promise<ExpenseWithProperty[]> => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*, property:properties(*)')
        .order('expense_date', { ascending: false })
      if (error) throw error
      return data as ExpenseWithProperty[]
    },
  })
}

/** Uploads a receipt to the private `receipts` bucket and returns its path. */
export async function uploadReceipt(
  propertyId: string,
  file: File,
): Promise<string> {
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const safeName = file.name.replace(/[^A-Za-z0-9_.-]+/g, '_')
  const path = `${propertyId}/${yearMonth}/${now.getTime()}-${safeName}`
  const { error } = await supabase.storage.from('receipts').upload(path, file)
  if (error) throw error
  return path
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      expense,
      receiptFile,
    }: {
      expense: Partial<Expense>
      receiptFile: File | null
    }) => {
      let receipt_url: string | null = null
      if (receiptFile && expense.property_id) {
        receipt_url = await uploadReceipt(expense.property_id, receiptFile)
      }
      const { error } = await supabase
        .from('expenses')
        .insert({ ...expense, receipt_url })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }),
  })
}

export function useReceiptUrl(path: string | null) {
  return useQuery({
    queryKey: ['receipt-url', path],
    enabled: !!path,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from('receipts')
        .createSignedUrl(path!, 60 * 60)
      if (error) throw error
      return data.signedUrl
    },
  })
}
