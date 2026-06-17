import { useState } from 'react'
import { Truck, Users, ClipboardList, Tractor, Shield } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import Motoristas from './cadastros/Motoristas'
import Conferentes from './cadastros/Conferentes'
import Carretas from './cadastros/Carretas'
import Cavalos from './cadastros/Cavalos'
import Admins from './cadastros/Admins'

const TABS = [
  { id: 'motoristas',  label: 'Motoristas',  icon: Users,          component: Motoristas  },
  { id: 'conferentes', label: 'Conferentes', icon: ClipboardList,  component: Conferentes },
  { id: 'carretas',    label: 'Carretas',    icon: Truck,          component: Carretas    },
  { id: 'cavalos',     label: 'Cavalos',     icon: Tractor,        component: Cavalos     },
  { id: 'admins',      label: 'Admins',      icon: Shield,         component: Admins      },
]

export default function Cadastros() {
  const [abaAtiva, setAbaAtiva] = useState('motoristas')
  const TabAtual = TABS.find(t => t.id === abaAtiva)?.component ?? Motoristas

  return (
    <AdminLayout title="Cadastros">
      {/* Tab bar */}
      <div className="bg-[#112240] border-b border-[#1E3A5F] overflow-x-auto">
        <div className="flex min-w-max px-2">
          {TABS.map(({ id, label, icon: Icon }) => {
            const ativa = id === abaAtiva
            return (
              <button
                key={id}
                onClick={() => setAbaAtiva(id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  ativa
                    ? 'text-orange-400 border-orange-500'
                    : 'text-slate-600 border-transparent hover:text-slate-400'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo da aba */}
      <TabAtual />
    </AdminLayout>
  )
}
