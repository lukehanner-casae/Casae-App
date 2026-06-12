import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  parsePnLReport,
  parseTrackingMap,
  type PnLSummary,
  type XeroReportResponse,
  type XeroTrackingCategoriesResponse,
  type XeroTrackingMap,
} from '@/lib/xero'

// app_settings keys owned by the Xero integration. The tracking map is kept
// on disconnect so a reconnect doesn't lose the property mapping.
const TOKEN_KEYS = [
  'xero_access_token',
  'xero_refresh_token',
  'xero_tenant_id',
  'xero_token_expiry',
  'xero_org_name',
]

export const TRACKING_MAP_KEY = 'xero_tracking_map'

async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')
  return { Authorization: `Bearer ${token}` }
}

async function fnFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/.netlify/functions/${path}`, {
    ...init,
    headers: { ...(await authHeaders()), ...init?.headers },
  })
  const body = (await res.json().catch(() => null)) as
    | (T & { error?: string })
    | null
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed (${res.status})`)
  }
  return body as T
}

/** GET an api.xro/2.0/... path through the xero-api proxy function. */
export function xeroApiGet<T>(path: string): Promise<T> {
  return fnFetch<T>(`xero-api?path=${encodeURIComponent(path)}`)
}

// ---------------------------------------------------------------------------
// Connection status
// ---------------------------------------------------------------------------

export interface XeroConnection {
  connected: boolean
  orgName: string | null
  tenantId: string | null
}

export function useXeroConnection() {
  return useQuery({
    queryKey: ['xero', 'connection'],
    queryFn: async (): Promise<XeroConnection> => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['xero_tenant_id', 'xero_org_name', 'xero_refresh_token'])
      if (error) throw error
      const map = new Map((data ?? []).map((r) => [r.key, r.value]))
      const tenantId = map.get('xero_tenant_id') ?? null
      return {
        connected: !!tenantId && !!map.get('xero_refresh_token'),
        orgName: map.get('xero_org_name') ?? null,
        tenantId,
      }
    },
  })
}

/** Exchange the OAuth callback code via the xero-auth function. */
export function useXeroExchangeCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (code: string) =>
      fnFetch<{ orgName: string; tenantId: string }>('xero-auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['xero'] }),
  })
}

export function useXeroDisconnect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('app_settings')
        .delete()
        .in('key', TOKEN_KEYS)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['xero'] }),
  })
}

// ---------------------------------------------------------------------------
// Tracking categories + property mapping
// ---------------------------------------------------------------------------

export function useXeroTrackingCategories(enabled: boolean) {
  return useQuery({
    queryKey: ['xero', 'tracking-categories'],
    enabled,
    staleTime: 1000 * 60 * 10,
    queryFn: () =>
      xeroApiGet<XeroTrackingCategoriesResponse>(
        'api.xro/2.0/TrackingCategories',
      ),
  })
}

export function useXeroTrackingMap() {
  return useQuery({
    queryKey: ['app-settings', TRACKING_MAP_KEY],
    queryFn: async (): Promise<XeroTrackingMap | null> => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', TRACKING_MAP_KEY)
        .maybeSingle()
      if (error) throw error
      return parseTrackingMap(data?.value)
    },
  })
}

// ---------------------------------------------------------------------------
// Profit & Loss per mapped property
// ---------------------------------------------------------------------------

export interface XeroPnLRow {
  propertyId: string
  trackingOptionId: string
  optionName: string
  summary: PnLSummary
}

export function useXeroPnL(
  from: string | null,
  to: string | null,
  map: XeroTrackingMap | null | undefined,
  enabled: boolean,
) {
  const mapped = (map?.options ?? []).filter((o) => o.propertyId)
  return useQuery({
    queryKey: [
      'xero',
      'pnl',
      from,
      to,
      map?.trackingCategoryId,
      mapped.map((o) => `${o.trackingOptionId}:${o.propertyId}`).join(','),
    ],
    enabled: enabled && !!from && !!to && !!map && mapped.length > 0,
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<XeroPnLRow[]> => {
      // Sequential with a gap — Xero allows only 5 concurrent calls and
      // 60/min per app, so one P&L request per property at a time.
      const rows: XeroPnLRow[] = []
      for (const option of mapped) {
        if (rows.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
        const params = new URLSearchParams({
          fromDate: from!,
          toDate: to!,
          trackingCategoryID: map!.trackingCategoryId,
          trackingOptionID: option.trackingOptionId,
        })
        const report = await xeroApiGet<XeroReportResponse>(
          `api.xro/2.0/Reports/ProfitAndLoss?${params.toString()}`,
        )
        rows.push({
          propertyId: option.propertyId!,
          trackingOptionId: option.trackingOptionId,
          optionName: option.name,
          summary: parsePnLReport(report),
        })
      }
      return rows
    },
  })
}
