// AI insights — streaming client for the ai-insights Netlify function.
//
// The function streams plain UTF-8 text (no SSE framing), so the client just
// reads the body and appends chunks. TanStack Query doesn't model a stream
// that mutates state token-by-token, so these are hand-rolled hooks; the
// daily briefing is cached in localStorage and refreshed when older than
// six hours.

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface InsightMessage {
  role: 'user' | 'assistant'
  content: string
}

const BRIEFING_CACHE_KEY = 'casae-insights-briefing'
const BRIEFING_MAX_AGE_MS = 6 * 60 * 60 * 1000

interface BriefingCache {
  text: string
  fetchedAt: number
}

function readBriefingCache(): BriefingCache | null {
  try {
    const raw = localStorage.getItem(BRIEFING_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BriefingCache
    if (typeof parsed?.text !== 'string' || typeof parsed?.fetchedAt !== 'number') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function writeBriefingCache(cache: BriefingCache) {
  try {
    localStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Storage full / private mode — the briefing just refetches next visit.
  }
}

/** POST to the ai-insights function and stream text deltas to onDelta. */
async function streamInsights(
  body: { mode: 'summary' | 'chat'; messages: InsightMessage[] },
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not signed in')

  const res = await fetch('/.netlify/functions/ai-insights', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal,
  })
  if (!res.ok || !res.body) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(detail?.error ?? `Insights request failed (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    if (chunk) {
      full += chunk
      onDelta(chunk)
    }
  }
  return full
}

// ---------------------------------------------------------------------------
// Daily briefing
// ---------------------------------------------------------------------------

export function useDailyBriefing() {
  // A briefing cached within the last six hours seeds the initial state, so
  // revisits render instantly; anything older triggers a fresh generation.
  const [initialCache] = useState(() => {
    const cached = readBriefingCache()
    return cached && Date.now() - cached.fetchedAt < BRIEFING_MAX_AGE_MS
      ? cached
      : null
  })
  const [text, setText] = useState(initialCache?.text ?? '')
  const [fetchedAt, setFetchedAt] = useState<number | null>(
    initialCache?.fetchedAt ?? null,
  )
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const startedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchBriefing = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsStreaming(true)
    setError(null)
    setText('')
    try {
      const full = await streamInsights(
        { mode: 'summary', messages: [] },
        (chunk) => setText((prev) => prev + chunk),
        controller.signal,
      )
      const now = Date.now()
      setFetchedAt(now)
      writeBriefingCache({ text: full, fetchedAt: now })
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : 'Briefing failed')
      }
    } finally {
      if (!controller.signal.aborted) setIsStreaming(false)
    }
  }, [])

  // Auto-generate on first visit when there's no fresh cache. The kick-off
  // is deferred to a timeout (not a synchronous setState inside the effect)
  // and ref-guarded so StrictMode double-effects never start two streams.
  useEffect(() => {
    if (initialCache) return
    const id = setTimeout(() => {
      if (startedRef.current) return
      startedRef.current = true
      void fetchBriefing()
    }, 0)
    return () => clearTimeout(id)
  }, [initialCache, fetchBriefing])

  return { text, fetchedAt, isStreaming, error, refresh: fetchBriefing }
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export function useInsightsChat() {
  const [messages, setMessages] = useState<InsightMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const send = useCallback(
    async (content: string) => {
      const question = content.trim()
      if (!question || isStreaming) return
      const history: InsightMessage[] = [
        ...messages,
        { role: 'user', content: question },
      ]
      const controller = new AbortController()
      abortRef.current = controller
      setError(null)
      setIsStreaming(true)
      // Append the user turn plus an empty assistant turn that the stream
      // fills in token by token.
      setMessages([...history, { role: 'assistant', content: '' }])
      try {
        await streamInsights(
          { mode: 'chat', messages: history },
          (chunk) =>
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              next[next.length - 1] = { ...last, content: last.content + chunk }
              return next
            }),
          controller.signal,
        )
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Message failed')
          // Drop the empty assistant placeholder so the user can retry.
          setMessages((prev) =>
            prev[prev.length - 1]?.role === 'assistant' &&
            prev[prev.length - 1].content === ''
              ? prev.slice(0, -1)
              : prev,
          )
        }
      } finally {
        if (!controller.signal.aborted) setIsStreaming(false)
      }
    },
    [messages, isStreaming],
  )

  return { messages, isStreaming, error, send }
}
