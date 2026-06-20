import { useState } from 'react'
import { Truck, Users, ClipboardList, Tractor, Shield, DoorOpen } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import ErrorBoundary from '../components/ErrorBoundary'
import Motoristas from './cadastros/Motoristas'
import Conferentes from './cadastros/Conferentes'
import Portaria from './cadastros/Portaria'
import Carretas from './cadastros/Carretas'
import Cavalos from './cadastros/Cavalos'
import Admins from './cadastros/Admins'

const TABS = [
  { id: 'motoristas',  label: 'Motoristas',  icon: Users         },
  { id: 'conferentes', label: 'Conferentes', icon: ClipboardList },
  { id: 'portaria',    label: 'Portaria',    icon: DoorOpen      },
  { id: 'carretas',    label: 'Carretas',    icon: Truck         },
  { id: 'cavalos',     label: 'Cavalos',     icon: Tractor       },
  { id: 'admins',      label: 'Admins',      icon: Shield        },
]

export default function Cadastros() {
  const [abaAtiva, setAbaAtiva] = useState('motoristas')

  return (
    <AdminLayout title="Cadastros">
      {/* Tab bar */}
      <div className="bg-white border-b border-cobeb-border overflow-x-auto">
        <div className="flex min-w-max px-2">
          {TABS.map(({ id, label, icon: Icon }) => {
            const ativa = id === abaAtiva
            return (
              <button
                key={id}
                onClick={() => setAbaAtiva(id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  ativa
                    ? 'text-cobeb-navy border-cobeb-navy'
                    : 'text-slate-500 border-transparent hover:text-slate-400'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo da aba — ErrorBoundary para capturar erros de render */}
      <ErrorBoundary>
        {abaAtiva === 'motoristas'  && <Motoristas />}
        {abaAtiva === 'conferentes' && <Conferentes />}
        {abaAtiva === 'portaria'    && <Portaria />}
        {abaAtiva === 'carretas'    && <Carretas />}
        {abaAtiva === 'cavalos'     && <Cavalos />}
        {abaAtiva === 'admins'      && <Admins />}
      </ErrorBoundary>
    </AdminLayout>
  )
}
