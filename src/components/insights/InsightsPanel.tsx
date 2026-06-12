import { useEffect, useRef, useState, type FormEvent } from 'react'
import { RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDailyBriefing, useInsightsChat } from '@/hooks/use-insights'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Small Casae mark for AI messages — navy square, serif C, sage underline. */
function CasaeMark() {
  return (
    <div className="flex h-7 w-7 shrink-0 flex-col items-center justify-center rounded-md bg-navy">
      <span className="font-heading text-sm font-semibold leading-none text-cream">
        C
      </span>
      <div className="mt-0.5 h-px w-3 bg-sage" />
    </div>
  )
}

/** Three-dot typing indicator while the AI is thinking. */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1.5" aria-label="AI is typing">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-sage"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}

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

function ChatCard() {
  const chat = useInsightsChat()
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keep the latest message in view as tokens stream in.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.messages])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || chat.isStreaming) return
    void chat.send(draft)
    setDraft('')
  }

  const lastMessage = chat.messages[chat.messages.length - 1]
  const waitingForFirstToken =
    chat.isStreaming &&
    lastMessage?.role === 'assistant' &&
    lastMessage.content === ''

  return (
    <Card className="border-stone">
      <CardHeader>
        <CardTitle className="font-heading text-2xl font-semibold text-navy">
          Ask the Analyst
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          ref={scrollRef}
          className="max-h-[28rem] min-h-[8rem] space-y-4 overflow-y-auto pr-1"
        >
          {chat.messages.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground">
              Ask anything about the portfolio — vacancy cost, margin by
              property, pipeline deals, what to chase today. Answers are
              grounded in live Casae data.
            </p>
          ) : (
            chat.messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg rounded-br-sm bg-navy px-3.5 py-2.5 font-body text-sm text-cream">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2.5">
                  <CasaeMark />
                  <div className="max-w-[85%] rounded-lg rounded-tl-sm border border-stone bg-background px-3.5 py-2.5">
                    {m.content === '' && chat.isStreaming && i === chat.messages.length - 1 ? (
                      <TypingDots />
                    ) : (
                      <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-navy">
                        {m.content}
                        {chat.isStreaming && i === chat.messages.length - 1 && (
                          <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-sage align-baseline" />
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ),
            )
          )}
        </div>

        {chat.error && (
          <p className="font-body text-sm text-destructive">{chat.error}</p>
        )}

        <form onSubmit={onSubmit} className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Which property has the worst margin this month?"
            aria-label="Ask the analyst"
            disabled={waitingForFirstToken}
          />
          <Button type="submit" disabled={!draft.trim() || chat.isStreaming}>
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Send</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function InsightsPanel() {
  return (
    <div className="space-y-6">
      <BriefingCard />
      <ChatCard />
    </div>
  )
}
