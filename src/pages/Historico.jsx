import { useState, useEffect } from 'react'
import { Trash2, CheckSquare, Square, AlertTriangle, Clock, Truck, Unlock } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { supabase } from '../lib/supabase'

function formatTs(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function diffHHMM(start, end) {
  if (!start || !end) return null
  const ms = new Date(end) - new Date(start)
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function Historico() {
  const [viagens,      setViagens]      = useState([])
  const [unidades,     setUnidades]     = useState([])
  const [filtroUnid,   setFiltroUnid]   = useState('todas')
  const [selecionadas, setSelecionadas] = useState(new Set())
  const [loading,      setLoading]      = useState(true)
  const [excluindo,    setExcluindo]    = useState(false)
  const [modalExcluir, setModalExcluir] = useState(false)
  const [modalLiberar, setModalLiberar] = useState(null) // viagem object
  const [liberando,    setLiberando]    = useState(null) // viagem id
  const [feedback,     setFeedback]     = useState(null) // { tipo: 'ok'|'erro', msg }

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    setSelecionadas(new Set())

    const [{ data: v }, { data: u }] = await Promise.all([
      supabase
        .from('viagens')
        .select(`
          id, status, numero_nf, dt_saida_revenda, dt_chegada_fabrica,
          dt_saida_fabrica, dt_chegada_revenda, dt_saida_entrega,
          unidade:unidades(id, nome, cidade),
          carreta:carretas(placa, tipo),
          cavalo:cavalos(placa, tipo),
          motorista:profiles(nome, tipo)
        `)
        .in('status', ['concluida', 'aguardando_conferencia'])
        .order('dt_chegada_revenda', { ascending: false }),
      supabase.from('unidades').select('id, nome, cidade').order('nome'),
    ])

    setViagens(v ?? [])
    setUnidades(u ?? [])
    setLoading(false)
  }

  const viagensFiltradas = filtroUnid === 'todas'
    ? viagens
    : viagens.filter(v => v.unidade?.id === filtroUnid)

  function toggleSelecionada(id) {
    setSelecionadas(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodas() {
    if (selecionadas.size === viagensFiltradas.length) {
      setSelecionadas(new Set())
    } else {
      setSelecionadas(new Set(viagensFiltradas.map(v => v.id)))
    }
  }

  async function confirmarExclusao() {
    setModalExcluir(false)
    setExcluindo(true)
    setFeedback(null)

    const ids = [...selecionadas]
    const { data, error } = await supabase.rpc('excluir_viagens', { p_ids: ids })

    if (error) {
      setFeedback({ tipo: 'erro', msg: 'Erro ao excluir: ' + error.message })
    } else {
      setFeedback({ tipo: 'ok', msg: `${data} viagem(ns) excluída(s) com sucesso.` })
      await carregar()
    }

    setExcluindo(false)
  }

  async function confirmarLiberar() {
    const viagem = modalLiberar
    setModalLiberar(null)
    setLiberando(viagem.id)
    setFeedback(null)

    const { error } = await supabase.rpc('liberar_motorista', { p_viagem_id: viagem.id })

    if (error) {
      setFeedback({ tipo: 'erro', msg: 'Erro ao liberar: ' + error.message })
    } else {
      setFeedback({ tipo: 'ok', msg: `Motorista ${viagem.motorista?.nome ?? ''} liberado. A saída será desbloqueada no próximo check do app.` })
      await carregar()
    }

    setLiberando(null)
  }

  const todasSelecionadas = viagensFiltradas.length > 0 && selecionadas.size === viagensFiltradas.length
  const algumaSelecionada = selecionadas.size > 0

  return (
    <AdminLayout title="Histórico de Viagens">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-4 space-y-4">

        {/* Feedback */}
        {feedback && (
          <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
            feedback.tipo === 'ok'
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <span className={`text-sm ${feedback.tipo === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {feedback.msg}
            </span>
            <button onClick={() => setFeedback(null)} className="ml-auto text-slate-600 hover:text-slate-400 text-xs">✕</button>
          </div>
        )}

        {/* Filtro unidade */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFiltroUnid('todas')}
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              filtroUnid === 'todas' ? 'bg-orange-500 text-white' : 'bg-[#112240] text-slate-500 border border-[#1E3A5F]'
            }`}>
            Todas
          </button>
          {unidades.map(u => (
            <button key={u.id}
              onClick={() => setFiltroUnid(u.id)}
              className={`shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filtroUnid === u.id ? 'bg-orange-500 text-white' : 'bg-[#112240] text-slate-500 border border-[#1E3A5F]'
              }`}>
              {u.cidade}
            </button>
          ))}
        </div>

        {/* Barra de seleção */}
        {!loading && viagensFiltradas.length > 0 && (
          <div className="flex items-center justify-between bg-[#112240] rounded-2xl border border-[#1E3A5F] px-4 py-3">
            <button onClick={toggleTodas} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
              {todasSelecionadas
                ? <CheckSquare size={18} className="text-orange-400" />
                : <Square size={18} className="text-slate-600" />}
              {todasSelecionadas ? 'Desmarcar todas' : 'Selecionar todas'}
            </button>
            <span className="text-slate-600 text-xs">{viagensFiltradas.length} viagem(ns)</span>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : viagensFiltradas.length === 0 ? (
          <div className="text-center py-16">
            <Clock size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-slate-600 text-sm">Nenhuma viagem concluída ou em conferência</p>
          </div>
        ) : (
          <div className="space-y-3">
            {viagensFiltradas.map(v => {
              const sel       = selecionadas.has(v.id)
              const tmvTotal  = diffHHMM(v.dt_saida_revenda, v.dt_saida_entrega)
              const travada   = v.status === 'aguardando_conferencia'
              const emLiberar = liberando === v.id

              return (
                <div key={v.id}
                  className={`rounded-2xl border transition-all ${
                    sel
                      ? 'bg-orange-500/10 border-orange-500'
                      : travada
                        ? 'bg-[#112240] border-blue-500/30'
                        : 'bg-[#112240] border-[#1E3A5F]'
                  }`}>

                  {/* Área clicável para seleção */}
                  <button onClick={() => toggleSelecionada(v.id)} className="w-full text-left p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {sel
                          ? <CheckSquare size={18} className="text-orange-400" />
                          : <Square size={18} className="text-slate-600" />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Unidade + badge + data */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className={`font-semibold text-sm truncate ${sel ? 'text-orange-400' : 'text-white'}`}>
                              {v.unidade?.nome ?? '—'}
                            </p>
                            {travada ? (
                              <span className="shrink-0 text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                                Em Conferência
                              </span>
                            ) : (
                              <span className="shrink-0 text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
                                Concluída
                              </span>
                            )}
                          </div>
                          <span className="text-slate-600 text-xs shrink-0">
                            {travada ? formatTs(v.dt_chegada_revenda) : formatTs(v.dt_saida_entrega)}
                          </span>
                        </div>

                        {/* Motorista + veículos */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-400 text-xs">{v.motorista?.nome ?? '—'}</span>
                          {v.motorista?.tipo && (
                            <span className="text-[10px] bg-[#0B1929] border border-[#1E3A5F] text-slate-500 px-2 py-0.5 rounded-full">
                              {v.motorista.tipo}
                            </span>
                          )}
                          <span className="text-slate-700 text-xs">·</span>
                          <Truck size={12} className="text-slate-600 shrink-0" />
                          <span className="text-slate-500 text-xs font-mono">{v.carreta?.placa ?? '—'}</span>
                          <span className="text-slate-700 text-xs">/</span>
                          <span className="text-slate-500 text-xs font-mono">{v.cavalo?.placa ?? '—'}</span>
                        </div>

                        {/* NF + TMV */}
                        <div className="flex items-center gap-3 flex-wrap">
                          {v.numero_nf && <span className="text-slate-500 text-xs">NF {v.numero_nf}</span>}
                          {tmvTotal && <span className="text-slate-600 text-xs font-mono">⏱ {tmvTotal}</span>}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Botão Liberar — só para viagens em conferência */}
                  {travada && (
                    <div className="px-4 pb-3 pt-0">
                      <button
                        onClick={e => { e.stopPropagation(); setModalLiberar(v) }}
                        disabled={emLiberar}
                        className="w-full flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 font-semibold text-xs py-2.5 rounded-xl transition-colors disabled:opacity-50">
                        {emLiberar
                          ? <div className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
                          : <Unlock size={14} />}
                        {emLiberar ? 'Liberando...' : 'Liberar Motorista'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Barra de ação — excluir selecionadas */}
      {algumaSelecionada && (
        <div className="fixed bottom-20 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="w-full max-w-2xl bg-[#1E3A5F] border border-orange-500/40 rounded-2xl px-4 py-3 flex items-center justify-between shadow-xl pointer-events-auto">
            <span className="text-white text-sm font-semibold">
              {selecionadas.size} selecionada{selecionadas.size > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => setModalExcluir(true)}
              disabled={excluindo}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors">
              {excluindo
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Trash2 size={15} />}
              {excluindo ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: confirmar exclusão */}
      {modalExcluir && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="w-full max-w-lg mx-auto bg-[#112240] rounded-t-3xl p-6 space-y-5">
            <div className="w-10 h-1 bg-[#1E3A5F] rounded-full mx-auto" />
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-base">Confirmar exclusão</p>
                <p className="text-slate-500 text-sm mt-1">
                  {selecionadas.size} viagem(ns) serão excluídas permanentemente, incluindo tarefas, conferências e anomalias.
                </p>
                <p className="text-red-400 text-xs mt-2 font-medium">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalExcluir(false)}
                className="flex-1 bg-[#0B1929] border border-[#1E3A5F] text-slate-400 font-semibold py-4 rounded-2xl text-sm">
                Cancelar
              </button>
              <button onClick={confirmarExclusao}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-4 rounded-2xl text-sm transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar liberação */}
      {modalLiberar && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="w-full max-w-lg mx-auto bg-[#112240] rounded-t-3xl p-6 space-y-5">
            <div className="w-10 h-1 bg-[#1E3A5F] rounded-full mx-auto" />
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                <Unlock size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-base">Liberar motorista</p>
                <p className="text-slate-400 text-sm mt-1">
                  <span className="text-white font-medium">{modalLiberar.motorista?.nome ?? 'Motorista'}</span>
                  {' — '}{modalLiberar.unidade?.nome}
                </p>
                <p className="text-slate-500 text-sm mt-2">
                  Isso marca a conferência como concluída e desbloqueia a "Saída após Entrega" no app do motorista. Use quando a conferência foi feita manualmente ou não será realizada.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setModalLiberar(null)}
                className="flex-1 bg-[#0B1929] border border-[#1E3A5F] text-slate-400 font-semibold py-4 rounded-2xl text-sm">
                Cancelar
              </button>
              <button onClick={confirmarLiberar}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 rounded-2xl text-sm transition-colors">
                Liberar
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
