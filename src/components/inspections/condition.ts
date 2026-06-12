import type { InspectionCondition } from '@/lib/types'

export const conditionClass: Record<InspectionCondition, string> = {
  good: 'border-sage/40 bg-sage/10 text-sage',
  fair: 'border-amber-500/40 bg-amber-50 text-amber-700',
  poor: 'border-vacant/40 bg-red-50 text-vacant',
}
