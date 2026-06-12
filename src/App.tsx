import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { AppStateProvider } from './hooks/useAppState'
import Layout from './components/Layout'
import TodayPage from './pages/TodayPage'
import WorkoutPage from './pages/WorkoutPage'
import SummaryPage from './pages/SummaryPage'
import HistoryPage from './pages/HistoryPage'
import HistoryDetailPage from './pages/HistoryDetailPage'
import TrendsPage from './pages/TrendsPage'
import SettingsPage from './pages/SettingsPage'
import AuthPage from './pages/AuthPage'
import EditPlanPage from './pages/EditPlanPage'

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppStateProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<TodayPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/history/:id" element={<HistoryDetailPage />} />
              <Route path="/trends" element={<TrendsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/settings/plan/:templateId" element={<EditPlanPage />} />
              <Route path="/auth" element={<AuthPage />} />
            </Route>
            <Route path="/workout/:templateId" element={<WorkoutPage />} />
            <Route path="/summary/:sessionId" element={<SummaryPage />} />
          </Routes>
        </AppStateProvider>
      </AuthProvider>
    </HashRouter>
  )
}
