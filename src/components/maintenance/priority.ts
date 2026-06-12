import type { JobPriority, JobStatus } from '@/lib/types'

// Priority badge colours per spec: urgent red, high amber, medium blue, low grey.
export const priorityClass: Record<JobPriority, string> = {
  urgent: 'bg-red-500 text-white',
  high: 'bg-amber-500 text-white',
  medium: 'bg-blue-500 text-white',
  low: 'bg-gray-400 text-white',
}

export const priorityRank: Record<JobPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export const statusLabel: Record<JobStatus, string> = {
  open: 'Open',
  'in-progress': 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const statusClass: Record<JobStatus, string> = {
  open: 'border-stone bg-muted text-navy',
  'in-progress': 'border-blue-500/40 bg-blue-50 text-blue-700',
  completed: 'border-sage/40 bg-sage/10 text-sage',
  cancelled: 'border-stone bg-muted text-muted-foreground',
}
