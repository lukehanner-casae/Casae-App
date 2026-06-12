import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * Catches render errors below it and shows a friendly message instead of a
 * blank screen. Remounted (via key) on navigation so a crash on one page
 * doesn't follow the user around.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-warning" />
          <h1 className="font-heading text-3xl font-semibold text-navy">
            Something went wrong
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            This page hit an unexpected error. Your data is safe — try again,
            or head back to the dashboard.
          </p>
          <p className="max-w-full truncate font-body text-xs text-muted-foreground/70">
            {this.state.error.message}
          </p>
          <div className="mt-2 flex gap-2">
            <Button onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.location.assign('/')}
            >
              Go to dashboard
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
