import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Investments from './pages/Investments'
import InvestmentDetail from './pages/investments/InvestmentDetail'
import TaskBoard from './pages/TaskBoard'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Activity from './pages/Activity'
import MonthlyFlow from './pages/MonthlyFlow'
import Events from './pages/Events'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/inversiones" element={<Investments />} />
            <Route path="/inversiones/:id" element={<InvestmentDetail />} />
            <Route path="/tablero" element={<TaskBoard />} />
            <Route path="/flujo" element={<MonthlyFlow />} />
            <Route path="/eventos" element={<Events />} />
            <Route path="/reportes" element={<Reports />} />
            <Route path="/actividad" element={<Activity />} />
            <Route path="/configuracion" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
