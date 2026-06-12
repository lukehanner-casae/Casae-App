// Shared helpers for the Xero Netlify Functions.
//
// Tokens live in the app_settings table, encrypted with AES-256-GCM using a
// key derived from XERO_CLIENT_SECRET (so no extra secret is needed). All
// Supabase access goes through the caller's JWT + anon key, so the functions
// can only do what a logged-in team member could do under RLS.

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
export const XERO_AUTHORIZE_URL =
  'https://login.xero.com/identity/connect/authorize'
export const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'
// offline_access is required for Xero to issue a refresh token.
export const XERO_SCOPES =
  'openid profile email offline_access accounting.settings accounting.contacts.read accounting.invoices.read accounting.banktransactions.read accounting.payments.read accounting.reports.profitandloss.read accounting.reports.aged.read accounting.reports.balancesheet.read'

export const SETTING_KEYS = {
  accessToken: 'xero_access_token',
  refreshToken: 'xero_refresh_token',
  tenantId: 'xero_tenant_id',
  tokenExpiry: 'xero_token_expiry',
  orgName: 'xero_org_name',
} as const

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function env(name: string): string {
  const value = process.env[name]
  if (!value) throw new HttpError(500, `Missing environment variable ${name}`)
  return value
}

export function redirectUri(): string {
  return (
    process.env.XERO_REDIRECT_URI ??
    'https://casae-ops.netlify.app/settings/xero/callback'
  )
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return json(e.status, { error: e.message })
  const message = e instanceof Error ? e.message : 'Unexpected error'
  return json(500, { error: message })
}

// ---------------------------------------------------------------------------
// Encryption (AES-256-GCM, key = sha256(XERO_CLIENT_SECRET))
// ---------------------------------------------------------------------------

function encryptionKey(): Buffer {
  return createHash('sha256').update(env('XERO_CLIENT_SECRET')).digest()
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), data]
    .map((b) => b.toString('base64'))
    .join('.')
}

export function decrypt(stored: string): string {
  const parts = stored.split('.')
  if (parts.length !== 3) throw new HttpError(500, 'Malformed encrypted value')
  const [iv, tag, data] = parts.map((p) => Buffer.from(p, 'base64'))
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  )
}

// ---------------------------------------------------------------------------
// Supabase (caller's JWT — functions act as the logged-in user)
// ---------------------------------------------------------------------------

export async function requireUser(req: Request): Promise<SupabaseClient> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Missing Authorization bearer token')
  const supabase = createClient(
    env('VITE_SUPABASE_URL'),
    env('VITE_SUPABASE_ANON_KEY'),
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Invalid or expired session')
  return supabase
}

export async function readSettings(
  supabase: SupabaseClient,
  keys: string[],
): Promise<Record<string, string | null>> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', keys)
  if (error) throw new HttpError(500, `Settings read failed: ${error.message}`)
  const result: Record<string, string | null> = {}
  for (const row of data ?? []) result[row.key] = row.value
  return result
}

export async function writeSettings(
  supabase: SupabaseClient,
  entries: Record<string, string | null>,
): Promise<void> {
  const updated_at = new Date().toISOString()
  const rows = Object.entries(entries).map(([key, value]) => ({
    key,
    value,
    updated_at,
  }))
  const { error } = await supabase.from('app_settings').upsert(rows)
  if (error) throw new HttpError(500, `Settings write failed: ${error.message}`)
}

// ---------------------------------------------------------------------------
// Xero tokens
// ---------------------------------------------------------------------------

interface XeroTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

async function requestTokens(
  params: Record<string, string>,
): Promise<XeroTokenResponse> {
  const basic = Buffer.from(
    `${env('XERO_CLIENT_ID')}:${env('XERO_CLIENT_SECRET')}`,
  ).toString('base64')
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new HttpError(502, `Xero token request failed (${res.status}): ${detail}`)
  }
  return (await res.json()) as XeroTokenResponse
}

export async function storeTokens(
  supabase: SupabaseClient,
  tokens: XeroTokenResponse,
): Promise<string> {
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  await writeSettings(supabase, {
    [SETTING_KEYS.accessToken]: encrypt(tokens.access_token),
    [SETTING_KEYS.refreshToken]: encrypt(tokens.refresh_token),
    [SETTING_KEYS.tokenExpiry]: expiry,
  })
  return expiry
}

export async function exchangeCode(code: string): Promise<XeroTokenResponse> {
  return requestTokens({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
  })
}

/** Refresh the access token using the stored refresh token; persists both. */
export async function refreshTokens(
  supabase: SupabaseClient,
): Promise<{ accessToken: string; expiry: string }> {
  const settings = await readSettings(supabase, [SETTING_KEYS.refreshToken])
  const stored = settings[SETTING_KEYS.refreshToken]
  if (!stored) throw new HttpError(409, 'Xero is not connected')
  const tokens = await requestTokens({
    grant_type: 'refresh_token',
    refresh_token: decrypt(stored),
  })
  const expiry = await storeTokens(supabase, tokens)
  return { accessToken: tokens.access_token, expiry }
}

/** Returns a non-expired access token + tenant id, refreshing when needed. */
export async function getValidAccessToken(
  supabase: SupabaseClient,
): Promise<{ accessToken: string; tenantId: string }> {
  const settings = await readSettings(supabase, [
    SETTING_KEYS.accessToken,
    SETTING_KEYS.tokenExpiry,
    SETTING_KEYS.tenantId,
  ])
  const tenantId = settings[SETTING_KEYS.tenantId]
  if (!tenantId) throw new HttpError(409, 'Xero is not connected')
  const expiry = settings[SETTING_KEYS.tokenExpiry]
  const stored = settings[SETTING_KEYS.accessToken]
  // 60s of slack so a token can't expire mid-request.
  if (stored && expiry && Date.parse(expiry) - Date.now() > 60_000) {
    return { accessToken: decrypt(stored), tenantId }
  }
  const { accessToken } = await refreshTokens(supabase)
  return { accessToken, tenantId }
}
