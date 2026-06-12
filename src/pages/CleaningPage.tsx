import PageHeader from '@/components/PageHeader'
import CleansPanel from '@/components/cleaning/CleansPanel'

export default function CleaningPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Cleaning"
        description="Schedule, recurring setup and completion tracking per property."
      />
      <CleansPanel />
    </div>
  )
}
