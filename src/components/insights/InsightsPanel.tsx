import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDailyBriefing } from '@/hooks/use-insights'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

function BriefingCard() {
  const briefing = useDailyBriefing()

  return (
    <Card className="border-stone">
      <CardHeader>
        <CardTitle className="font-heading text-2xl font-semibold text-navy">
          Portfolio Briefing
        </CardTitle>
        <CardAction className="flex items-center gap-3">
          <p className="font-body text-xs text-muted-foreground">
            {briefing.isStreaming
              ? 'Generating…'
              : briefing.fetchedAt
                ? `Updated ${formatDateTime(new Date(briefing.fetchedAt).toISOString())}`
                : ''}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => briefing.refresh()}
            disabled={briefing.isStreaming}
          >
            <RefreshCw
              className={cn('h-4 w-4', briefing.isStreaming && 'animate-spin')}
            />
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {briefing.error ? (
          <div className="space-y-2">
            <p className="font-body text-sm text-destructive">
              Couldn't generate the briefing: {briefing.error}
            </p>
            <Button variant="secondary" size="sm" onClick={() => briefing.refresh()}>
              Try again
            </Button>
          </div>
        ) : briefing.isStreaming && !briefing.text ? (
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-navy">
            {briefing.text}
            {briefing.isStreaming && (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-sage align-baseline" />
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function InsightsPanel() {
  return (
    <div className="space-y-4">
      <BriefingCard />
      <p className="font-body text-sm text-muted-foreground">
        Use the Casper chat widget in the bottom right to ask questions.
      </p>
    </div>
  )
}
