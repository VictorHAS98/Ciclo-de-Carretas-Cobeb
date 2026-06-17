import { useState, useEffect, useRef } from 'react'
import {
  LogOut, ClipboardList, MapPin, ChevronLeft, CheckCircle, Clock,
  AlertCircle, Package, Truck, RefreshCw, Camera, AlertTriangle, Plus, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pendente:     { label: 'Pendente',     color: 'text-slate-500',  bg: 'bg-[#0B1929]',    border: 'border-[#1E3A5F]' },
  em_andamento: { label: 'Em Andamento', color: 'text-blue-400',   bg: 'bg-blue-500/10',  border: 'border-blue-500/40' },
  concluida:    { label: 'Concluída',    color: 'text-green-400',  bg: 'bg-green-500/10', border: 'border-green-500/40' },
}

function formatTs(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function calcCaixas(qtdeRecebida, pedido) {
  const rec = Number(qtdeRecebida)
  const pal = Number(pedido.qtde_pallets)
  const cx  = Number(pedido.qtde_skus)
  if (!rec || !pal) return null
  return Math.round(rec * (cx / pal))
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Tarefas() {
  const { profile, signOut } = useAuth()

  const [view, setView]             = useState('lista')
  const [tarefaSel, setTarefaSel]   = useState(null)

  // lista
  const [tarefas, setTarefas]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [filtroStatus, setFiltroStatus]   = useState('')
  const [iniciando, setIniciando]         = useState(null)

  // conferência
  const [pedidos, setPedidos]             = useState([])
  const [itenState, setItenState]         = useState({})
  const [anomalias, setAnomalias]         = useState([])
  const [loadingConf, setLoadingConf]     = useState(false)
  const [concluindo, setConcluindo]       = useState(false)

  // anomalia modal
  const [showModal, setShowModal]         = useState(false)
  const [anomForm, setAnomaliaForm]       = useState(null)
  const [salvandoAno, setSalvandoAno]     = useState(false)
  const fotoRefs                          = [useRef(), useRef(), useRef()]

  useEffect(() => { loadLista() }, [])

  // ─── Lista ──────────────────────────────────────────────────────────────────

  async function loadLista() {
    setLoading(true)
    const { data } = await supabase
      .from('tarefas')
      .select(`*,
        viagem:viagens(
          id, horario_agendado, dt_chegada_revenda,
          motorista:profiles(nome, tipo),
          carreta:carretas(placa),
          cavalo:cavalos(placa)
        )
      `)
      .order('created_at', { ascending: false })
    setTarefas(data ?? [])
    setLoading(false)
  }

  async function iniciarConferencia(tarefa) {
    setIniciando(tarefa.id)
    const { error } = await supabase.from('tarefas')
      .update({ status: 'em_andamento', conferente_id: profile.id })
      .eq('id', tarefa.id)
    setIniciando(null)
    if (error) return
    const updated = { ...tarefa, status: 'em_andamento', conferente_id: profile.id }
    setTarefas(prev => prev.map(t => t.id === tarefa.id ? updated : t))
    openConferencia(updated)
  }

  function openConferencia(tarefa) {
    setTarefaSel(tarefa)
    setView('conferencia')
    loadConferencia(tarefa)
  }

  function voltarLista() {
    setView('lista')
    setTarefaSel(null)
    setPedidos([])
    setItenState({})
    setAnomalias([])
  }

  // ─── Conferência ────────────────────────────────────────────────────────────

  async function loadConferencia(tarefa) {
    setLoadingConf(true)
    if (!tarefa.viagem?.id) {
      setPedidos([]); setItenState({}); setAnomalias([])
      setLoadingConf(false)
      return
    }
    const [{ data: peds }, { data: itens }, { data: anos }] = await Promise.all([
      supabase.from('pedidos').select('*').eq('viagem_id', tarefa.viagem.id).order('descricao'),
      supabase.from('conferencia_itens').select('*').eq('tarefa_id', tarefa.id),
      supabase.from('anomalias')
        .select('*, pedido:pedidos(descricao, cod_produto)')
        .eq('tarefa_id', tarefa.id)
        .order('created_at'),
    ])
    setPedidos(peds ?? [])
    const state = {}
    ;(itens ?? []).forEach(it => {
      state[it.pedido_id] = {
        qtde_recebida: it.qtde_recebida != null ? String(it.qtde_recebida) : '',
        data_validade: it.data_validade ?? '',
      }
    })
    setItenState(state)
    setAnomalias(anos ?? [])
    setLoadingConf(false)
  }

  function setItemField(pedidoId, field, value) {
    setItenState(s => ({ ...s, [pedidoId]: { ...(s[pedidoId] ?? {}), [field]: value } }))
  }

  async function salvarItem(pedidoId) {
    const it = itenState[pedidoId] ?? {}
    await supabase.from('conferencia_itens').upsert({
      tarefa_id:     tarefaSel.id,
      pedido_id:     pedidoId,
      qtde_recebida: it.qtde_recebida || null,
      data_validade: it.data_validade || null,
    }, { onConflict: 'tarefa_id,pedido_id' })
  }

  const todosConferidos = pedidos.length > 0 &&
    pedidos.every(p => {
      const it = itenState[p.id]
      return it?.qtde_recebida !== undefined && it.qtde_recebida !== ''
    })

  const divergencias = pedidos.filter(p => {
    const it = itenState[p.id]
    if (!it?.qtde_recebida) return false
    return Math.abs(Number(it.qtde_recebida) - Number(p.qtde_pallets)) > 0.001
  })

  async function concluirConferencia() {
    setConcluindo(true)
    await supabase.from('tarefas').update({ status: 'concluida' }).eq('id', tarefaSel.id)
    setConcluindo(false)
    voltarLista()
    loadLista()
  }

  // ─── Anomalia Modal ──────────────────────────────────────────────────────────

  function abrirModalAnomalia() {
    setAnomaliaForm({
      pedido_id: '',
      descricao: '',
      folderKey: crypto.randomUUID(),
      fotos:     [null, null, null],
      fotosUrls: [null, null, null],
      uploading: [false, false, false],
    })
    setShowModal(true)
  }

  async function handleFotoSelect(file, idx) {
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setAnomaliaForm(f => {
      if (!f) return f
      const fotos     = [...f.fotos];     fotos[idx]     = previewUrl
      const uploading = [...f.uploading]; uploading[idx] = true
      return { ...f, fotos, uploading }
    })

    // capture folderKey before async gap
    const folderKey = anomForm?.folderKey
    if (!folderKey) return

    const ext  = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const slot = ['frente', 'lateral', 'fundo'][idx]
    const path = `${tarefaSel.id}/${folderKey}/${slot}.${ext}`

    const { error } = await supabase.storage
      .from('anomalias-fotos')
      .upload(path, file, { upsert: true })

    if (error) {
      setAnomaliaForm(f => {
        if (!f) return f
        const fotos     = [...f.fotos];     fotos[idx]     = null
        const uploading = [...f.uploading]; uploading[idx] = false
        return { ...f, fotos, uploading }
      })
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('anomalias-fotos').getPublicUrl(path)
    setAnomaliaForm(f => {
      if (!f) return f
      const fotosUrls = [...f.fotosUrls]; fotosUrls[idx] = publicUrl
      const uploading = [...f.uploading]; uploading[idx] = false
      return { ...f, fotosUrls, uploading }
    })
  }

  async function salvarAnomalia() {
    if (!anomForm || !anomForm.descricao.trim()) return
    if (!anomForm.fotosUrls.every(u => u !== null)) return
    setSalvandoAno(true)
    const { data, error } = await supabase.from('anomalias').insert({
      tarefa_id:     tarefaSel.id,
      pedido_id:     anomForm.pedido_id || null,
      unidade_id:    tarefaSel.unidade_id,
      conferente_id: profile.id,
      descricao:     anomForm.descricao.trim(),
      fotos:         anomForm.fotosUrls,
    }).select('*, pedido:pedidos(descricao, cod_produto)').single()
    setSalvandoAno(false)
    if (!error && data) {
      setAnomalias(prev => [...prev, data])
      setShowModal(false)
      setAnomaliaForm(null)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  const tarefasFiltradas = filtroStatus
    ? tarefas.filter(t => t.status === filtroStatus)
    : tarefas

  const counts = {
    pendente:     tarefas.filter(t => t.status === 'pendente').length,
    em_andamento: tarefas.filter(t => t.status === 'em_andamento').length,
    concluida:    tarefas.filter(t => t.status === 'concluida').length,
  }

  if (view === 'conferencia' && tarefaSel) {
    return (
      <>
        <ConferenciaView
          tarefa={tarefaSel}
          pedidos={pedidos}
          itenState={itenState}
          anomalias={anomalias}
          loadingConf={loadingConf}
          concluindo={concluindo}
          todosConferidos={todosConferidos}
          divergencias={divergencias}
          onBack={voltarLista}
          onSetField={setItemField}
          onSalvarItem={salvarItem}
          onConcluir={concluirConferencia}
          onAbrirAnomalia={abrirModalAnomalia}
          signOut={signOut}
        />
        {showModal && anomForm && (
          <AnomaliaModal
            form={anomForm}
            pedidos={pedidos}
            fotoRefs={fotoRefs}
            salvando={salvandoAno}
            onClose={() => { setShowModal(false); setAnomaliaForm(null) }}
            onSave={salvarAnomalia}
            onFotoSelect={handleFotoSelect}
            onChange={setAnomaliaForm}
          />
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen bg-[#0B1929] flex flex-col">
      <header className="bg-[#112240] border-b border-[#1E3A5F] px-5 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
            <span className="text-orange-400 text-xs font-black select-none">CB</span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Tarefas de Conferência</p>
            <p className="text-slate-600 text-[11px] flex items-center gap-1">
              <MapPin size={9} className="text-orange-400" />
              {profile?.unidade?.nome ?? 'COBEB'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadLista} className="text-slate-600 hover:text-orange-400 transition-colors p-1">
            <RefreshCw size={16} />
          </button>
          <button onClick={() => signOut()} className="text-slate-500 hover:text-red-400 transition-colors p-1">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-8">
        <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
          {/* Status pills */}
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {[
              { value: '',             label: 'Todas',        count: tarefas.length },
              { value: 'pendente',     label: 'Pendentes',    count: counts.pendente },
              { value: 'em_andamento', label: 'Em Andamento', count: counts.em_andamento },
              { value: 'concluida',    label: 'Concluídas',   count: counts.concluida },
            ].map(({ value, label, count }) => {
              const active = filtroStatus === value
              return (
                <button key={value} onClick={() => setFiltroStatus(value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                    active
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-transparent border-[#1E3A5F] text-slate-500 hover:border-orange-500/40'
                  }`}>
                  {label}
                  <span className={`text-[10px] ${active ? 'text-white/80' : 'text-slate-600'}`}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Task list */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tarefasFiltradas.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-[#112240] border border-[#1E3A5F] flex items-center justify-center mx-auto mb-4">
                <ClipboardList size={22} className="text-[#1E3A5F]" />
              </div>
              <p className="text-slate-500 text-sm font-medium">Nenhuma tarefa encontrada</p>
              <p className="text-[#1E3A5F] text-xs mt-1">As tarefas aparecem quando um motorista chega na revenda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tarefasFiltradas.map(tarefa => {
                const cfg = STATUS_CFG[tarefa.status] ?? STATUS_CFG.pendente
                return (
                  <div key={tarefa.id} className={`rounded-2xl border overflow-hidden ${cfg.bg} ${cfg.border}`}>
                    <div className="px-4 py-3">
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-white font-semibold text-sm">NF {tarefa.numero_nf}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.border} bg-[#0B1929]/60`}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                          {tarefa.viagem?.motorista?.nome && (
                            <span className="flex items-center gap-1">
                              <Truck size={10} className="text-slate-600" />
                              {tarefa.viagem.motorista.nome}
                              {tarefa.viagem.motorista.tipo && (
                                <span className="text-slate-600 text-[10px]">({tarefa.viagem.motorista.tipo})</span>
                              )}
                            </span>
                          )}
                          {(tarefa.viagem?.carreta?.placa || tarefa.viagem?.cavalo?.placa) && (
                            <>
                              <span className="text-slate-700">·</span>
                              <span className="font-mono text-[11px]">
                                {[tarefa.viagem?.carreta?.placa, tarefa.viagem?.cavalo?.placa].filter(Boolean).join(' / ')}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-600 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            Chegada: {formatTs(tarefa.viagem?.dt_chegada_revenda) ?? formatTs(tarefa.created_at)}
                          </span>
                          {tarefa.viagem?.horario_agendado && (
                            <span>Agend.: {tarefa.viagem.horario_agendado}</span>
                          )}
                        </div>
                      </div>

                      {tarefa.status === 'pendente' && (
                        <button onClick={() => iniciarConferencia(tarefa)} disabled={iniciando === tarefa.id}
                          className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
                          {iniciando === tarefa.id
                            ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            : <><AlertCircle size={13} />Iniciar Conferência</>}
                        </button>
                      )}
                      {tarefa.status === 'em_andamento' && (
                        <button onClick={() => openConferencia(tarefa)}
                          className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
                          <Package size={13} />Continuar Conferência
                        </button>
                      )}
                      {tarefa.status === 'concluida' && (
                        <button onClick={() => openConferencia(tarefa)}
                          className="w-full bg-[#0B1929] border border-green-500/30 hover:border-green-500/60 text-green-400 text-xs font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5">
                          <CheckCircle size={13} />Ver Conferência
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ── ConferenciaView ────────────────────────────────────────────────────────────

function ConferenciaView({
  tarefa, pedidos, itenState, anomalias,
  loadingConf, concluindo, todosConferidos, divergencias,
  onBack, onSetField, onSalvarItem, onConcluir, onAbrirAnomalia, signOut,
}) {
  const concluida = tarefa.status === 'concluida'

  return (
    <div className="min-h-screen bg-[#0B1929] flex flex-col">
      {/* Header */}
      <header className="bg-[#112240] border-b border-[#1E3A5F] px-4 py-3 shrink-0">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors p-1 -ml-1">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">Conferência — NF {tarefa.numero_nf}</p>
            <p className="text-slate-600 text-[11px] truncate">
              {tarefa.viagem?.motorista?.nome ?? 'Motorista'}
              {tarefa.viagem?.carreta?.placa && ` · ${tarefa.viagem.carreta.placa}`}
              {tarefa.viagem?.cavalo?.placa  && ` / ${tarefa.viagem.cavalo.placa}`}
            </p>
          </div>
          <button onClick={() => signOut()} className="text-slate-600 hover:text-red-400 transition-colors p-1">
            <LogOut size={16} />
          </button>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-600 flex-wrap">
          <span className="flex items-center gap-1">
            <Clock size={9} />
            Chegada: {formatTs(tarefa.viagem?.dt_chegada_revenda) ?? formatTs(tarefa.created_at)}
          </span>
          {tarefa.viagem?.horario_agendado && <span>Agend.: {tarefa.viagem.horario_agendado}</span>}
          {concluida && (
            <span className="text-green-400 flex items-center gap-1">
              <CheckCircle size={9} />Concluída
            </span>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 overflow-y-auto">
        {loadingConf ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="max-w-lg mx-auto px-4 pt-5 pb-32 space-y-6">

            {/* Summary strip */}
            <div className="bg-[#112240] rounded-2xl border border-[#1E3A5F] px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500 flex items-center gap-2">
                <Package size={13} className="text-orange-400" />
                <span className="text-white font-semibold">{pedidos.length}</span> produto(s)
              </span>
              {divergencias.length > 0 && (
                <span className="text-[11px] text-orange-400 flex items-center gap-1.5">
                  <AlertTriangle size={12} />{divergencias.length} divergência(s)
                </span>
              )}
            </div>

            {/* Products */}
            <section>
              <p className="text-[11px] text-slate-600 font-semibold uppercase tracking-widest mb-3 px-1">
                Produtos a Conferir
              </p>
              <div className="space-y-3">
                {pedidos.map(pedido => {
                  const it       = itenState[pedido.id] ?? {}
                  const rec      = it.qtde_recebida
                  const cxRec    = rec ? calcCaixas(rec, pedido) : null
                  const hasDiverg = rec !== undefined && rec !== '' &&
                    Math.abs(Number(rec) - Number(pedido.qtde_pallets)) > 0.001

                  return (
                    <div key={pedido.id}
                      className={`rounded-2xl border overflow-hidden bg-[#112240] ${hasDiverg ? 'border-orange-500/50' : 'border-[#1E3A5F]'}`}>
                      {/* Product header */}
                      <div className="px-4 pt-3 pb-2.5 border-b border-[#1E3A5F]/60">
                        <div className="flex items-start gap-2">
                          {pedido.curva && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none shrink-0 mt-0.5 ${
                              pedido.curva === 'A' ? 'bg-orange-500/20 text-orange-400' :
                              pedido.curva === 'B' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-[#1E3A5F]/50 text-slate-500'
                            }`}>{pedido.curva}</span>
                          )}
                          <div className="min-w-0">
                            <p className="text-white text-xs font-medium leading-snug">{pedido.descricao}</p>
                            <p className="text-slate-600 text-[10px] font-mono mt-0.5">
                              {pedido.cod_produto}{pedido.embalagem ? ` · ${pedido.embalagem}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Quantities */}
                      <div className="px-4 py-3 space-y-2.5">
                        {/* Esperado */}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600 text-[11px]">Esperado</span>
                          <span className="text-xs">
                            <span className="text-white font-semibold">
                              {Number(pedido.qtde_pallets).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                            </span>
                            <span className="text-slate-500"> plt · </span>
                            <span className="text-slate-400">
                              {Number(pedido.qtde_skus).toLocaleString('pt-BR')} cx
                            </span>
                          </span>
                        </div>

                        {/* Recebido */}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-600 text-[11px] shrink-0">Recebido</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              placeholder="0"
                              disabled={concluida}
                              value={rec ?? ''}
                              onChange={e => onSetField(pedido.id, 'qtde_recebida', e.target.value)}
                              onBlur={() => onSalvarItem(pedido.id)}
                              className={`w-20 text-right bg-[#0B1929] border rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors ${
                                hasDiverg ? 'border-orange-500/60' : 'border-[#1E3A5F]'
                              } disabled:opacity-50 disabled:cursor-default`}
                            />
                            <span className="text-slate-600 text-[11px] shrink-0">plt</span>
                            {cxRec !== null && (
                              <span className="text-slate-500 text-[10px] whitespace-nowrap">
                                = {cxRec.toLocaleString('pt-BR')} cx
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Validade */}
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-slate-600 text-[11px] shrink-0">Validade</span>
                          <input
                            type="date"
                            disabled={concluida}
                            value={it.data_validade ?? ''}
                            onChange={e => onSetField(pedido.id, 'data_validade', e.target.value)}
                            onBlur={() => onSalvarItem(pedido.id)}
                            className="bg-[#0B1929] border border-[#1E3A5F] rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors disabled:opacity-50 disabled:cursor-default"
                          />
                        </div>

                        {/* Divergence alert */}
                        {hasDiverg && (
                          <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl px-3 py-2">
                            <AlertTriangle size={11} className="text-orange-400 shrink-0" />
                            <p className="text-orange-400 text-[10px] flex-1">
                              Esperado {Number(pedido.qtde_pallets).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} plt,
                              recebido {Number(rec).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} plt
                            </p>
                            {!concluida && (
                              <button onClick={onAbrirAnomalia}
                                className="text-[10px] text-orange-400 font-semibold underline whitespace-nowrap shrink-0">
                                Registrar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Anomalias */}
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-[11px] text-slate-600 font-semibold uppercase tracking-widest">
                  Anomalias{anomalias.length > 0 ? ` (${anomalias.length})` : ''}
                </p>
                {!concluida && (
                  <button onClick={onAbrirAnomalia}
                    className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 font-semibold transition-colors">
                    <Plus size={12} />Nova Anomalia
                  </button>
                )}
              </div>

              {anomalias.length === 0 ? (
                <div className="bg-[#112240] rounded-2xl border border-[#1E3A5F] px-4 py-5 text-center">
                  <p className="text-slate-600 text-xs">Nenhuma anomalia registrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {anomalias.map(ano => (
                    <div key={ano.id} className="bg-[#112240] rounded-2xl border border-orange-500/20 overflow-hidden">
                      <div className="px-4 py-3">
                        {ano.pedido && (
                          <p className="text-slate-500 text-[10px] mb-1 font-mono">
                            {ano.pedido.cod_produto} — {ano.pedido.descricao}
                          </p>
                        )}
                        <p className="text-white text-xs">{ano.descricao}</p>
                        <p className="text-slate-600 text-[10px] mt-1">{formatTs(ano.created_at)}</p>
                      </div>
                      {ano.fotos?.length > 0 && (
                        <div className="flex gap-2 px-4 pb-3">
                          {ano.fotos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                              className="w-16 h-16 rounded-xl overflow-hidden border border-[#1E3A5F] shrink-0 hover:border-orange-500/40 transition-colors">
                              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      {!concluida && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#112240] border-t border-[#1E3A5F] px-4 py-3 z-30">
          <div className="max-w-lg mx-auto">
            {!todosConferidos && (
              <p className="text-slate-600 text-[10px] text-center mb-2">
                Preencha a quantidade recebida de todos os produtos para concluir
              </p>
            )}
            <button
              onClick={onConcluir}
              disabled={!todosConferidos || concluindo}
              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              {concluindo
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <><CheckCircle size={16} />Concluir Conferência</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AnomaliaModal ─────────────────────────────────────────────────────────────

function AnomaliaModal({ form, pedidos, fotoRefs, salvando, onClose, onSave, onFotoSelect, onChange }) {
  const canSave = form.descricao.trim() && form.fotosUrls.every(u => u !== null) && !salvando

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[#112240] rounded-t-3xl border-t border-[#1E3A5F] px-5 pt-4 pb-8 max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1 bg-[#1E3A5F] rounded-full mx-auto mb-4" />

        <div className="flex items-center justify-between mb-5">
          <p className="text-white font-semibold text-sm">Nova Anomalia</p>
          <button onClick={onClose} className="text-slate-600 hover:text-white p-1 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Product selector */}
          <div>
            <label className="text-slate-600 text-[11px] font-semibold uppercase tracking-widest block mb-2">Produto</label>
            <select
              value={form.pedido_id}
              onChange={e => onChange(f => ({ ...f, pedido_id: e.target.value }))}
              className="w-full bg-[#0B1929] border border-[#1E3A5F] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500 transition-colors"
            >
              <option value="">— Selecione (opcional) —</option>
              {pedidos.map(p => (
                <option key={p.id} value={p.id}>{p.cod_produto} — {p.descricao}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-slate-600 text-[11px] font-semibold uppercase tracking-widest block mb-2">
              Problema <span className="text-orange-400">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Descreva o problema encontrado..."
              value={form.descricao}
              onChange={e => onChange(f => ({ ...f, descricao: e.target.value }))}
              className="w-full bg-[#0B1929] border border-[#1E3A5F] rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500 transition-colors resize-none"
            />
          </div>

          {/* Photos */}
          <div>
            <label className="text-slate-600 text-[11px] font-semibold uppercase tracking-widest block mb-2">
              Fotos <span className="text-orange-400">*</span>
              <span className="text-slate-700 ml-1.5 normal-case tracking-normal font-normal">frente · lateral · fundo</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['Frente', 'Lateral', 'Fundo'].map((label, idx) => {
                const preview  = form.fotos[idx]
                const uploaded = form.fotosUrls[idx]
                const loading  = form.uploading[idx]

                return (
                  <div key={idx}>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={fotoRefs[idx]}
                      className="hidden"
                      onChange={e => e.target.files[0] && onFotoSelect(e.target.files[0], idx)}
                    />
                    <button
                      type="button"
                      onClick={() => fotoRefs[idx].current?.click()}
                      className={`w-full aspect-square rounded-2xl border-2 flex flex-col items-center justify-center overflow-hidden relative transition-colors ${
                        uploaded
                          ? 'border-green-500/50'
                          : preview
                          ? 'border-orange-500/40'
                          : 'border-[#1E3A5F] hover:border-orange-500/40'
                      }`}
                    >
                      {preview ? (
                        <>
                          <img src={preview} alt={label} className="w-full h-full object-cover" />
                          {loading && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            </div>
                          )}
                          {uploaded && !loading && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                              <CheckCircle size={11} className="text-white" />
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 py-4">
                          <Camera size={20} className="text-slate-600" />
                          <span className="text-[10px] text-slate-600">{label}</span>
                        </div>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
            {!form.fotosUrls.every(u => u !== null) && (
              <p className="text-slate-600 text-[10px] mt-2 text-center">
                {form.fotosUrls.filter(u => u !== null).length} de 3 fotos enviadas
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 bg-[#0B1929] border border-[#1E3A5F] text-slate-400 text-sm font-semibold py-3 rounded-2xl transition-colors">
              Cancelar
            </button>
            <button onClick={onSave} disabled={!canSave}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2">
              {salvando
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : 'Salvar Anomalia'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
