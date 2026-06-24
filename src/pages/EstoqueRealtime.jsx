import { Forklift } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function EstoqueRealtime() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-[#EBF5FF] flex flex-col">
      <header className="bg-cobeb-navy px-5 py-3.5 flex items-center justify-between shadow-md shadow-cobeb-navy/20">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logos/logo-cobeb-transparent.png`}
            alt="COBEB"
            className="h-12 w-auto object-contain"
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.92 }}
            onError={e => { e.target.style.display = 'none' }}
          />
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Estoque</p>
            <p className="text-blue-300/60 text-[10px] font-medium tracking-wide uppercase">Ciclo de Carretas</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="text-blue-300/70 hover:text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          Sair
        </button>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="w-20 h-20 rounded-2xl bg-cobeb-navy/10 border border-cobeb-border flex items-center justify-center">
          <Forklift size={36} className="text-cobeb-navy opacity-40" />
        </div>
        <div>
          <p className="text-cobeb-text font-bold text-lg">Painel em construção</p>
          <p className="text-slate-500 text-sm mt-1">
            O módulo de estoque em tempo real estará disponível em breve.
          </p>
        </div>
        {profile?.unidade && (
          <div className="bg-white border border-cobeb-border rounded-xl px-5 py-3 text-sm text-slate-500">
            Unidade: <span className="font-semibold text-cobeb-text">{profile.unidade.nome}</span>
          </div>
        )}
      </div>
    </div>
  )
}
