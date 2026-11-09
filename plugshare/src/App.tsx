import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import AccountTypePage from './pages/AccountTypePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage.tsx'
import OwnerDashboard from './pages/owner/OwnerDashboard'
import FindChargerPage from './pages/owner/FindChargerPage'
import ProviderDashboard from './pages/provider/ProviderDashboard'
import AddChargerPage from './pages/provider/AddChargerPage'
import ActiveSessionPage from './pages/shared/ActiveSessionPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <div className="p-8">Loading...</div>
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/account-type" element={
        <ProtectedRoute><AccountTypePage /></ProtectedRoute>
      } />

      <Route path="/owner/dashboard" element={
        <ProtectedRoute><OwnerDashboard /></ProtectedRoute>
      } />
      <Route path="/owner/find" element={
        <ProtectedRoute><FindChargerPage /></ProtectedRoute>
      } />

      <Route path="/provider/dashboard" element={
        <ProtectedRoute><ProviderDashboard /></ProtectedRoute>
      } />
      <Route path="/provider/chargers/new" element={
        <ProtectedRoute><AddChargerPage /></ProtectedRoute>
      } />

      <Route path="/session/:id" element={
        <ProtectedRoute><ActiveSessionPage /></ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
