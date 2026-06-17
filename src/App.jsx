import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Cadastros from './pages/Cadastros'
import Pedidos from './pages/Pedidos'
import Viagem from './pages/Viagem'
import Tarefas from './pages/Tarefas'
import Anomalias from './pages/Anomalias'
import Historico from './pages/Historico'

const PERFIL_ROTA = {
  admin:      '/dashboard',
  motorista:  '/viagem',
  conferente: '/tarefas',
}

function Spinner() {
  return (
    <div className="min-h-screen bg-[#0B1929] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) return <Spinner />

  const home = profile ? (PERFIL_ROTA[profile.perfil] ?? '/login') : '/login'

  return (
    <Routes>
      <Route
        path="/login"
        element={user && profile ? <Navigate to={home} replace /> : <Login />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pedidos"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Pedidos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cadastros"
        element={
          <ProtectedRoute allowedRoles={['admin']} requireAdminTotal>
            <Cadastros />
          </ProtectedRoute>
        }
      />
      <Route
        path="/viagem"
        element={
          <ProtectedRoute allowedRoles={['motorista']}>
            <Viagem />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tarefas"
        element={
          <ProtectedRoute allowedRoles={['conferente']}>
            <Tarefas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/anomalias"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Anomalias />
          </ProtectedRoute>
        }
      />
      <Route
        path="/historico"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <Historico />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to={home} replace />} />
      <Route path="*" element={<Navigate to={home} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
