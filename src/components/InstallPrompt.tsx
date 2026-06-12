import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISSED_KEY = 'casae-install-dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Mobile banner offering to install the PWA. Only shows when the browser
 * fires beforeinstallprompt (i.e. installable and not already installed) and
 * the user hasn't dismissed it before.
 */
export default function InstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari
      ('standalone' in navigator &&
        (navigator as { standalone?: boolean }).standalone === true)
    if (isStandalone || localStorage.getItem(DISMISSED_KEY)) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!installEvent) return null

  const install = async () => {
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === 'accepted') setInstallEvent(null)
  }

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1')
    setInstallEvent(null)
  }

  return (
    <div className="fixed inset-x-3 bottom-16 z-20 flex items-center gap-3 rounded-md border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground shadow-lg md:hidden">
      <Download className="h-5 w-5 shrink-0 text-sage" />
      <div className="min-w-0 flex-1">
        <p className="font-body text-sm font-medium">Install Casae Ops</p>
        <p className="font-body text-xs text-sidebar-foreground/70">
          Add to your home screen for quick access on site.
        </p>
      </div>
      <Button size="sm" onClick={install}>
        Install
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="text-sidebar-foreground/60 hover:text-sidebar-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
