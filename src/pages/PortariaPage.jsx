import { useState, useEffect, useCallback } from 'react'
import { LogOut, Clock, CheckCircle, Truck, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

function diffHHMM(start, end) {
  if (!start || !end) return null
  const ms = new Date(end) - new Date(start)
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatTs(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function ElapsedTimer({ from }) {
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    function update() {
      setElapsed(diffHHMM(from, new Date().toISOString()) ?? '00:00')
    }
    update()
    const id = setInterval(update, 10000)
    return () => clearInterval(id)
  }, [from])
  return <span>{elapsed}</span>
}

export default function PortariaPage() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [atendimentos, setAtendimentos] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [registrando,  setRegistrando]  = useState(null)

  const carregar = useCallback(async () => {
    if (!profile?.unidade_id) return
    setLoading(true)
    const { data } = await supabase
      .from('portaria_atendimentos')
      .select('*')
      .eq('unidade_id', profile.unidade_id)
      .order('created_at', { ascending: false })
    setAtendimentos(data ?? [])
    setLoading(false)
  }, [profile?.unidade_id])

  useEffect(() => { carregar() }, [carregar])

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function registrarEntrada(atend) {
    setRegistrando(atend.id)
    await supabase
      .from('portaria_atendimentos')
      .update({ dt_entrada: new Date().toISOString(), porteiro_id: profile.id, status: 'em_atendimento' })
      .eq('id', atend.id)
    await carregar()
    setRegistrando(null)
  }

  async function registrarSaida(atend) {
    setRegistrando(atend.id)
    await supabase
      .from('portaria_atendimentos')
      .update({ dt_saida: new Date().toISOString(), status: 'concluido' })
      .eq('id', atend.id)
    await carregar()
    setRegistrando(null)
  }

  const aguardando    = atendimentos.filter(a => a.status === 'aguardando')
  const emAtendimento = atendimentos.filter(a => a.status === 'em_atendimento')
  const concluidos    = atendimentos.filter(a => a.status === 'concluido')
  const semAtividade  = aguardando.length === 0 && emAtendimento.length === 0 && concluidos.length === 0

  return (
    <div className="min-h-screen bg-[#EBF5FF] flex flex-col">

      {/* Header */}
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
            <p className="text-blue-300/60 text-[10px] font-medium tracking-wide uppercase">
              {profile?.unidade?.cidade ?? 'Ciclo de Carretas'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={carregar} className="text-blue-300/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10" title="Atualizar">
            <RefreshCw size={16} />
          </button>
          <button onClick={handleLogout} className="text-blue-300/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10" title="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-5 pb-8 max-w-lg mx-auto w-full space-y-5">

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Em Atendimento */}
            {emAtendimento.length > 0 && (
              <section>
                <p className="text-[10px] font-semibold text-cobeb-yellow uppercase tracking-widest mb-2">Em Atendimento</p>
                <div className="space-y-3">
                  {emAtendimento.map(a => (
                    <div key={a.id} className="bg-white rounded-2xl border-2 border-cobeb-blue p-4">
                      {/* Veículo + NF */}
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Truck size={16} className="text-cobeb-yellow shrink-0" />
                          <span className="text-cobeb-text font-bold text-sm">{a.placa_cavalo ?? '—'}</span>
                          {a.placa_carreta && (
                            <span className="text-slate-500 text-xs font-mono">/ {a.placa_carreta}</span>
                          )}
                        </div>
                        <span className="text-cobeb-yellow text-sm font-mono font-semibold">NF {a.numero_nf}</span>
                      </div>

                      {/* Entrada + timer */}
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-slate-500 text-xs">Entrada: {formatTs(a.dt_entrada)}</span>
                        <div className="flex items-center gap-1 text-cobeb-yellow font-mono font-bold text-lg">
                          <Clock size={14} className="shrink-0" />
                          <ElapsedTimer from={a.dt_entrada} />
                        </div>
                      </div>

                      <button
                        onClick={() => registrarSaida(a)}
                        disabled={registrando === a.id}
                        className="w-full bg-cobeb-navy hover:bg-cobeb-blue disabled:opacity-50 text-white font-bold py-4 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
                      >
                        {registrando === a.id
                          ? <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Registrando...</>
                          : <><Clock size={18} />Registrar Saída</>}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Aguardando entrada */}
            {aguardando.length > 0 && (
              <section>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Aguardando Entrada</p>
                <div className="space-y-3">
                  {aguardando.map(a => (
                    <div key={a.id} className="bg-white rounded-2xl border border-cobeb-border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Truck size={15} className="text-slate-500 shrink-0" />
                          <span className="text-cobeb-text font-semibold text-sm">{a.placa_cavalo ?? '—'}</span>
                          {a.placa_carreta && (
                            <span className="text-slate-500 text-xs font-mono">/ {a.placa_carreta}</span>
                          )}
                        </div>
                        <span className="text-cobeb-yellow text-sm font-mono font-semibold">NF {a.numero_nf}</span>
                      </div>

                      <button
                        onClick={() => registrarEntrada(a)}
                        disabled={registrando === a.id}
                        className="w-full bg-cobeb-navy hover:bg-cobeb-blue disabled:opacity-50 text-white font-bold py-4 rounded-xl text-base transition-colors flex items-center justify-center gap-2"
                      >
                        {registrando === a.id
                          ? <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Registrando...</>
                          : <><Clock size={18} />Registrar Entrada</>}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {semAtividade && (
              <div className="text-center py-20">
                <div className="w-14 h-14 rounded-2xl bg-white border border-cobeb-border flex items-center justify-center mx-auto mb-4">
                  <Truck size={24} className="text-cobeb-border" />
                </div>
                <p className="text-slate-500 text-sm font-medium">Nenhum veículo aguardando</p>
                <p className="text-cobeb-border text-xs mt-1">Os atendimentos aparecem quando o motorista registra a chegada na revenda</p>
              </div>
            )}

            {/* Concluídos */}
            {concluidos.length > 0 && (
              <section>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Concluídos</p>
                <div className="space-y-2">
                  {concluidos.map(a => {
                    const tma = diffHHMM(a.dt_entrada, a.dt_saida)
                    return (
                      <div key={a.id} className="bg-white rounded-2xl border border-cobeb-border px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <CheckCircle size={14} className="text-green-400 shrink-0" />
                            <span className="text-cobeb-text text-sm font-semibold font-mono">{a.placa_cavalo ?? '—'}</span>
                            {a.placa_carreta && (
                              <span className="text-slate-500 text-xs font-mono truncate">/ {a.placa_carreta}</span>
                            )}
                            <span className="text-slate-400 text-xs">NF {a.numero_nf}</span>
                          </div>
                          {tma && (
                            <span className="text-cobeb-yellow font-mono text-sm font-bold shrink-0 ml-2">
                              {tma}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-1.5 text-[10px] text-slate-500">
                          <span>Entrada: {formatTs(a.dt_entrada)}</span>
                          <span>Saída: {formatTs(a.dt_saida)}</span>
                          {tma && <span className="text-cobeb-yellow font-semibold">TMA {tma}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
