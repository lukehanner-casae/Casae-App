import { Card, CardContent } from '@/components/ui/card'
import { bondStats } from '@/lib/metrics'
import { formatAud } from '@/lib/format'
import type { Lodger } from '@/lib/types'

export default function BondFloatPanel({ lodgers }: { lodgers: Lodger[] }) {
  const stats = bondStats(lodgers)

  const cells = [
    {
      label: 'Total bonds held',
      value: formatAud(stats.totalHeld),
      sub: `${stats.heldCount} lodgers`,
    },
    {
      label: 'Pending receipt',
      value: String(stats.pendingReceipt),
      sub: stats.pendingReceipt === 1 ? 'bond' : 'bonds',
    },
    {
      label: 'Due for return (30 days)',
      value: formatAud(stats.dueIn30Days),
      sub: `${stats.dueIn30DaysCount} ${stats.dueIn30DaysCount === 1 ? 'bond' : 'bonds'}`,
    },
    {
      label: 'Net float (90-day outlook)',
      value: formatAud(stats.net90Day),
      sub: 'held minus due within 90 days',
    },
  ]

  return (
    <Card>
      <CardContent className="pt-4">
        <h2 className="mb-3 font-heading text-xl font-semibold text-navy">
          Bond Float
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cells.map(({ label, value, sub }) => (
            <div key={label}>
              <p className="font-body text-xs text-muted-foreground">{label}</p>
              <p className="font-heading text-2xl font-semibold text-navy">
                {value}
              </p>
              <p className="font-body text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
