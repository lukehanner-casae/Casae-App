import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Link2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useXeroExchangeCode } from '@/hooks/use-xero'
import { XERO_STATE_STORAGE_KEY } from '@/lib/xero'

type Status =
  | { kind: 'connecting' }
  | { kind: 'connected'; orgName: string }
  | { kind: 'error'; message: string }

function validateRedirect(params: URLSearchParams): Status {
  const error = params.get('error')
  if (error) return { kind: 'error', message: `Xero returned: ${error}` }
  if (!params.get('code')) {
    return { kind: 'error', message: 'No authorisation code in the URL.' }
  }
  const expected = sessionStorage.getItem(XERO_STATE_STORAGE_KEY)
  if (!expected || params.get('state') !== expected) {
    return {
      kind: 'error',
      message:
        'State mismatch — the sign-in attempt could not be verified. Please try connecting again from Settings.',
    }
  }
  return { kind: 'connecting' }
}

/** Handles the redirect back from Xero (/settings/xero/callback). */
export default function XeroCallbackPage() {
  const [params] = useSearchParams()
  const exchange = useXeroExchangeCode()
  // Redirect params are validated once, while the state nonce is still in
  // sessionStorage; only the exchange result can change the status afterwards.
  const [status, setStatus] = useState<Status>(() => validateRedirect(params))
  // The exchange must run exactly once — a code is single-use and StrictMode
  // mounts effects twice in dev.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    sessionStorage.removeItem(XERO_STATE_STORAGE_KEY)
    if (status.kind !== 'connecting') return

    exchange.mutate(params.get('code')!, {
      onSuccess: ({ orgName }) => setStatus({ kind: 'connected', orgName }),
      onError: (e) => setStatus({ kind: 'error', message: e.message }),
    })
  }, [status, params, exchange])

  return (
    <div className="mx-auto max-w-md pt-10">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          {status.kind === 'connecting' && (
            <>
              <Link2 className="h-10 w-10 animate-pulse text-sage" />
              <p className="font-heading text-2xl font-semibold text-navy">
                Connecting to Xero…
              </p>
              <p className="font-body text-sm text-muted-foreground">
                Exchanging the authorisation code and saving your connection.
              </p>
            </>
          )}

          {status.kind === 'connected' && (
            <>
              <CheckCircle2 className="h-10 w-10 text-sage" />
              <p className="font-heading text-2xl font-semibold text-navy">
                Xero connected
              </p>
              <Badge className="bg-sage text-white">Connected</Badge>
              <p className="font-body text-sm text-muted-foreground">
                Linked to <strong className="text-navy">{status.orgName}</strong>.
                Next, map your tracking categories to properties in Settings.
              </p>
              <div className="flex gap-2">
                <Button asChild>
                  <Link to="/settings">Back to Settings</Link>
                </Button>
                <Button variant="secondary" asChild>
                  <Link to="/financials">View Financials</Link>
                </Button>
              </div>
            </>
          )}

          {status.kind === 'error' && (
            <>
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="font-heading text-2xl font-semibold text-navy">
                Connection failed
              </p>
              <p className="font-body text-sm text-muted-foreground">
                {status.message}
              </p>
              <Button asChild>
                <Link to="/settings">Back to Settings</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
