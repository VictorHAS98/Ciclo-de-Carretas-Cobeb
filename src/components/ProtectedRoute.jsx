import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const PERFIL_ROTA = {
  admin:      '/dashboard',
  motorista:  '/viagem',
  conferente: '/tarefas',
  portaria:   '/portaria',
}

export default function ProtectedRoute({ children, allowedRoles, requireAdminTotal }) {
  const { user, profile, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  if (allowedRoles && profile && !allowedRoles.includes(profile.perfil)) {
    return <Navigate to={PERFIL_ROTA[profile.perfil] ?? '/login'} replace />
  }

  if (requireAdminTotal && profile && !profile.acesso_total) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
