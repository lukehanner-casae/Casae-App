// Refreshes the stored Xero access token (POST, no body).
// Returns { expiry }. xero-api refreshes automatically too — this exists for
// an explicit refresh from the client or external tooling.

import {
  errorResponse,
  json,
  refreshTokens,
  requireUser,
  HttpError,
} from './_lib/xero'

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    const supabase = await requireUser(req)
    const { expiry } = await refreshTokens(supabase)
    return json(200, { expiry })
  } catch (e) {
    return errorResponse(e)
  }
}
