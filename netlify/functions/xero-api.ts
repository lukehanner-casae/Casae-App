// Read-only proxy to the Xero accounting API.
//
// GET ?path=api.xro/2.0/<...>  → refreshes the access token if needed, calls
// https://api.xero.com/<path> with the tenant header and returns Xero's JSON.
// Only GETs under api.xro/2.0/ are allowed (the app only holds read scopes).

import {
  errorResponse,
  getValidAccessToken,
  json,
  refreshTokens,
  requireUser,
  HttpError,
} from './_lib/xero'

const ALLOWED_PREFIX = 'api.xro/2.0/'

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed')
    const supabase = await requireUser(req)

    const path = new URL(req.url).searchParams.get('path') ?? ''
    if (!path.startsWith(ALLOWED_PREFIX) || path.includes('..')) {
      throw new HttpError(400, `Path must start with ${ALLOWED_PREFIX}`)
    }

    const tokenInfo = await getValidAccessToken(supabase)
    const tenantId = tokenInfo.tenantId
    let accessToken = tokenInfo.accessToken

    const callXero = (token: string) =>
      fetch(`https://api.xero.com/${path}`, {
        headers: {
          authorization: `Bearer ${token}`,
          'xero-tenant-id': tenantId,
          accept: 'application/json',
        },
      })

    let res = await callXero(accessToken)
    // Stored expiry can drift from Xero's view — retry once on a fresh token.
    if (res.status === 401) {
      accessToken = (await refreshTokens(supabase)).accessToken
      res = await callXero(accessToken)
    }

    // Rate limited — back off and retry, honouring Retry-After when present.
    // Delays are capped so total wait stays inside the function timeout.
    for (let attempt = 0; res.status === 429 && attempt < 3; attempt++) {
      const retryAfter = Number(res.headers.get('retry-after'))
      const delayMs = Math.min(
        retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt,
        4000,
      )
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      res = await callXero(accessToken)
    }

    if (!res.ok) {
      const detail = await res.text()
      throw new HttpError(502, `Xero API ${res.status}: ${detail.slice(0, 500)}`)
    }
    return json(200, await res.json())
  } catch (e) {
    return errorResponse(e)
  }
}
