// Vacate-pipeline + tenant-pipeline derived metrics (Redesign Spec v2 §2.4, §3).

import { daysUntil } from '@/lib/format'
import type {
  PipelineTenant,
  PipelineTenantStatus,
  ReplacementStatus,
  VacateNotice,
} from '@/lib/types'

export const PIPELINE_STAGES: { value: PipelineTenantStatus; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'viewing_booked', label: 'Viewing Booked' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'active', label: 'Active Lodger' },
  { value: 'notice_given', label: 'Notice Given' },
  { value: 'vacated', label: 'Vacated' },
]

/** Stages a lead can be moved between by hand; the rest are set by actions. */
export const OPEN_LEAD_STAGES: readonly PipelineTenantStatus[] = [
  'lead',
  'viewing_booked',
  'viewed',
]

export function isOpenLead(t: Pick<PipelineTenant, 'status'>): boolean {
  return OPEN_LEAD_STAGES.includes(t.status)
}

export const PIPELINE_SOURCES = [
  { value: 'flatmates', label: 'Flatmates' },
  { value: 'referral', label: 'Referral' },
  { value: 'walk-in', label: 'Walk-in' },
  { value: 'other', label: 'Other' },
] as const

export const REPLACEMENT_STATUSES: { value: ReplacementStatus; label: string }[] = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'lead_assigned', label: 'Lead Assigned' },
  { value: 'confirmed', label: 'Confirmed' },
]

export function stageLabel(status: PipelineTenantStatus): string {
  return PIPELINE_STAGES.find((s) => s.value === status)?.label ?? status
}

export function replacementLabel(status: ReplacementStatus): string {
  return REPLACEMENT_STATUSES.find((s) => s.value === status)?.label ?? status
}

/**
 * Lead stage inferred from the viewing date: a future viewing is booked, a
 * past one has happened, none yet is a bare lead.
 */
export function stageFromViewingDate(
  viewingDate: string | null | undefined,
): PipelineTenantStatus {
  const days = daysUntil(viewingDate)
  if (days == null) return 'lead'
  return days > 0 ? 'viewing_booked' : 'viewed'
}

// ---------------------------------------------------------------------------
// Days-until-vacant buckets (red < 14, amber < 30, green beyond)
// ---------------------------------------------------------------------------

export type DaysBucket = 'overdue' | 'under14' | 'under30' | 'under60' | 'beyond'

export const DAYS_BUCKETS: { value: DaysBucket; label: string }[] = [
  { value: 'under14', label: 'Under 14 days' },
  { value: 'under30', label: 'Under 30 days' },
  { value: 'under60', label: 'Under 60 days' },
  { value: 'beyond', label: '60 days +' },
]

export function daysBucket(days: number): DaysBucket {
  if (days < 0) return 'overdue'
  if (days < 14) return 'under14'
  if (days < 30) return 'under30'
  if (days < 60) return 'under60'
  return 'beyond'
}

/** Bucket filter semantics: "under 30" includes everything sooner than 30. */
export function inDaysBucket(days: number, bucket: DaysBucket): boolean {
  switch (bucket) {
    case 'overdue':
      return days < 0
    case 'under14':
      return days < 14
    case 'under30':
      return days < 30
    case 'under60':
      return days < 60
    case 'beyond':
      return days >= 60
  }
}

export function daysUntilClass(days: number): string {
  if (days < 14) return 'text-vacant'
  if (days < 30) return 'text-warning'
  return 'text-sage'
}

export function daysUntilBadgeClass(days: number): string {
  if (days < 14) return 'border-vacant/40 bg-red-50 text-vacant'
  if (days < 30) return 'border-warning/50 bg-amber-50 text-amber-700'
  return 'border-sage/40 bg-sage/10 text-sage'
}

// ---------------------------------------------------------------------------
// Dashboard metrics
// ---------------------------------------------------------------------------

export interface UpcomingVacancies {
  in14: number
  in30: number
  in60: number
}

/** Active notices vacating within 14 / 30 / 60 days (cumulative). */
export function upcomingVacancies(notices: VacateNotice[]): UpcomingVacancies {
  const out = { in14: 0, in30: 0, in60: 0 }
  for (const n of notices) {
    if (n.status !== 'active') continue
    const days = daysUntil(n.vacate_date)
    if (days == null) continue
    if (days <= 14) out.in14++
    if (days <= 30) out.in30++
    if (days <= 60) out.in60++
  }
  return out
}

export interface PipelineHealth {
  lead: number
  viewingBooked: number
  viewed: number
  /** Open leads not yet matched to a vacancy. */
  unmatched: number
  openTotal: number
}

export function pipelineHealth(tenants: PipelineTenant[]): PipelineHealth {
  const open = tenants.filter(isOpenLead)
  return {
    lead: open.filter((t) => t.status === 'lead').length,
    viewingBooked: open.filter((t) => t.status === 'viewing_booked').length,
    viewed: open.filter((t) => t.status === 'viewed').length,
    unmatched: open.filter((t) => !t.linked_vacancy_id).length,
    openTotal: open.length,
  }
}

export interface ConversionRate {
  /** Leads created in the window. */
  leads: number
  /** Of those, converted to an active lodger (at any point). */
  converted: number
  /** 0–100, or null when there were no leads in the window. */
  pct: number | null
  windowDays: number
}

/** Share of leads created in the last `windowDays` that became lodgers. */
export function conversionRate(
  tenants: PipelineTenant[],
  windowDays = 90,
): ConversionRate {
  const cutoff = Date.now() - windowDays * 86_400_000
  const leads = tenants.filter((t) => Date.parse(t.created_at) >= cutoff)
  const converted = leads.filter((t) => t.converted_at != null)
  return {
    leads: leads.length,
    converted: converted.length,
    pct: leads.length > 0 ? Math.round((converted.length / leads.length) * 100) : null,
    windowDays,
  }
}
