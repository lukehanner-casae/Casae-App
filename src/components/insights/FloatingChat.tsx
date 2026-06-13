import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Brain, ChevronDown, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useInsightsChat, type InsightMessage } from '@/hooks/use-insights'

// Rendered client-side only — never sent to the ai-insights function, so the
// API history always starts with a user turn.
const WELCOME_MESSAGE =
  "Hi, I'm Casper the Casae analyst! Ask me anything about your portfolio."

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

/** Three-dot typing indicator while Casper is thinking. */
function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1.5" aria-label="Casper is typing">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sage" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sage [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sage [animation-delay:300ms]" />
    </div>
  )
}

function AssistantBubble({
  content,
  streaming,
}: {
  content: string
  streaming?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5">
      <CasaeMark />
      <div className="max-w-[85%] rounded-lg rounded-tl-sm border border-stone bg-card px-3.5 py-2.5">
        {content === '' && streaming ? (
          <TypingDots />
        ) : (
          <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-navy">
            {content}
            {streaming && (
              <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-sage align-baseline" />
            )}
          </p>
        )}
      </div>
    </div>
  )
}

function ChatPanel({
  messages,
  isStreaming,
  error,
  onSend,
  onMinimise,
}: {
  messages: InsightMessage[]
  isStreaming: boolean
  error: string | null
  onSend: (content: string) => void
  onMinimise: () => void
}) {
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Keep the latest message in view as tokens stream in.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || isStreaming) return
    onSend(draft)
    setDraft('')
  }

  const lastMessage = messages[messages.length - 1]
  const waitingForFirstToken =
    isStreaming && lastMessage?.role === 'assistant' && lastMessage.content === ''

  return (
    <div className="flex h-[min(500px,calc(100svh-10rem))] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-stone bg-card shadow-xl">
      {/* Navy header bar */}
      <div className="flex items-center justify-between bg-navy px-4 py-3">
        <div>
          <p className="font-heading text-lg font-semibold leading-tight text-cream">
            Casper
          </p>
          <p className="font-body text-[11px] text-cream/60">
            Casae portfolio analyst
          </p>
        </div>
        <button
          type="button"
          onClick={onMinimise}
          aria-label="Minimise chat"
          className="rounded-md p-1 text-cream/70 transition-colors hover:bg-cream/10 hover:text-cream"
        >
          <ChevronDown className="h-5 w-5" />
        </button>
      </div>

      {/* Message area */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto bg-background px-3 py-4"
      >
        <AssistantBubble content={WELCOME_MESSAGE} />
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-lg rounded-br-sm bg-navy px-3.5 py-2.5 font-body text-sm text-cream">
                {m.content}
              </div>
            </div>
          ) : (
            <AssistantBubble
              key={i}
              content={m.content}
              streaming={isStreaming && i === messages.length - 1}
            />
          ),
        )}
        {error && (
          <p className="font-body text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={onSubmit}
        className="flex gap-2 border-t border-stone bg-card p-3"
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about your portfolio…"
          aria-label="Ask Casper"
          disabled={waitingForFirstToken}
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          className="shrink-0 bg-sage text-cream hover:bg-sage/90"
          disabled={!draft.trim() || isStreaming}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}

/**
 * Persistent Casper chat — floating button bottom-right on every page, panel
 * opens above it. Mounted once in AppShell so the in-memory conversation
 * survives navigation and collapse; a refresh clears it.
 */
export default function FloatingChat() {
  const [open, setOpen] = useState(false)
  // Pulse draws attention until the widget has been opened once this session.
  const [hasOpened, setHasOpened] = useState(false)
  const chat = useInsightsChat()

  const toggle = () => {
    setOpen((prev) => !prev)
    setHasOpened(true)
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      {open && (
        <ChatPanel
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          error={chat.error}
          onSend={(content) => void chat.send(content)}
          onMinimise={() => setOpen(false)}
        />
      )}
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? 'Minimise Casper chat' : 'Open Casper chat'}
        aria-expanded={open}
        className="relative flex h-12 w-12 items-center justify-center rounded-full bg-sage text-cream shadow-lg transition-colors hover:bg-sage/90"
      >
        {!hasOpened && (
          <span
            aria-hidden
            className="absolute inset-0 animate-ping rounded-full bg-sage opacity-40"
          />
        )}
        <Brain className="h-5 w-5" />
      </button>
    </div>
  )
}
