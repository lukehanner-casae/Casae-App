// AI insights — portfolio briefing + chat, powered by Claude Sonnet.
//
// POST { mode: 'summary' | 'chat', messages: [{ role, content }] }
// Auth: the caller's Supabase JWT (same pattern as the Xero functions), so
// only logged-in team members can spend API credits. The response streams
// plain UTF-8 text deltas — no SSE framing — and the client appends chunks
// as they arrive.
//
// Context is fetched fresh from Supabase on every request (properties +
// rooms + lodgers, vacate pipeline, tenant pipeline, open maintenance). A
// per-property Xero P&L
// snapshot (this month vs last month) is fetched best-effort via the stored
// Xero connection and cached in-instance for 10 minutes; when Xero is not
// connected or slow, the model falls back to lodger rate data.

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  env,
  errorResponse,
  getValidAccessToken,
  HttpError,
  readSettings,
  requireUser,
} from './_lib/xero'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 8192
const MAX_HISTORY_MESSAGES = 24
const MAX_MESSAGE_CHARS = 4_000
const XERO_CACHE_TTL_MS = 10 * 60 * 1000
const XERO_BUDGET_MS = 12_000

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface InsightsRequest {
  mode: 'summary' | 'chat'
  messages?: ChatMessage[]
}

function parseRequest(body: unknown): InsightsRequest {
  const b = body as Partial<InsightsRequest> | null
  if (!b || (b.mode !== 'summary' && b.mode !== 'chat')) {
    throw new HttpError(400, "mode must be 'summary' or 'chat'")
  }
  const raw = Array.isArray(b.messages) ? b.messages : []
  const messages = raw
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ ...m, content: m.content.slice(0, MAX_MESSAGE_CHARS) }))
  if (b.mode === 'chat' && (messages.length === 0 || messages[messages.length - 1].role !== 'user')) {
    throw new HttpError(400, 'chat mode needs a trailing user message')
  }
  return { mode: b.mode, messages }
}

// ---------------------------------------------------------------------------
// Supabase context
// ---------------------------------------------------------------------------

interface LodgerRow {
  first_name: string | null
  last_name: string | null
  partner_name: string | null
  is_couple: boolean
  status: string
  move_in_date: string | null
  expected_move_out: string | null
}

interface RoomRow {
  id: string
  room_name: string
  weekly_rent: number | null
  status: string
  vacant_since: string | null
  next_vacate_date: string | null
  lodgers: LodgerRow[]
}

interface PropertyRow {
  id: string
  display_name: string
  suburb: string | null
  address: string | null
  status: string
  weekly_head_lease: number | null
  head_lease_end: string | null
  rooms: RoomRow[]
}

interface JobRow {
  title: string
  description: string | null
  priority: string
  status: string
  created_at: string
  estimated_cost: number | null
  property_id: string
}

interface NoticeRow {
  property_id: string
  room_id: string
  vacate_date: string
  replacement_status: string
  lodger: LodgerRow | null
  replacement: { name: string; status: string } | null
}

interface TenantRow {
  name: string
  status: string
  source: string | null
  viewing_date: string | null
  property_interest: string | null
  linked_vacancy_id: string | null
  created_at: string
  converted_at: string | null
}

function lodgerName(l: LodgerRow): string {
  const name = [l.first_name, l.last_name].filter(Boolean).join(' ') || 'TBC'
  return l.is_couple && l.partner_name ? `${name} & ${l.partner_name}` : name
}

async function fetchPortfolioContext(supabase: SupabaseClient) {
  const [propertiesRes, jobsRes, noticesRes, tenantsRes] = await Promise.all([
    supabase
      .from('properties')
      .select(
        'id, display_name, suburb, address, status, weekly_head_lease, head_lease_end, rooms(id, room_name, weekly_rent, status, vacant_since, next_vacate_date, lodgers(first_name, last_name, partner_name, is_couple, status, move_in_date, expected_move_out))',
      )
      .eq('status', 'active')
      .order('display_name'),
    supabase
      .from('maintenance_jobs')
      .select(
        'title, description, priority, status, created_at, estimated_cost, property_id',
      )
      .in('status', ['open', 'in-progress']),
    supabase
      .from('vacate_notices')
      .select(
        'property_id, room_id, vacate_date, replacement_status, lodger:lodgers(first_name, last_name, partner_name, is_couple, status, move_in_date, expected_move_out), replacement:pipeline_tenants!vacate_notices_replacement_pipeline_tenant_id_fkey(name, status)',
      )
      .eq('status', 'active')
      .order('vacate_date'),
    supabase
      .from('pipeline_tenants')
      .select(
        'name, status, source, viewing_date, property_interest, linked_vacancy_id, created_at, converted_at',
      )
      .order('created_at', { ascending: false }),
  ])
  for (const res of [propertiesRes, jobsRes, noticesRes, tenantsRes]) {
    if (res.error) throw new HttpError(500, `Context query failed: ${res.error.message}`)
  }

  const properties = (propertiesRes.data ?? []) as unknown as PropertyRow[]
  const jobs = (jobsRes.data ?? []) as JobRow[]
  const notices = (noticesRes.data ?? []) as unknown as NoticeRow[]
  const tenants = (tenantsRes.data ?? []) as TenantRow[]
  const propertyName = new Map(properties.map((p) => [p.id, p.display_name]))
  const roomName = new Map(
    properties.flatMap((p) => p.rooms.map((r) => [r.id, r.room_name] as const)),
  )
  const today = Date.now()

  const propertyContext = properties.map((p) => {
    const rooms = p.rooms ?? []
    // notice_given rooms are still occupied (and paying) until the vacate date.
    const occupied = rooms.filter((r) => r.status === 'occupied' || r.status === 'notice_given')
    const occupiedIncome = occupied.reduce((s, r) => s + (r.weekly_rent ?? 0), 0)
    const fullIncome = rooms.reduce((s, r) => s + (r.weekly_rent ?? 0), 0)
    const headLease = p.weekly_head_lease ?? 0
    return {
      name: p.display_name,
      suburb: p.suburb,
      address: p.address,
      weeklyHeadLease: headLease,
      headLeaseEnd: p.head_lease_end,
      roomCount: rooms.length,
      occupiedRooms: occupied.length,
      currentWeeklyIncome: occupiedIncome,
      fullWeeklyIncome: fullIncome,
      currentWeeklyMargin: occupiedIncome - headLease,
      fullWeeklyMargin: fullIncome - headLease,
      rooms: rooms.map((r) => {
        const lodger =
          r.lodgers.find((l) => l.status === 'current' || l.status === 'notice_given') ??
          r.lodgers.find((l) => l.status === 'pending')
        return {
          room: r.room_name,
          weeklyRent: r.weekly_rent,
          status: r.status,
          vacantSince: r.status === 'vacant' ? r.vacant_since : undefined,
          nextVacateDate: r.next_vacate_date ?? undefined,
          lodger: lodger
            ? {
                name: lodgerName(lodger),
                status: lodger.status,
                moveIn: lodger.move_in_date,
                expectedMoveOut: lodger.expected_move_out,
              }
            : null,
        }
      }),
    }
  })

  const vacantRooms = propertyContext.flatMap((p) =>
    p.rooms
      .filter((r) => r.status !== 'occupied' && !r.lodger)
      .map((r) => ({
        property: p.name,
        room: r.room,
        weeklyRent: r.weeklyRent,
        status: r.status,
        vacantSince: r.vacantSince ?? null,
      })),
  )

  const openMaintenance = jobs
    .map((j) => ({
      property: propertyName.get(j.property_id) ?? 'Unknown property',
      title: j.title,
      description: j.description,
      priority: j.priority,
      status: j.status,
      daysOpen: Math.floor((today - Date.parse(j.created_at)) / 86_400_000),
      estimatedCost: j.estimated_cost,
    }))
    .sort((a, b) => b.daysOpen - a.daysOpen)

  const vacatePipeline = notices.map((n) => ({
    property: propertyName.get(n.property_id) ?? 'Unknown property',
    room: roomName.get(n.room_id) ?? 'Unknown room',
    outgoingLodger: n.lodger ? lodgerName(n.lodger) : null,
    vacateDate: n.vacate_date,
    daysUntilVacant: Math.ceil((Date.parse(n.vacate_date) - today) / 86_400_000),
    replacementStatus: n.replacement_status,
    replacementLead: n.replacement?.name ?? null,
  }))

  const openStages = new Set(['lead', 'viewing_booked', 'viewed'])
  const ninetyDaysAgo = today - 90 * 86_400_000
  const recentLeads = tenants.filter((t) => Date.parse(t.created_at) >= ninetyDaysAgo)
  const tenantPipeline = {
    openLeads: tenants
      .filter((t) => openStages.has(t.status))
      .map((t) => ({
        name: t.name,
        stage: t.status,
        source: t.source,
        viewingDate: t.viewing_date,
        propertyInterest: t.property_interest
          ? (propertyName.get(t.property_interest) ?? null)
          : null,
        matchedToVacancy: !!t.linked_vacancy_id,
      })),
    conversionLast90Days: {
      leads: recentLeads.length,
      convertedToLodger: recentLeads.filter((t) => t.converted_at).length,
    },
  }

  return {
    context: {
      properties: propertyContext,
      vacantRooms,
      vacatePipeline,
      tenantPipeline,
      openMaintenance,
    },
    propertyName,
  }
}

// ---------------------------------------------------------------------------
// Xero P&L snapshot (best effort, cached in-instance)
//
// One Reports/ProfitAndLoss call per month with trackingCategoryID only —
// Xero returns a column per tracking option plus a Total column, so two
// calls cover every property for this month and last month.
// ---------------------------------------------------------------------------

interface XeroCell {
  Value?: string
}
interface XeroRow {
  RowType: string
  Title?: string
  Cells?: XeroCell[]
  Rows?: XeroRow[]
}
interface XeroReport {
  Reports?: { Rows?: XeroRow[] }[]
}

interface ColumnPnL {
  income: number
  expenses: number
  net: number
}

/** Reduce a multi-column (per tracking option) P&L to totals per column. */
function parseColumnarPnL(report: XeroReport): Record<string, ColumnPnL> {
  const rows = report.Reports?.[0]?.Rows ?? []
  const header = rows.find((r) => r.RowType === 'Header')
  const titles = (header?.Cells ?? []).map((c) => c.Value ?? '')
  if (titles.length < 2) return {}

  const income = new Array<number>(titles.length).fill(0)
  const expenses = new Array<number>(titles.length).fill(0)
  const cellNum = (row: XeroRow, i: number): number => {
    const n = Number(row.Cells?.[i]?.Value)
    return Number.isFinite(n) ? n : 0
  }

  for (const section of rows) {
    if (section.RowType !== 'Section') continue
    const title = section.Title ?? ''
    // Expense first: "Cost of Sales" matches the income pattern via "sales".
    const isExpense = /expense|cost of (sales|goods)/i.test(title)
    const isIncome = !isExpense && /income|revenue|sales/i.test(title)
    if (!isIncome && !isExpense) continue
    const children = section.Rows ?? []
    const summary = children.find((r) => r.RowType === 'SummaryRow')
    const sourceRows = summary ? [summary] : children.filter((r) => r.RowType === 'Row')
    for (let i = 1; i < titles.length; i++) {
      const total = sourceRows.reduce((s, r) => s + cellNum(r, i), 0)
      if (isIncome) income[i] += total
      else expenses[i] += total
    }
  }

  const result: Record<string, ColumnPnL> = {}
  for (let i = 1; i < titles.length; i++) {
    let inc = income[i]
    const exp = expenses[i]
    // Same sign guard as the frontend parser — income can arrive credit-signed.
    if (inc < 0 && -inc > exp) inc = -inc
    result[titles[i] || `Column ${i}`] = {
      income: Math.round(inc),
      expenses: Math.round(exp),
      net: Math.round(inc - exp),
    }
  }
  return result
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface XeroSnapshot {
  note: string
  trackingOptionToProperty: Record<string, string>
  thisMonth: { from: string; to: string; byTrackingOption: Record<string, ColumnPnL> }
  lastMonth: { from: string; to: string; byTrackingOption: Record<string, ColumnPnL> }
}

let xeroCache: { at: number; snapshot: XeroSnapshot } | null = null

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Xero fetch timed out')), ms),
    ),
  ])
}

async function fetchXeroSnapshot(
  supabase: SupabaseClient,
  propertyNames: Map<string, string>,
): Promise<XeroSnapshot | null> {
  if (xeroCache && Date.now() - xeroCache.at < XERO_CACHE_TTL_MS) {
    return xeroCache.snapshot
  }
  const settings = await readSettings(supabase, ['xero_tenant_id', 'xero_tracking_map'])
  if (!settings.xero_tenant_id || !settings.xero_tracking_map) return null
  let trackingCategoryId: string | undefined
  const optionToProperty: Record<string, string> = {}
  try {
    const map = JSON.parse(settings.xero_tracking_map) as {
      trackingCategoryId?: string
      options?: { name?: string; propertyId?: string | null }[]
    }
    trackingCategoryId = map.trackingCategoryId
    for (const o of map.options ?? []) {
      if (o.name && o.propertyId && !optionToProperty[o.name]) {
        optionToProperty[o.name] = propertyNames.get(o.propertyId) ?? o.name
      }
    }
  } catch {
    return null
  }
  if (!trackingCategoryId) return null

  const { accessToken, tenantId } = await getValidAccessToken(supabase)
  const callPnL = async (from: string, to: string) => {
    const params = new URLSearchParams({
      fromDate: from,
      toDate: to,
      trackingCategoryID: trackingCategoryId!,
    })
    const res = await fetch(
      `https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?${params.toString()}`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          'xero-tenant-id': tenantId,
          accept: 'application/json',
        },
      },
    )
    if (!res.ok) throw new Error(`Xero P&L ${res.status}`)
    return parseColumnarPnL((await res.json()) as XeroReport)
  }

  const now = new Date()
  const thisFrom = isoDate(new Date(now.getFullYear(), now.getMonth(), 1))
  const thisTo = isoDate(now)
  const lastFrom = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const lastTo = isoDate(new Date(now.getFullYear(), now.getMonth(), 0))

  const thisMonth = await callPnL(thisFrom, thisTo)
  const lastMonth = await callPnL(lastFrom, lastTo)

  const snapshot: XeroSnapshot = {
    note: 'Figures from Xero P&L, one column per tracking option. "Total" is the whole-org bottom line including untracked overheads. This month is month-to-date.',
    trackingOptionToProperty: optionToProperty,
    thisMonth: { from: thisFrom, to: thisTo, byTrackingOption: thisMonth },
    lastMonth: { from: lastFrom, to: lastTo, byTrackingOption: lastMonth },
  }
  xeroCache = { at: Date.now(), snapshot }
  return snapshot
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are Casper, the Casae Living portfolio analyst. Casae Living is a Perth-based co-living operator; you report directly to the founders and you know the business model intimately. Introduce yourself as Casper if asked who you are, but don't open every reply with your name.

The business model:
- Casae head-leases residential properties from landlords, furnishes them, and places individual lodgers in rooms under private lodging arrangements (not residential tenancies).
- Margin on a property = total weekly room income minus the weekly head lease cost. Furnishing/fitout is a one-off cost recovered through margin (payback = fitout / weekly margin).
- The growth target is 20 properties by February 2027.
- WA lodging house rules: 6 lodgers in a property is the threshold — a 7th lodger triggers lodging house registration and regulatory requirements, so properties run at 6 or fewer lodgers.
- "Barnes-type" properties — a low head lease relative to room count — are the gold standard for margin.
- The operating focus is occupancy: keep every room full and know which rooms are coming vacant before they do. Rooms with status notice_given are still occupied and paying until their vacate date, then flip to vacant automatically. The vacate pipeline lists those rooms with a replacement status (unassigned / lead_assigned / confirmed); the tenant pipeline holds every lead (lead → viewing_booked → viewed → active lodger).
- All figures are AUD. Convert weekly to monthly with 52/12 (multiply weekly by 4.333); be explicit when you do.

How to work:
- Be direct, analytical and numbers-first — like a CFO who also knows the day-to-day ops. No fluff, no padding, no generic advice.
- Lead with the number or the answer, then the reasoning. Quantify everything you can from the data provided (vacancy cost per week, margin deltas, payback).
- The live portfolio data is in the JSON block below. It is the source of truth — never invent figures. If something isn't in the data, say so plainly.
- When Xero P&L data is present, prefer it for actual income/expense/net; use lodger rate data for forward-looking run rates. If Xero data is absent, say you're working from rate data, not actuals.
- Vacant rooms bleed money: the head lease is fixed, so every vacant room's weekly rent is pure lost margin. Call it out.
- Format for a plain-text panel: short paragraphs and simple "-" bullets only. No markdown headings, no bold/italics, no tables. Keep responses tight.`

const SUMMARY_PROMPT = `Give me today's portfolio briefing. Cover, in this order:
1. Occupancy — rooms empty right now, what that costs per week, and anything pending move-in.
2. Upcoming vacancies — every room in the vacate pipeline by days until vacant, and which ones still have no replacement lined up (soonest first).
3. Tenant pipeline — open leads and viewings, who could fill which vacancy, and whether viewing volume is converting to move-ins.
4. Margin performance by property, this month vs last month — use the Xero P&L snapshot if present, otherwise the lodger rate data (and say which you used).
5. The single most important thing to action today, and why.
This is a morning briefing, not a report — keep it sharp and scannable.`

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    const apiKey = env('ANTHROPIC_API_KEY')
    const supabase = await requireUser(req)
    const { mode, messages } = parseRequest(await req.json().catch(() => null))

    const { context, propertyName } = await fetchPortfolioContext(supabase)

    let xero: XeroSnapshot | null = null
    try {
      xero = await withTimeout(fetchXeroSnapshot(supabase, propertyName), XERO_BUDGET_MS)
    } catch {
      xero = null // not connected / slow / failed — model falls back to rate data
    }

    const nowPerth = new Date().toLocaleString('en-AU', {
      timeZone: 'Australia/Perth',
      dateStyle: 'full',
      timeStyle: 'short',
    })
    const system = `${SYSTEM_PROMPT}

Current date and time in Perth: ${nowPerth}

Live portfolio data:
${JSON.stringify({ ...context, xeroPnL: xero ?? 'Xero data unavailable — use lodger rate data' })}`

    const turns: ChatMessage[] =
      mode === 'summary'
        ? [{ role: 'user', content: SUMMARY_PROMPT }]
        : messages!

    const anthropic = new Anthropic({ apiKey })
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: turns,
    })

    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          controller.close()
        } catch (e) {
          controller.error(e)
        }
      },
      cancel() {
        stream.abort()
      },
    })

    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  } catch (e) {
    return errorResponse(e)
  }
}
