// Xero integration shared types + helpers (tracking map, P&L report parsing,
// date ranges). Network access lives in src/hooks/use-xero.ts.

/** sessionStorage key holding the OAuth state nonce between redirect legs. */
export const XERO_STATE_STORAGE_KEY = 'xero-oauth-state'

// ---------------------------------------------------------------------------
// Tracking category → property mapping (app_settings key `xero_tracking_map`)
// ---------------------------------------------------------------------------

export interface XeroTrackingOptionMap {
  trackingOptionId: string
  /** Xero option name, kept for display when the property is unmapped. */
  name: string
  propertyId: string | null
}

export interface XeroTrackingMap {
  trackingCategoryId: string
  categoryName: string
  options: XeroTrackingOptionMap[]
}

export function parseTrackingMap(
  raw: string | null | undefined,
): XeroTrackingMap | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as XeroTrackingMap
    if (!parsed?.trackingCategoryId || !Array.isArray(parsed.options)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Date ranges
// ---------------------------------------------------------------------------

export type XeroRangeKey =
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-6-months'
  | 'custom'

export const XERO_RANGE_LABELS: Record<XeroRangeKey, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  'last-3-months': 'Last 3 months',
  'last-6-months': 'Last 6 months',
  custom: 'Custom',
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** from/to (inclusive, YYYY-MM-DD) for a preset range. */
export function xeroRangeDates(key: Exclude<XeroRangeKey, 'custom'>): {
  from: string
  to: string
} {
  const now = new Date()
  if (key === 'last-month') {
    return {
      from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: iso(new Date(now.getFullYear(), now.getMonth(), 0)),
    }
  }
  const monthsBack = { 'this-month': 0, 'last-3-months': 2, 'last-6-months': 5 }[
    key
  ]
  return {
    from: iso(new Date(now.getFullYear(), now.getMonth() - monthsBack, 1)),
    to: iso(now),
  }
}

// ---------------------------------------------------------------------------
// Reports/ProfitAndLoss parsing
// ---------------------------------------------------------------------------

interface XeroReportCell {
  Value?: string
}

interface XeroReportRow {
  RowType: 'Header' | 'Section' | 'Row' | 'SummaryRow'
  Title?: string
  Cells?: XeroReportCell[]
  Rows?: XeroReportRow[]
}

export interface XeroReportResponse {
  Reports?: { Rows?: XeroReportRow[] }[]
}

export interface PnLAccountLine {
  name: string
  amount: number
}

export interface PnLSummary {
  income: number
  expenses: number
  net: number
  topIncome: PnLAccountLine[]
  topExpenses: PnLAccountLine[]
}

function rowAmount(row: XeroReportRow): number {
  const raw = row.Cells?.[row.Cells.length - 1]?.Value
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function topLines(lines: PnLAccountLine[], count = 5): PnLAccountLine[] {
  return [...lines]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, count)
}

/**
 * Reduce a Xero ProfitAndLoss report to income / expenses / net plus the top
 * account lines per side. Sections are classified by title; an explicit
 * "Net Profit" summary row wins over the computed income − expenses.
 */
export function parsePnLReport(response: XeroReportResponse): PnLSummary {
  const rows = response.Reports?.[0]?.Rows ?? []
  let income = 0
  let expenses = 0
  let explicitNet: number | null = null
  const incomeLines: PnLAccountLine[] = []
  const expenseLines: PnLAccountLine[] = []

  for (const section of rows) {
    if (section.RowType !== 'Section') continue
    const title = section.Title ?? ''
    const children = section.Rows ?? []

    if (!title) {
      // Untitled trailing section holds Net Profit / Net Loss.
      for (const row of children) {
        if (/net (profit|loss|income)/i.test(row.Cells?.[0]?.Value ?? '')) {
          explicitNet = rowAmount(row)
        }
      }
      continue
    }

    const isIncome = /income|revenue|sales/i.test(title)
    const isExpense = /expense|cost of sales/i.test(title)
    if (!isIncome && !isExpense) continue

    const accountRows = children.filter((r) => r.RowType === 'Row')
    const summary = children.find((r) => r.RowType === 'SummaryRow')
    const total = summary
      ? rowAmount(summary)
      : accountRows.reduce((s, r) => s + rowAmount(r), 0)
    const lines = accountRows.map((r) => ({
      name: r.Cells?.[0]?.Value ?? '—',
      amount: rowAmount(r),
    }))

    if (isIncome) {
      income += total
      incomeLines.push(...lines)
    } else {
      expenses += total
      expenseLines.push(...lines)
    }
  }

  let net = explicitNet ?? income - expenses

  // Sign-convention guards — Xero layouts vary. Income can arrive in raw
  // credit (negative) sign even when the period is profitable: flip it (and
  // its account lines) back when its magnitude clearly exceeds expenses but
  // net came out negative. And if the explicit net row disagrees in sign
  // with parsed income − expenses, trust the parsed sections.
  if (income < 0 && net < 0 && -income > expenses) {
    income = -income
    for (const line of incomeLines) line.amount = -line.amount
  }
  if (net < 0 && income > expenses) net = income - expenses

  return {
    income,
    expenses,
    net,
    topIncome: topLines(incomeLines),
    topExpenses: topLines(expenseLines),
  }
}

/**
 * Combine several option-level P&L summaries into one (used when multiple
 * tracking options map to the same property). Account lines with the same
 * name are merged by summing before re-ranking the top 5.
 */
export function combinePnLSummaries(summaries: PnLSummary[]): PnLSummary {
  const mergeLines = (lists: PnLAccountLine[][]): PnLAccountLine[] => {
    const byName = new Map<string, number>()
    for (const lines of lists) {
      for (const l of lines) byName.set(l.name, (byName.get(l.name) ?? 0) + l.amount)
    }
    return topLines(
      [...byName.entries()].map(([name, amount]) => ({ name, amount })),
    )
  }
  return {
    income: summaries.reduce((s, x) => s + x.income, 0),
    expenses: summaries.reduce((s, x) => s + x.expenses, 0),
    net: summaries.reduce((s, x) => s + x.net, 0),
    topIncome: mergeLines(summaries.map((s) => s.topIncome)),
    topExpenses: mergeLines(summaries.map((s) => s.topExpenses)),
  }
}

// ---------------------------------------------------------------------------
// TrackingCategories response
// ---------------------------------------------------------------------------

export interface XeroTrackingOption {
  TrackingOptionID: string
  Name: string
  Status: string
}

export interface XeroTrackingCategory {
  TrackingCategoryID: string
  Name: string
  Status: string
  Options: XeroTrackingOption[]
}

export interface XeroTrackingCategoriesResponse {
  TrackingCategories?: XeroTrackingCategory[]
}
