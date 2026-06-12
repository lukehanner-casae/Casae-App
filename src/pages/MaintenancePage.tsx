import PageHeader from '@/components/PageHeader'
import MaintenancePanel from '@/components/maintenance/MaintenancePanel'

export default function MaintenancePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Maintenance"
        description="Jobs across the portfolio — log on-site, track to completion."
      />
      <MaintenancePanel />
    </div>
  )
}
