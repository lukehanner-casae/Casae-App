// Shared formatting + date helpers (AUD, en-AU dates).

const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
})

const audCents = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatAud(value: number | null | undefined): string {
  if (value == null) return '—'
  return aud.format(value)
}

export function formatAudCents(value: number | null | undefined): string {
  if (value == null) return '—'
  return audCents.format(value)
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Whole days from today until the given date (negative = past). */
export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null
  const target = new Date(value)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/** Whole days from the given date until today (positive = in the past). */
export function daysSince(value: string | null | undefined): number | null {
  const d = daysUntil(value)
  return d == null ? null : -d
}

/** Today as a YYYY-MM-DD string (local time). */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Full display name for a lodger, including couple partner when present. */
export function lodgerName(l: {
  first_name: string | null
  last_name: string | null
  partner_name?: string | null
  is_couple?: boolean
}): string {
  const name = [l.first_name, l.last_name].filter(Boolean).join(' ') || '—'
  if (l.is_couple && l.partner_name) return `${name} & ${l.partner_name}`
  return name
}

/**
 * Append a timestamped entry to an append-only notes column.
 * Format: [12 Jun 2026, 2:30 pm — user] text
 */
export function appendNote(
  existing: string | null | undefined,
  text: string,
  user: string | null | undefined,
): string {
  const stamp = new Date().toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const entry = `[${stamp} — ${user ?? 'unknown'}] ${text.trim()}`
  return existing && existing.trim() ? `${existing.trimEnd()}\n${entry}` : entry
}

/** Parse an append-only notes column into entries (newest last). */
export function parseNotes(notes: string | null | undefined): string[] {
  if (!notes) return []
  return notes.split('\n').filter((l) => l.trim())
}
