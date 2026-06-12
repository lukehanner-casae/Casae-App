import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from '@/components/ProtectedRoute'
import AppShell from '@/components/AppShell'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import PropertiesPage from '@/pages/PropertiesPage'
import PropertyDetailPage from '@/pages/PropertyDetailPage'
import LodgersPage from '@/pages/LodgersPage'
import LodgerProfilePage from '@/pages/LodgerProfilePage'
import MaintenancePage from '@/pages/MaintenancePage'
import InspectionsPage from '@/pages/InspectionsPage'
import InspectionDetailPage from '@/pages/InspectionDetailPage'
import CleaningPage from '@/pages/CleaningPage'
import FinancialsPage from '@/pages/FinancialsPage'
import InsightsPage from '@/pages/InsightsPage'
import PipelinePage from '@/pages/PipelinePage'
import ContactsPage from '@/pages/ContactsPage'
import SettingsPage from '@/pages/SettingsPage'
import XeroCallbackPage from '@/pages/XeroCallbackPage'
import MorePage from '@/pages/MorePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="properties" element={<PropertiesPage />} />
          <Route path="properties/:id" element={<PropertyDetailPage />} />
          <Route path="lodgers" element={<LodgersPage />} />
          <Route path="lodgers/:id" element={<LodgerProfilePage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="inspections" element={<InspectionsPage />} />
          <Route path="inspections/:id" element={<InspectionDetailPage />} />
          <Route path="cleaning" element={<CleaningPage />} />
          <Route path="financials" element={<FinancialsPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/xero/callback" element={<XeroCallbackPage />} />
          <Route path="more" element={<MorePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
