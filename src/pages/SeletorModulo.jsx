import { Navigate, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Truck, ClipboardList, Shield, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const MODULOS = [
  {
    key:    'admin',
    rota:   '/dashboard',
    label:  'Administrador',
    desc:   'Painel, histórico, cadastros e relatórios',
    Icon:   LayoutDashboard,
    cor:    'bg-cobeb-navy',
    borda:  'border-cobeb-navy/30',
    texto:  'text-cobeb-navy',
    fundo:  'bg-cobeb-navy/5 hover:bg-cobeb-navy/10',
  },
  {
    key:    'motorista',
    rota:   '/viagem',
    label:  'Motorista',
    desc:   'Wizard de viagem, etapas e ciclo de carretas',
    Icon:   Truck,
    cor:    'bg-blue-500',
    borda:  'border-blue-500/30',
    texto:  'text-blue-600',
    fundo:  'bg-blue-500/5 hover:bg-blue-500/10',
  },
  {
    key:    'conferente',
    rota:   '/tarefas',
    label:  'Conferente',
    desc:   'Conferência de carga e registro de anomalias',
    Icon:   ClipboardList,
    cor:    'bg-green-600',
    borda:  'border-green-600/30',
    texto:  'text-green-700',
    fundo:  'bg-green-600/5 hover:bg-green-600/10',
  },
  {
    key:    'portaria',
    rota:   '/portaria',
    label:  'Portaria',
    desc:   'Controle de entrada e saída de veículos',
    Icon:   Shield,
    cor:    'bg-cobeb-yellow',
    borda:  'border-cobeb-yellow/40',
    texto:  'text-yellow-700',
    fundo:  'bg-cobeb-yellow/5 hover:bg-cobeb-yellow/10',
  },
]

export default function SeletorModulo() {
  const { user, profile, loading, modoVisao, setModoVisao, signOut } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EBF5FF] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || !profile?.acesso_total) return <Navigate to="/login" replace />

  // Se já tem modo, redireciona
  if (modoVisao) {
    const mod = MODULOS.find(m => m.key === modoVisao)
    return <Navigate to={mod?.rota ?? '/dashboard'} replace />
  }

  function entrar(modulo) {
    setModoVisao(modulo.key)
    navigate(modulo.rota, { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#EBF5FF] flex flex-col">

      {/* Header */}
      <header className="bg-cobeb-navy px-5 py-4 flex items-center justify-between shadow-md shadow-cobeb-navy/20">
        <div>
          <p className="text-cobeb-yellow text-xl font-black tracking-tight leading-none">COBEB</p>
          <p className="text-blue-300/70 text-[10px] font-semibold tracking-widest uppercase">Distribuidora</p>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-blue-300/70 hover:text-white text-xs transition-colors p-1.5 rounded-lg hover:bg-white/10"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </header>

      {/* Body */}
      <main className="flex-1 flex flex-col items-center justify-start px-5 pt-8 pb-10">
        <div className="w-full max-w-sm">

          {/* Saudação */}
          <div className="mb-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-cobeb-navy flex items-center justify-center mx-auto mb-3 shadow-lg shadow-cobeb-navy/30">
              <span className="text-cobeb-yellow text-xl font-black">
                {(profile.nome ?? 'A').charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-cobeb-text font-bold text-base">
              {profile.nome ?? 'Administrador'}
            </p>
            <p className="text-slate-500 text-sm mt-0.5">Selecione o módulo de acesso</p>
          </div>

          {/* Cards de módulo */}
          <div className="grid grid-cols-2 gap-3">
            {MODULOS.map(mod => {
              const { Icon } = mod
              return (
                <button
                  key={mod.key}
                  onClick={() => entrar(mod)}
                  className={`${mod.fundo} border ${mod.borda} rounded-2xl p-4 text-left flex flex-col gap-3 transition-all active:scale-95`}
                >
                  <div className={`w-10 h-10 rounded-xl ${mod.cor} flex items-center justify-center shadow-sm`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${mod.texto}`}>{mod.label}</p>
                    <p className="text-slate-500 text-[10px] leading-snug mt-0.5">{mod.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
