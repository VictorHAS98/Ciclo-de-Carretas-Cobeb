import { LogOut, DoorOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function PortariaPage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#EBF5FF] flex flex-col">
      <header className="bg-cobeb-navy border-b border-blue-800 px-5 py-3.5 flex items-center justify-between shrink-0 shadow-md shadow-cobeb-navy/20">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logos/logo-cobeb-transparent.png`}
            alt="COBEB"
            className="h-16 w-auto object-contain"
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.92 }}
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
          />
          <div style={{ display: 'none' }} className="w-8 h-8 rounded-lg bg-white/20 items-center justify-center">
            <span className="text-white text-xs font-black select-none">CB</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Portaria</p>
            <p className="text-blue-300/60 text-[10px] font-medium tracking-wide uppercase">Ciclo de Carretas</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-blue-300/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
          title="Sair"
        >
          <LogOut size={18} />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white border border-cobeb-border flex items-center justify-center shadow-sm">
          <DoorOpen size={28} className="text-cobeb-navy" />
        </div>
        <div className="text-center">
          <p className="text-cobeb-text font-semibold text-base">Olá, {profile?.nome?.split(' ')[0] ?? 'Porteiro'}</p>
          <p className="text-slate-500 text-sm mt-1">{profile?.unidade?.nome} — {profile?.unidade?.cidade}</p>
        </div>
        <div className="bg-white border border-cobeb-border rounded-2xl px-6 py-5 text-center max-w-xs w-full">
          <p className="text-cobeb-text text-sm font-medium">Módulo de portaria</p>
          <p className="text-slate-500 text-xs mt-1">Em breve disponível.</p>
        </div>
      </main>
    </div>
  )
}
