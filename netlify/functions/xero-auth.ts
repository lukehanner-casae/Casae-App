// Xero OAuth entry + code exchange.
//
// GET  ?state=<uuid>  → 302 to Xero's authorize URL (the Connect button
//                       navigates here so the client id never ships in the
//                       frontend bundle).
// POST { code }       → exchanges the code for tokens, resolves the tenant
//                       via /connections, stores everything in app_settings
//                       (tokens encrypted) and returns { orgName, tenantId }.

import {
  errorResponse,
  env,
  exchangeCode,
  json,
  redirectUri,
  requireUser,
  storeTokens,
  writeSettings,
  HttpError,
  SETTING_KEYS,
  XERO_AUTHORIZE_URL,
  XERO_CONNECTIONS_URL,
  XERO_SCOPES,
} from './_lib/xero'

interface XeroConnection {
  tenantId: string
  tenantName: string
  tenantType: string
}

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method === 'GET') {
      const state = new URL(req.url).searchParams.get('state')
      if (!state) throw new HttpError(400, 'Missing state parameter')
      const authorize = new URL(XERO_AUTHORIZE_URL)
      authorize.searchParams.set('response_type', 'code')
      authorize.searchParams.set('client_id', env('XERO_CLIENT_ID'))
      authorize.searchParams.set('redirect_uri', redirectUri())
      authorize.searchParams.set('scope', XERO_SCOPES)
      authorize.searchParams.set('state', state)
      return new Response(null, {
        status: 302,
        headers: { location: authorize.toString() },
      })
    }

    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    const supabase = await requireUser(req)
    const body = (await req.json().catch(() => null)) as { code?: string } | null
    if (!body?.code) throw new HttpError(400, 'Missing code')

    const tokens = await exchangeCode(body.code)

    const connectionsRes = await fetch(XERO_CONNECTIONS_URL, {
      headers: {
        authorization: `Bearer ${tokens.access_token}`,
        accept: 'application/json',
      },
    })
    if (!connectionsRes.ok) {
      throw new HttpError(502, `Xero connections lookup failed (${connectionsRes.status})`)
    }
    const connections = (await connectionsRes.json()) as XeroConnection[]
    const org = connections.find((c) => c.tenantType === 'ORGANISATION') ?? connections[0]
    if (!org) throw new HttpError(502, 'No Xero organisation authorised')

    await storeTokens(supabase, tokens)
    await writeSettings(supabase, {
      [SETTING_KEYS.tenantId]: org.tenantId,
      [SETTING_KEYS.orgName]: org.tenantName,
    })

    return json(200, { orgName: org.tenantName, tenantId: org.tenantId })
  } catch (e) {
    return errorResponse(e)
  }
}
