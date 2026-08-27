import PageHeader from '@/components/PageHeader'
import InsightsPanel from '@/components/insights/InsightsPanel'

export default function InsightsPage() {
  return (
    <div>
      <PageHeader
        title="Insights"
        description="Your AI portfolio analyst — a daily briefing on occupancy, upcoming vacancies, the tenant pipeline and margin, plus answers to anything else, grounded in live Casae data."
      />
      <InsightsPanel />
    </div>
  )
}
