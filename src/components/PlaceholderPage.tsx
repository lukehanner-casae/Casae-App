import type { ReactNode } from 'react'

export default function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: ReactNode
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-heading text-4xl font-semibold text-navy">{title}</h1>
      <div className="mt-2 h-0.5 w-12 bg-sage" />
      <p className="mt-4 max-w-prose font-body text-muted-foreground">
        {description}
      </p>
      <div className="mt-8 rounded-md border border-dashed border-stone bg-card p-10 text-center">
        <p className="font-body text-sm text-muted-foreground">
          Coming in a later build session.
        </p>
      </div>
    </div>
  )
}
