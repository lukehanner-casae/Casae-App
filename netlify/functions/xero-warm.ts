// Keeps the xero-api function warm so the first P&L sync after a quiet spell
// doesn't pay a 10s+ cold start. Each Netlify function runs on its own
// lambda, so simply existing on a schedule warms only this function — it has
// to ping xero-api over HTTP. The ?warm=1 path returns before auth, so no
// credentials are involved.
//
// process.env.URL is the site's primary URL, set by Netlify at runtime.
// Scheduled functions only run on the published production deploy.

export default async function handler(): Promise<Response> {
  const base = process.env.URL
  if (!base) {
    return new Response('URL env var not set; skipping warm ping', {
      status: 200,
    })
  }
  const res = await fetch(`${base}/.netlify/functions/xero-api?warm=1`)
  return new Response(`xero-api warm ping → ${res.status}`, { status: 200 })
}

export const config = { schedule: '*/10 * * * *' }
