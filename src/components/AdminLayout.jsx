import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, LogOut, Package, AlertTriangle, History } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function AdminLayout({ title, children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const isAdminTotal = profile?.acesso_total === true

  const navItems = [
    { path: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/pedidos',    icon: Package,         label: 'Pedidos'   },
    { path: '/anomalias',  icon: AlertTriangle,   label: 'Anomalias' },
    { path: '/historico',  icon: History,         label: 'Histórico' },
    ...(isAdminTotal ? [{ path: '/cadastros', icon: Users, label: 'Cadastros' }] : []),
  ]

  const showNav = true

  return (
    <div className="min-h-screen bg-[#0B1929] flex flex-col">
      <header className="bg-[#112240] border-b border-[#1E3A5F] px-5 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
            <span className="text-orange-400 text-xs font-black select-none">CB</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">{title}</p>
            <p className="text-slate-600 text-[11px]">COBEB</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-slate-500 hover:text-red-400 transition-colors p-1"
          title="Sair"
        >
          <LogOut size={18} />
        </button>
      </header>

      <main className={`flex-1 overflow-y-auto ${showNav ? 'pb-20' : 'pb-6'}`}>
        {children}
      </main>

      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-[#112240] border-t border-[#1E3A5F] flex z-40 max-w-2xl mx-auto">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active =
              location.pathname === path ||
              (path !== '/dashboard' && location.pathname.startsWith(path))
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                  active ? 'text-orange-400' : 'text-slate-600 hover:text-slate-400'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}
