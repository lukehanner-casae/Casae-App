import { Plus } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import VacatePipelineTable from '@/components/vacancies/VacatePipelineTable'
import LogVacateNoticeDialog from '@/components/vacancies/LogVacateNoticeDialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useVacateNotices } from '@/hooks/use-vacate-notices'
import { upcomingVacancies } from '@/lib/occupancy'
import { cn } from '@/lib/utils'

export default function VacanciesPage() {
  const { data: notices } = useVacateNotices()
  const active = (notices ?? []).filter((n) => n.status === 'active')
  const upcoming = upcomingVacancies(active)
  const unassigned = active.filter((n) => n.replacement_status === 'unassigned').length

  const tiles = [
    { label: 'Vacating in 14 days', value: upcoming.in14, alert: upcoming.in14 > 0 },
    { label: 'In 30 days', value: upcoming.in30 },
    { label: 'In 60 days', value: upcoming.in60 },
    { label: 'No replacement yet', value: unassigned, alert: unassigned > 0 },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Vacate Pipeline"
        description="Every room with notice given, soonest first. Line up a replacement before the date, not after."
        actions={
          <LogVacateNoticeDialog
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" /> Log vacate notice
              </Button>
            }
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardContent className="pt-4 text-center">
              <p className="font-body text-xs uppercase tracking-wide text-muted-foreground">
                {t.label}
              </p>
              <p
                className={cn(
                  'font-heading text-4xl font-semibold',
                  t.alert ? 'text-vacant' : 'text-navy',
                )}
              >
                {t.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <VacatePipelineTable />
    </div>
  )
}
