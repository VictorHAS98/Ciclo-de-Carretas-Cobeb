import { LayoutDashboard, Shield, MapPin } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import AdminLayout from '../components/AdminLayout'

export default function Dashboard() {
  const { profile } = useAuth()

  return (
    <AdminLayout title="Dashboard">
      <div className="px-5 py-6 max-w-lg mx-auto">

        {/* Card do usuário */}
        <div className="bg-[#112240] rounded-2xl p-5 border border-[#1E3A5F] mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
              <Shield size={18} className="text-orange-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{profile?.nome}</p>
              <p className="text-orange-400 text-[11px] font-semibold uppercase tracking-widest mt-0.5">
                {profile?.perfil}
                {profile?.acesso_total && ' · Acesso Total'}
              </p>
            </div>
          </div>

          <div className="border-t border-[#1E3A5F] pt-4 space-y-3">
            <Row label="Email" value={profile?.email} />
            <Row
              label="Acesso"
              value={profile?.acesso_total ? '✦ Todas as unidades' : (
                <span className="flex items-center gap-1">
                  <MapPin size={11} className="text-orange-400" />
                  {profile?.unidade?.nome} — {profile?.unidade?.cidade}
                </span>
              )}
              highlight={profile?.acesso_total}
            />
          </div>
        </div>

        {/* Placeholder módulos futuros */}
        <div className="text-center py-14">
          <div className="w-14 h-14 rounded-2xl bg-[#112240] border border-[#1E3A5F] flex items-center justify-center mx-auto mb-4">
            <LayoutDashboard size={22} className="text-[#1E3A5F]" />
          </div>
          <p className="text-slate-500 text-sm font-medium">Relatórios em desenvolvimento</p>
          <p className="text-[#1E3A5F] text-xs mt-1">Os próximos módulos aparecerão aqui</p>
        </div>

      </div>
    </AdminLayout>
  )
}

function Row({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-slate-600 text-xs shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right flex items-center gap-1 ${highlight ? 'text-orange-400' : 'text-slate-300'}`}>
        {value}
      </span>
    </div>
  )
}
