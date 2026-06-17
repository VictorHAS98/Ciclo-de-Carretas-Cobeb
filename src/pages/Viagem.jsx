import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Truck, ChevronLeft, ChevronRight, Plus, Trash2,
  CheckCircle, Clock, MapPin, Factory, Home, Search,
  AlertCircle, WifiOff, RefreshCw, LogOut, Package,
  Lock, AlertTriangle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  saveOfflineAction, getOfflineQueue, clearOfflineQueue,
  hasOfflineActions, cacheViagem, getCachedViagem,
} from '../lib/offline'

// ── Etapas ────────────────────────────────────────────────────────────────────

const ETAPAS = [
  { key: 'saida_revenda',   label: 'Saída da Revenda',   field: 'dt_saida_revenda',   nextStatus: 'em_transito',            Icon: MapPin,      requireNF: false, closeCycle: false },
  { key: 'chegada_fabrica', label: 'Chegada na Fábrica', field: 'dt_chegada_fabrica', nextStatus: 'na_fabrica',             Icon: Factory,     requireNF: false, closeCycle: false },
  { key: 'saida_fabrica',   label: 'Saída da Fábrica',   field: 'dt_saida_fabrica',   nextStatus: 'retornando',             Icon: Truck,       requireNF: false, closeCycle: false },
  { key: 'chegada_revenda', label: 'Chegada na Revenda', field: 'dt_chegada_revenda', nextStatus: 'aguardando_conferencia', Icon: Home,        requireNF: true,  closeCycle: false },
  { key: 'saida_entrega',   label: 'Saída após Entrega', field: 'dt_saida_entrega',   nextStatus: 'concluida',              Icon: CheckCircle, requireNF: false, closeCycle: true  },
]

function formatTs(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function diffHHMM(start, end) {
  if (!start || !end) return '—'
  const ms = new Date(end) - new Date(start)
  if (ms <= 0) return '00:00'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Viagem() {
  const { profile, signOut } = useAuth()

  const [view, setView]               = useState('loading')
  const [viagemAtiva, setViagemAtiva] = useState(null)
  const [pedidosDaViagem, setPedidosDaViagem] = useState([])

  const [carretas, setCarretas] = useState([])
  const [cavalos,  setCavalos]  = useState([])
  const [unidades, setUnidades] = useState([])

  // wizard
  const [step, setStep]                       = useState(1)
  const [carreta, setCarreta]                 = useState(null)
  const [cavalo, setCavalo]                   = useState(null)
  const [pedidosAdicionados, setPedidos]      = useState([])
  const [unidadeDescarga, setUnidadeDescarga] = useState(null)
  const [horarioAgendado, setHorario]         = useState('')
  const [searchNum, setSearchNum]             = useState('')
  const [searching, setSearching]             = useState(false)
  const [searchResult, setSearchResult]       = useState(null)
  const [iniciando, setIniciando]             = useState(false)

  // stages
  const [registrando, setRegistrando] = useState(false)
  const [showNF, setShowNF]           = useState(false)
  const [numeroNF, setNumeroNF]       = useState('')

  // módulo 6
  const [tarefaStatus, setTarefaStatus] = useState(null) // null | 'pendente' | 'em_andamento' | 'concluida'
  const [resumoData,   setResumoData]   = useState(null)

  // offline
  const [isOnline, setIsOnline]       = useState(navigator.onLine)
  const [pendingSync, setPendingSync] = useState(hasOfflineActions)
  const [syncing, setSyncing]         = useState(false)

  // ── lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const on  = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => { init() }, [])

  // Polling: enquanto motorista aguarda conferência, verifica a cada 30s
  useEffect(() => {
    if (view !== 'active' || viagemAtiva?.status !== 'aguardando_conferencia') return
    const id = viagemAtiva.id
    async function check() {
      const { data } = await supabase.from('tarefas').select('status').eq('viagem_id', id).maybeSingle()
      if (data?.status) setTarefaStatus(data.status)
    }
    check()
    const timer = setInterval(check, 30000)
    return () => clearInterval(timer)
  }, [view, viagemAtiva?.id, viagemAtiva?.status])

  async function init() {
    const [{ data: c }, { data: ca }, { data: u }, { data: v }] = await Promise.all([
      supabase.from('carretas').select('*').eq('ativo', true).order('placa'),
      supabase.from('cavalos').select('*').eq('ativo', true).order('placa'),
      supabase.from('unidades').select('*').order('nome'),
      supabase.from('viagens')
        .select('*, unidade:unidades(*), carreta:carretas(*), cavalo:cavalos(*)')
        .eq('motorista_id', profile.id)
        .neq('status', 'concluida')
        .maybeSingle(),
    ])
    setCarretas(c ?? [])
    setCavalos(ca ?? [])
    setUnidades(u ?? [])

    if (v) {
      setViagemAtiva(v); cacheViagem(v)
      const { data: peds } = await supabase.from('pedidos').select('*').eq('viagem_id', v.id)
      setPedidosDaViagem(peds ?? [])
      setView('active')
    } else {
      const cached = getCachedViagem()
      if (cached && !navigator.onLine) { setViagemAtiva(cached); setView('active') }
      else setView('wizard')
    }
  }

  // ── auto-set unidade de descarga ──────────────────────────────────────────

  const unidadesNaViagem = useMemo(() => {
    const ids = [...new Set(pedidosAdicionados.map(p => p.unidade_id).filter(Boolean))]
    return unidades.filter(u => ids.includes(u.id))
  }, [pedidosAdicionados, unidades])

  useEffect(() => {
    if (unidadesNaViagem.length === 1) setUnidadeDescarga(unidadesNaViagem[0])
    else if (unidadesNaViagem.length > 1) setUnidadeDescarga(null)
  }, [unidadesNaViagem])

  // ── wizard: buscar pedido ─────────────────────────────────────────────────

  async function buscarPedido() {
    const num = searchNum.trim()
    if (!num) return
    setSearching(true); setSearchResult(null)

    const { data: rows } = await supabase
      .from('pedidos')
      .select('*, unidade:unidades(id, nome, codigo, cidade)')
      .eq('numero_pedido', Number(num))

    setSearching(false)

    if (!rows?.length) { setSearchResult({ error: 'Pedido não encontrado na base importada.' }); return }
    if (rows.some(r => r.viagem_id)) { setSearchResult({ error: 'Este pedido já está vinculado a outra viagem.' }); return }
    if (pedidosAdicionados.some(p => p.numero_pedido === rows[0].numero_pedido)) { setSearchResult({ error: 'Este pedido já foi adicionado.' }); return }

    setSearchResult({
      ok: {
        numero_pedido: rows[0].numero_pedido,
        unidade_id:    rows[0].unidade_id,
        unidade:       rows[0].unidade,
        fabrica:       rows[0].fabrica,
        itens:         rows,
        total_pallets: rows.reduce((s, r) => s + (Number(r.qtde_pallets) || 0), 0),
        total_skus:    rows.reduce((s, r) => s + (Number(r.qtde_skus) || 0), 0),
      }
    })
  }

  function adicionarPedido() {
    if (!searchResult?.ok) return
    setPedidos(prev => [...prev, searchResult.ok])
    setSearchNum(''); setSearchResult(null)
  }

  // ── iniciar viagem ────────────────────────────────────────────────────────

  async function iniciarViagem() {
    if (!carreta || !cavalo || !pedidosAdicionados.length || !unidadeDescarga) return
    setIniciando(true)

    const { data: viagem, error } = await supabase
      .from('viagens')
      .insert({
        motorista_id:        profile.id,
        carreta_id:          carreta.id,
        cavalo_id:           cavalo.id,
        unidade_descarga_id: unidadeDescarga.id,
        horario_agendado:    horarioAgendado || null,
      })
      .select('*, unidade:unidades(*), carreta:carretas(*), cavalo:cavalos(*)')
      .single()

    if (error) { setIniciando(false); return }

    await supabase.rpc('vincular_pedidos_viagem', {
      p_viagem_id:      viagem.id,
      p_numeros_pedido: pedidosAdicionados.map(p => p.numero_pedido),
    })

    cacheViagem(viagem)
    setViagemAtiva(viagem)
    setPedidosDaViagem(pedidosAdicionados.flatMap(p => p.itens))
    resetWizard()
    setView('active')
    setIniciando(false)
  }

  // ── verificar tarefa (manual) ─────────────────────────────────────────────

  async function verificarTarefa() {
    if (!viagemAtiva?.id) return
    const { data } = await supabase.from('tarefas').select('status').eq('viagem_id', viagemAtiva.id).maybeSingle()
    if (data?.status) setTarefaStatus(data.status)
  }

  // ── registrar etapa ───────────────────────────────────────────────────────

  async function registrarEtapa(etapa, nf) {
    const now    = new Date().toISOString()
    const updates = { [etapa.field]: now, status: etapa.nextStatus }
    if (nf) updates.numero_nf = nf
    const updated = { ...viagemAtiva, ...updates }

    const tryDB = async () => {
      const { error } = await supabase.from('viagens').update(updates).eq('id', viagemAtiva.id)
      return !error
    }

    if (isOnline && await tryDB()) {
      setViagemAtiva(updated); cacheViagem(updated)
    } else {
      saveOfflineAction({ type: 'UPDATE_VIAGEM', viagem_id: viagemAtiva.id, updates })
      setViagemAtiva(updated); cacheViagem(updated); setPendingSync(true)
    }

    if (etapa.requireNF) {
      const tarefa = { viagem_id: viagemAtiva.id, unidade_id: viagemAtiva.unidade_descarga_id, numero_nf: nf }
      if (isOnline) {
        const { error: tarefaErr } = await supabase.from('tarefas').insert(tarefa)
        if (tarefaErr) {
          console.error('Erro ao criar tarefa:', tarefaErr)
          alert('Aviso: a tarefa de conferência não foi gerada (' + tarefaErr.message + '). Contate o administrador.')
        }
      } else {
        saveOfflineAction({ type: 'INSERT_TAREFA', tarefa })
      }
    }

    if (etapa.closeCycle) {
      // Busca resumo antes de limpar o estado
      const { data: stats } = await supabase.rpc('get_resumo_viagem', { p_viagem_id: viagemAtiva.id })
      setResumoData({
        viagem: updated,
        stats: stats?.[0] ?? { paletes_esperados: 0, paletes_recebidos: 0, total_anomalias: 0 },
      })
      cacheViagem(null)
      setViagemAtiva(null); setPedidosDaViagem([])
      setTarefaStatus(null)
      setView('resumo')
    }
  }

  function resetWizard() {
    setStep(1); setCarreta(null); setCavalo(null)
    setPedidos([]); setUnidadeDescarga(null); setHorario('')
    setSearchNum(''); setSearchResult(null)
  }

  function iniciarNovaViagem() {
    setResumoData(null)
    resetWizard()
    setView('wizard')
  }

  // ── sync offline ──────────────────────────────────────────────────────────

  async function syncOffline() {
    setSyncing(true)
    try {
      for (const action of getOfflineQueue()) {
        if (action.type === 'UPDATE_VIAGEM')
          await supabase.from('viagens').update(action.updates).eq('id', action.viagem_id)
        else if (action.type === 'INSERT_TAREFA')
          await supabase.from('tarefas').insert(action.tarefa)
      }
      clearOfflineQueue(); setPendingSync(false)
    } finally { setSyncing(false) }
  }

  // ── render ────────────────────────────────────────────────────────────────

  if (view === 'loading') return (
    <div className="min-h-screen bg-[#EBF5FF] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-cobeb-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (view === 'resumo' && resumoData) {
    return <ResumoViagem resumoData={resumoData} profile={profile} onNovaViagem={iniciarNovaViagem} signOut={signOut} />
  }

  const headerTitle = view === 'active'
    ? viagemAtiva?.status === 'aguardando_conferencia'
      ? 'Aguardando Conferência'
      : 'Viagem em Andamento'
    : 'Nova Viagem'

  return (
    <div className="min-h-screen bg-[#EBF5FF] flex flex-col">
      <header className="bg-cobeb-navy border-b border-blue-800 px-5 py-3.5 flex items-center justify-between shrink-0 shadow-md shadow-cobeb-navy/20">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logos/logo-cobeb-transparent.png`}
            alt="COBEB"
            className="h-9 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)', opacity: 0.92 }}
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <div>
            <p className="text-white text-sm font-semibold leading-tight">{headerTitle}</p>
            <p className="text-blue-300/60 text-[10px] font-medium">{profile?.nome}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!isOnline && <WifiOff size={16} className="text-yellow-300" />}
          <button onClick={async () => { await signOut() }} className="text-blue-300/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {!isOnline && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center gap-2">
          <WifiOff size={13} className="text-yellow-400 shrink-0" />
          <p className="text-yellow-400 text-xs">Sem conexão — ações salvas localmente</p>
        </div>
      )}
      {pendingSync && isOnline && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 flex items-center justify-between">
          <p className="text-blue-400 text-xs">Ações pendentes de sincronização</p>
          <button onClick={syncOffline} disabled={syncing} className="flex items-center gap-1.5 text-blue-400 text-xs font-semibold disabled:opacity-50">
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-10">
        {view === 'wizard'
          ? <Wizard
              step={step} setStep={setStep}
              carretas={carretas} cavalos={cavalos} unidades={unidades}
              carreta={carreta} setCarreta={setCarreta}
              cavalo={cavalo} setCavalo={setCavalo}
              pedidosAdicionados={pedidosAdicionados}
              unidadesNaViagem={unidadesNaViagem}
              unidadeDescarga={unidadeDescarga} setUnidadeDescarga={setUnidadeDescarga}
              horarioAgendado={horarioAgendado} setHorario={setHorario}
              searchNum={searchNum} setSearchNum={setSearchNum}
              searching={searching} searchResult={searchResult}
              buscarPedido={buscarPedido} adicionarPedido={adicionarPedido}
              removerPedido={n => setPedidos(prev => prev.filter(p => p.numero_pedido !== n))}
              iniciando={iniciando} iniciarViagem={iniciarViagem}
            />
          : <ViagemAtiva
              viagem={viagemAtiva}
              pedidos={pedidosDaViagem}
              tarefaStatus={tarefaStatus}
              onVerificarTarefa={verificarTarefa}
              showNF={showNF} setShowNF={setShowNF}
              numeroNF={numeroNF} setNumeroNF={setNumeroNF}
              registrando={registrando} setRegistrando={setRegistrando}
              registrarEtapa={registrarEtapa}
            />
        }
      </main>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Wizard
// ─────────────────────────────────────────────────────────────────────────────

function Wizard({ step, setStep, carretas, cavalos, carreta, setCarreta, cavalo, setCavalo,
  pedidosAdicionados, unidadesNaViagem, unidadeDescarga, setUnidadeDescarga,
  horarioAgendado, setHorario, searchNum, setSearchNum, searching, searchResult,
  buscarPedido, adicionarPedido, removerPedido, iniciando, iniciarViagem }) {

  const labels = ['Carreta', 'Cavalo', 'Pedidos', 'Confirmar']
  const canNext = [!!carreta, !!cavalo, pedidosAdicionados.length > 0 && !!unidadeDescarga, false]

  return (
    <div className="max-w-lg mx-auto px-4 pt-5">
      {/* Step indicator */}
      <div className="flex items-center justify-center mb-6">
        {labels.map((label, i) => {
          const n = i + 1; const done = n < step; const active = n === step
          return (
            <div key={n} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  done ? 'bg-cobeb-navy text-white' : active ? 'bg-cobeb-navy/10 text-cobeb-yellow ring-2 ring-cobeb-yellow' : 'bg-white text-slate-500'
                }`}>
                  {done ? <CheckCircle size={14} /> : n}
                </div>
                <span className={`text-[10px] font-medium ${active ? 'text-cobeb-yellow' : done ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
              </div>
              {i < 3 && <div className={`w-7 h-px mb-5 mx-1 ${n < step ? 'bg-cobeb-navy' : 'bg-cobeb-border'}`} />}
            </div>
          )
        })}
      </div>

      {step === 1 && <StepSelecionar titulo="Selecionar Carreta" itens={carretas} selecionado={carreta} onSelecionar={setCarreta}
        onProximo={() => setStep(2)} podeProximo={canNext[0]} />}
      {step === 2 && <StepSelecionar titulo="Selecionar Cavalo" itens={cavalos} selecionado={cavalo} onSelecionar={setCavalo}
        onVoltar={() => setStep(1)} onProximo={() => setStep(3)} podeProximo={canNext[1]} />}
      {step === 3 && <StepPedidos
        pedidosAdicionados={pedidosAdicionados} unidadesNaViagem={unidadesNaViagem}
        unidadeDescarga={unidadeDescarga} setUnidadeDescarga={setUnidadeDescarga}
        horarioAgendado={horarioAgendado} setHorario={setHorario}
        searchNum={searchNum} setSearchNum={setSearchNum} searching={searching} searchResult={searchResult}
        buscarPedido={buscarPedido} adicionarPedido={adicionarPedido} removerPedido={removerPedido}
        onVoltar={() => setStep(2)} onProximo={() => setStep(4)} podeProximo={canNext[2]} />}
      {step === 4 && <StepConfirmar
        carreta={carreta} cavalo={cavalo} pedidosAdicionados={pedidosAdicionados}
        unidadeDescarga={unidadeDescarga} horarioAgendado={horarioAgendado}
        onVoltar={() => setStep(3)} onConfirmar={iniciarViagem} iniciando={iniciando} />}
    </div>
  )
}

function StepSelecionar({ titulo, itens, selecionado, onSelecionar, onVoltar, onProximo, podeProximo }) {
  return (
    <div className="space-y-4">
      <h2 className="text-cobeb-text font-semibold text-base">{titulo}</h2>
      <div className="space-y-2">
        {itens.map(item => {
          const selected = selecionado?.id === item.id
          return (
            <button key={item.id} onClick={() => onSelecionar(item)}
              className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl border transition-all ${
                selected ? 'bg-cobeb-navy/10 border-cobeb-blue' : 'bg-white border-cobeb-border hover:border-cobeb-blue/40'
              }`}>
              <div className="flex items-center gap-3">
                <Truck size={18} className={selected ? 'text-cobeb-yellow' : 'text-slate-500'} />
                <div className="text-left">
                  <p className={`font-mono font-semibold text-sm ${selected ? 'text-cobeb-navy' : 'text-cobeb-text'}`}>{item.placa}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{item.tipo}</p>
                </div>
              </div>
              {selected && <CheckCircle size={18} className="text-cobeb-yellow" />}
            </button>
          )
        })}
        {!itens.length && <p className="text-slate-500 text-sm text-center py-8">Nenhum cadastrado no sistema</p>}
      </div>
      <BotoesPasso onVoltar={onVoltar} onProximo={onProximo} podeProximo={podeProximo} />
    </div>
  )
}

function StepPedidos({ pedidosAdicionados, unidadesNaViagem, unidadeDescarga, setUnidadeDescarga,
  horarioAgendado, setHorario, searchNum, setSearchNum, searching, searchResult,
  buscarPedido, adicionarPedido, removerPedido, onVoltar, onProximo, podeProximo }) {

  const totalPallets = pedidosAdicionados.reduce((s, p) => s + p.total_pallets, 0)
  const totalSkus    = pedidosAdicionados.reduce((s, p) => s + p.total_skus,    0)

  return (
    <div className="space-y-4">
      <h2 className="text-cobeb-text font-semibold text-base">Pedidos</h2>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-cobeb-border overflow-hidden">
        <div className="flex gap-2 p-3">
          <input value={searchNum} onChange={e => setSearchNum(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscarPedido()}
            placeholder="Número do pedido..." inputMode="numeric"
            className="flex-1 bg-[#EBF5FF] border border-cobeb-border rounded-xl px-4 py-2.5 text-cobeb-text text-sm placeholder-slate-400 focus:outline-none focus:border-cobeb-blue" />
          <button onClick={buscarPedido} disabled={searching || !searchNum.trim()}
            className="bg-cobeb-navy hover:bg-cobeb-blue disabled:opacity-50 text-white px-4 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2">
            {searching
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Search size={16} />}
            Buscar
          </button>
        </div>

        {searchResult?.error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 mx-3 mb-3 rounded-xl px-4 py-3">
            <AlertCircle size={13} className="shrink-0" />{searchResult.error}
          </div>
        )}
        {searchResult?.ok && (
          <div className="mx-3 mb-3 bg-[#EBF5FF] rounded-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-cobeb-yellow font-mono text-sm font-semibold">#{searchResult.ok.numero_pedido}</p>
                <p className="text-slate-400 text-xs mt-0.5">{searchResult.ok.unidade?.codigo} · {searchResult.ok.fabrica}</p>
                <p className="text-slate-500 text-xs">{searchResult.ok.itens.length} produtos · {searchResult.ok.total_pallets.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pallets</p>
              </div>
              <button onClick={adicionarPedido}
                className="bg-cobeb-navy hover:bg-cobeb-blue text-white text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors shrink-0">
                <Plus size={13} />Adicionar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Added pedidos */}
      {pedidosAdicionados.length > 0 && (
        <div className="space-y-2">
          {pedidosAdicionados.map(p => (
            <div key={p.numero_pedido} className="bg-white rounded-2xl border border-cobeb-border px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-cobeb-yellow font-mono text-sm font-semibold">#{p.numero_pedido}</p>
                <p className="text-slate-500 text-xs mt-0.5">{p.unidade?.codigo ?? '—'} · {p.total_pallets.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pal · {p.total_skus.toLocaleString('pt-BR')} cx</p>
              </div>
              <button onClick={() => removerPedido(p.numero_pedido)} className="text-slate-500 hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <p className="text-right text-xs text-slate-500">
            Total: <span className="text-cobeb-text font-semibold">{totalPallets.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span> pallets · <span className="text-cobeb-text font-semibold">{totalSkus.toLocaleString('pt-BR')}</span> caixas
          </p>
        </div>
      )}

      {/* Unidade de descarga — múltiplas unidades */}
      {unidadesNaViagem.length > 1 && (
        <div className="bg-white rounded-2xl border border-cobeb-blue/40 p-4 space-y-3">
          <p className="text-cobeb-yellow text-sm font-semibold">Para qual unidade vai descarregar?</p>
          {unidadesNaViagem.map(u => (
            <button key={u.id} onClick={() => setUnidadeDescarga(u)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                unidadeDescarga?.id === u.id ? 'bg-cobeb-navy/10 border-cobeb-blue text-white' : 'bg-[#EBF5FF] border-cobeb-border text-slate-400'
              }`}>
              <div className="flex items-center gap-2">
                <MapPin size={14} className={unidadeDescarga?.id === u.id ? 'text-cobeb-yellow' : 'text-slate-500'} />
                <span className="text-sm font-medium">{u.nome} — {u.cidade}</span>
              </div>
              {unidadeDescarga?.id === u.id && <CheckCircle size={15} className="text-cobeb-yellow" />}
            </button>
          ))}
        </div>
      )}

      {/* Unidade auto-selecionada */}
      {unidadesNaViagem.length === 1 && unidadeDescarga && (
        <div className="flex items-center gap-2 bg-white rounded-xl border border-cobeb-border px-4 py-2.5">
          <MapPin size={14} className="text-cobeb-yellow shrink-0" />
          <p className="text-slate-400 text-xs">Destino: <span className="text-cobeb-text font-semibold">{unidadeDescarga.nome} — {unidadeDescarga.cidade}</span></p>
        </div>
      )}

      {/* Horário de carregamento */}
      <div>
        <label className="block text-slate-500 text-[11px] font-semibold uppercase tracking-widest mb-1.5">
          Horário de Carregamento
        </label>
        <input type="time" value={horarioAgendado} onChange={e => setHorario(e.target.value)}
          className="w-full bg-white border border-cobeb-border rounded-xl px-4 py-3 text-cobeb-text text-sm focus:outline-none focus:border-cobeb-blue [color-scheme:light]" />
      </div>

      <BotoesPasso onVoltar={onVoltar} onProximo={onProximo} podeProximo={podeProximo} />
    </div>
  )
}

function StepConfirmar({ carreta, cavalo, pedidosAdicionados, unidadeDescarga, horarioAgendado, onVoltar, onConfirmar, iniciando }) {
  const totalPallets = pedidosAdicionados.reduce((s, p) => s + p.total_pallets, 0)
  const totalSkus    = pedidosAdicionados.reduce((s, p) => s + p.total_skus,    0)
  const allItens     = pedidosAdicionados.flatMap(p => p.itens)

  return (
    <div className="space-y-4">
      <h2 className="text-cobeb-text font-semibold text-base">Confirmar Viagem</h2>

      <div className="bg-white rounded-2xl border border-cobeb-border divide-y divide-cobeb-border">
        <SRow label="Destino"  value={`${unidadeDescarga?.nome} — ${unidadeDescarga?.cidade}`} highlight />
        <SRow label="Carreta"  value={`${carreta?.placa} · ${carreta?.tipo}`} />
        <SRow label="Cavalo"   value={`${cavalo?.placa} · ${cavalo?.tipo}`} />
        <SRow label="Pedidos"  value={pedidosAdicionados.map(p => `#${p.numero_pedido}`).join(' · ')} />
        <SRow label="Total"    value={`${totalPallets.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pallets · ${totalSkus.toLocaleString('pt-BR')} caixas`} />
        {horarioAgendado && <SRow label="Hor. Carregamento" value={horarioAgendado} />}
      </div>

      <div className="bg-white rounded-2xl border border-cobeb-border overflow-hidden">
        <div className="px-4 py-3 border-b border-cobeb-border">
          <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest">{allItens.length} produtos</p>
        </div>
        {allItens.slice(0, 5).map(item => (
          <div key={item.id} className="flex items-center justify-between px-4 py-2.5 border-b border-cobeb-border last:border-0">
            <p className="text-cobeb-text text-xs truncate flex-1 mr-4">{item.descricao}</p>
            <p className="text-xs text-slate-500 shrink-0">{Number(item.qtde_pallets).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pal</p>
          </div>
        ))}
        {allItens.length > 5 && <p className="text-slate-500 text-xs text-center py-2">+ {allItens.length - 5} produtos</p>}
      </div>

      <div className="flex gap-3">
        <button onClick={onVoltar} className="flex-1 bg-white border border-cobeb-border text-slate-400 font-semibold py-4 rounded-2xl text-sm flex items-center justify-center gap-2">
          <ChevronLeft size={16} />Voltar
        </button>
        <button onClick={onConfirmar} disabled={iniciando}
          className="flex-1 bg-cobeb-navy hover:bg-cobeb-blue disabled:opacity-50 text-white font-semibold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-colors">
          {iniciando
            ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Iniciando...</>
            : <>Iniciar Viagem<ChevronRight size={16} /></>}
        </button>
      </div>
    </div>
  )
}

function SRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-center gap-4 px-4 py-3">
      <span className="text-slate-500 text-xs shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right ${highlight ? 'text-cobeb-yellow' : 'text-cobeb-text'}`}>{value}</span>
    </div>
  )
}

function BotoesPasso({ onVoltar, onProximo, podeProximo }) {
  return (
    <div className="flex gap-3 pt-2">
      {onVoltar && (
        <button onClick={onVoltar} className="flex-1 bg-white border border-cobeb-border text-slate-400 font-semibold py-4 rounded-2xl text-sm flex items-center justify-center gap-2">
          <ChevronLeft size={16} />Voltar
        </button>
      )}
      <button onClick={onProximo} disabled={!podeProximo}
        className="flex-1 bg-cobeb-navy hover:bg-cobeb-blue disabled:opacity-40 disabled:pointer-events-none text-white font-semibold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-colors">
        Próximo<ChevronRight size={16} />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Viagem Ativa
// ─────────────────────────────────────────────────────────────────────────────

function ViagemAtiva({ viagem, pedidos, tarefaStatus, onVerificarTarefa, showNF, setShowNF, numeroNF, setNumeroNF, registrando, setRegistrando, registrarEtapa }) {
  const numerosUnicos = [...new Set(pedidos.map(p => p.numero_pedido))]
  const totalPallets  = pedidos.reduce((s, p) => s + (Number(p.qtde_pallets) || 0), 0)
  const totalSkus     = pedidos.reduce((s, p) => s + (Number(p.qtde_skus)    || 0), 0)
  const etapaAtualIdx = ETAPAS.findIndex(e => !viagem?.[e.field])

  async function handleEtapa(etapa) {
    if (etapa.requireNF) { setShowNF(true); return }
    setRegistrando(true)
    await registrarEtapa(etapa, null)
    setRegistrando(false)
  }

  async function confirmarNF() {
    if (!numeroNF.trim()) return
    setShowNF(false); setRegistrando(true)
    await registrarEtapa(ETAPAS[3], numeroNF.trim())
    setRegistrando(false); setNumeroNF('')
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
      {/* Trip header */}
      <div className="bg-white rounded-2xl border border-cobeb-blue/30 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-cobeb-yellow shrink-0" />
          <p className="text-cobeb-yellow font-semibold text-sm">{viagem?.unidade?.nome}</p>
          <span className="text-slate-500 text-xs">— {viagem?.unidade?.cidade}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#EBF5FF] rounded-xl px-3 py-2">
            <p className="text-slate-500 text-[10px] uppercase tracking-widest">Carreta</p>
            <p className="text-cobeb-text font-mono font-semibold text-sm mt-0.5">{viagem?.carreta?.placa}</p>
            <p className="text-slate-500 text-[10px]">{viagem?.carreta?.tipo}</p>
          </div>
          <div className="bg-[#EBF5FF] rounded-xl px-3 py-2">
            <p className="text-slate-500 text-[10px] uppercase tracking-widest">Cavalo</p>
            <p className="text-cobeb-text font-mono font-semibold text-sm mt-0.5">{viagem?.cavalo?.placa}</p>
            <p className="text-slate-500 text-[10px]">{viagem?.cavalo?.tipo}</p>
          </div>
        </div>
        <div className="bg-[#EBF5FF] rounded-xl px-3 py-2">
          <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">Pedidos</p>
          <div className="flex flex-wrap gap-2">
            {numerosUnicos.map(n => <span key={n} className="text-cobeb-yellow font-mono text-xs font-semibold">#{n}</span>)}
          </div>
          <p className="text-slate-500 text-[10px] mt-1">
            {totalPallets.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pallets · {totalSkus.toLocaleString('pt-BR')} caixas
            {viagem?.horario_agendado && <> · Hor: {viagem.horario_agendado}</>}
          </p>
        </div>
      </div>

      {/* Banner: aguardando conferência */}
      {viagem?.status === 'aguardando_conferencia' && (
        <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-2xl px-4 py-3">
          <Clock size={14} className="text-blue-400 shrink-0" />
          <p className="text-blue-400 text-xs">
            NF entregue — conferência em andamento na revenda. Registre a saída quando o veículo partir.
          </p>
        </div>
      )}

      {/* Stages */}
      <div className="space-y-2">
        {ETAPAS.map((etapa, i) => {
          const done    = !!viagem?.[etapa.field]
          const current = !done && i === etapaAtualIdx
          const bloqueada = current && etapa.closeCycle && tarefaStatus !== 'concluida'

          if (done) return (
            <div key={etapa.key} className="bg-white rounded-2xl border border-cobeb-border px-4 py-3 flex items-center gap-3">
              <CheckCircle size={18} className="text-green-400 shrink-0" />
              <div>
                <p className="text-cobeb-text text-sm font-medium">{etapa.label}</p>
                <p className="text-slate-500 text-xs mt-0.5">{formatTs(viagem[etapa.field])}</p>
              </div>
            </div>
          )

          if (current && bloqueada) return (
            <div key={etapa.key} className="bg-white rounded-2xl border border-cobeb-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Lock size={15} className="text-slate-500 shrink-0" />
                <p className="text-slate-500 font-semibold text-sm">{etapa.label}</p>
              </div>
              <div className="bg-[#EBF5FF] rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <p className="text-slate-500 text-xs">Aguardando conclusão da conferência na revenda</p>
                <button onClick={onVerificarTarefa}
                  className="text-cobeb-yellow text-xs font-semibold shrink-0 flex items-center gap-1 hover:text-cobeb-blue transition-colors">
                  <RefreshCw size={12} />Verificar
                </button>
              </div>
            </div>
          )

          if (current) return (
            <div key={etapa.key} className="bg-cobeb-navy/10 rounded-2xl border-2 border-cobeb-blue p-4">
              <div className="flex items-center gap-2 mb-4">
                <etapa.Icon size={16} className="text-cobeb-yellow" />
                <p className="text-cobeb-yellow font-semibold text-sm uppercase tracking-wide">{etapa.label}</p>
              </div>
              <button onClick={() => handleEtapa(etapa)} disabled={registrando}
                className="w-full bg-cobeb-navy hover:bg-cobeb-blue disabled:opacity-50 text-white font-bold py-5 rounded-xl text-base transition-colors flex items-center justify-center gap-3">
                {registrando
                  ? <><div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Registrando...</>
                  : <><Clock size={20} />Registrar {etapa.label}</>}
              </button>
            </div>
          )

          return (
            <div key={etapa.key} className="bg-white rounded-2xl border border-cobeb-border px-4 py-3 flex items-center gap-3 opacity-40">
              <div className="w-5 h-5 rounded-full border-2 border-slate-600 shrink-0" />
              <p className="text-slate-500 text-sm">{etapa.label}</p>
            </div>
          )
        })}
      </div>

      {/* Products */}
      {pedidos.length > 0 && (
        <div className="bg-white rounded-2xl border border-cobeb-border overflow-hidden">
          <div className="px-4 py-3 border-b border-cobeb-border flex items-center gap-2">
            <Package size={14} className="text-slate-500" />
            <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">{pedidos.length} produtos da carga</p>
          </div>
          {pedidos.slice(0, 5).map((item, i) => (
            <div key={item.id} className={`flex items-center justify-between px-4 py-2.5 ${i < Math.min(pedidos.length, 5) - 1 ? 'border-b border-cobeb-border' : ''}`}>
              <p className="text-slate-400 text-xs truncate flex-1 mr-3">{item.descricao}</p>
              <p className="text-slate-500 text-xs shrink-0">{Number(item.qtde_pallets).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pal</p>
            </div>
          ))}
          {pedidos.length > 5 && <p className="text-slate-500 text-xs text-center py-2">+ {pedidos.length - 5} produtos</p>}
        </div>
      )}

      {/* NF Modal */}
      {showNF && <NFModal numeroNF={numeroNF} setNumeroNF={setNumeroNF} onConfirmar={confirmarNF} onCancelar={() => { setShowNF(false); setNumeroNF('') }} />}
    </div>
  )
}

// ── NF Modal ──────────────────────────────────────────────────────────────────

function NFModal({ numeroNF, setNumeroNF, onConfirmar, onCancelar }) {
  const ref = useRef(null)
  useEffect(() => { setTimeout(() => ref.current?.focus(), 150) }, [])

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
      <div className="w-full max-w-lg mx-auto bg-white rounded-t-3xl p-6 space-y-5">
        <div className="w-10 h-1 bg-cobeb-border rounded-full mx-auto" />
        <div>
          <p className="text-cobeb-text font-semibold text-base">Chegada na Revenda</p>
          <p className="text-slate-500 text-sm mt-1">Informe o número da Nota Fiscal a entregar</p>
        </div>
        <div>
          <label className="block text-slate-500 text-[11px] font-semibold uppercase tracking-widest mb-1.5">
            Número da NF <span className="text-cobeb-navy">*</span>
          </label>
          <input ref={ref} value={numeroNF} onChange={e => setNumeroNF(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && numeroNF.trim() && onConfirmar()}
            placeholder="Ex: 123456" inputMode="numeric"
            className="w-full bg-[#EBF5FF] border border-cobeb-border rounded-xl px-4 py-3 text-cobeb-text text-sm placeholder-slate-400 focus:outline-none focus:border-cobeb-blue" />
        </div>
        <div className="flex gap-3">
          <button onClick={onCancelar} className="flex-1 bg-[#EBF5FF] border border-cobeb-border text-slate-400 font-semibold py-4 rounded-2xl text-sm">Cancelar</button>
          <button onClick={onConfirmar} disabled={!numeroNF.trim()}
            className="flex-1 bg-cobeb-navy hover:bg-cobeb-blue disabled:opacity-50 text-white font-semibold py-4 rounded-2xl text-sm transition-colors">
            Confirmar Chegada
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumo da Viagem (Módulo 6)
// ─────────────────────────────────────────────────────────────────────────────

function MetricBox({ label, value, highlight }) {
  return (
    <div className={`rounded-2xl border p-3 text-center ${highlight ? 'bg-cobeb-navy/10 border-cobeb-blue/30' : 'bg-white border-cobeb-border'}`}>
      <p className={`text-[10px] mb-1 uppercase tracking-wide ${highlight ? 'text-cobeb-yellow' : 'text-slate-500'}`}>{label}</p>
      <p className={`font-bold text-base font-mono ${highlight ? 'text-cobeb-yellow' : 'text-cobeb-text'}`}>{value}</p>
    </div>
  )
}

function ResumoViagem({ resumoData, profile, onNovaViagem, signOut }) {
  const { viagem, stats } = resumoData

  const tmaFabrica = diffHHMM(viagem.dt_chegada_fabrica, viagem.dt_saida_fabrica)
  const tmaRevenda = diffHHMM(viagem.dt_chegada_revenda, viagem.dt_saida_entrega)
  const tmvIda     = diffHHMM(viagem.dt_saida_revenda,   viagem.dt_chegada_fabrica)
  const tmvVolta   = diffHHMM(viagem.dt_saida_fabrica,   viagem.dt_chegada_revenda)
  const tmvTotal   = diffHHMM(viagem.dt_saida_revenda,   viagem.dt_saida_entrega)

  const paletesEsp = Number(stats.paletes_esperados)
  const paletesRec = Number(stats.paletes_recebidos)
  const diferenca  = paletesRec - paletesEsp

  return (
    <div className="min-h-screen bg-[#EBF5FF] flex flex-col">
      <header className="bg-cobeb-navy border-b border-blue-800 px-5 py-3.5 flex items-center justify-between shrink-0 shadow-md shadow-cobeb-navy/20">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logos/logo-cobeb-transparent.png`}
            alt="COBEB"
            className="h-9 w-auto object-contain" style={{ filter: 'brightness(0) invert(1)', opacity: 0.92 }}
            onError={(e) => { e.target.style.display = 'none' }}
          />
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Resumo da Viagem</p>
            <p className="text-blue-300/60 text-[10px] font-medium">{profile?.nome}</p>
          </div>
        </div>
        <button onClick={async () => { await signOut() }} className="text-blue-300/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
          <LogOut size={18} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-28">
        <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">

          {/* Banner de conclusão */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 text-center">
            <CheckCircle size={36} className="text-green-400 mx-auto mb-2" />
            <p className="text-cobeb-text font-bold text-base">Viagem Concluída!</p>
            <p className="text-slate-500 text-sm mt-1">{viagem.unidade?.nome} — {viagem.unidade?.cidade}</p>
          </div>

          {/* Veículo e motorista */}
          <div className="bg-white rounded-2xl border border-cobeb-border divide-y divide-cobeb-border">
            <SRow label="Motorista" value={`${profile?.nome}${profile?.tipo ? ' · ' + profile.tipo : ''}`} />
            <SRow label="Carreta"   value={`${viagem.carreta?.placa ?? '—'} · ${viagem.carreta?.tipo ?? ''}`} />
            <SRow label="Cavalo"    value={`${viagem.cavalo?.placa ?? '—'} · ${viagem.cavalo?.tipo ?? ''}`} />
            {viagem.numero_nf && <SRow label="NF" value={viagem.numero_nf} />}
          </div>

          {/* Horários */}
          <section>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest mb-2 px-1">Horários</p>
            <div className="bg-white rounded-2xl border border-cobeb-border divide-y divide-cobeb-border">
              <SRow label="Saída da Revenda"   value={formatTs(viagem.dt_saida_revenda)}   />
              <SRow label="Chegada na Fábrica" value={formatTs(viagem.dt_chegada_fabrica)} />
              <SRow label="Saída da Fábrica"   value={formatTs(viagem.dt_saida_fabrica)}   />
              <SRow label="Chegada na Revenda" value={formatTs(viagem.dt_chegada_revenda)} />
              <SRow label="Saída após Entrega" value={formatTs(viagem.dt_saida_entrega)}   />
            </div>
          </section>

          {/* TMA */}
          <section>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest mb-2 px-1">TMA — Tempo de Atendimento</p>
            <div className="grid grid-cols-2 gap-3">
              <MetricBox label="Na Fábrica" value={tmaFabrica} />
              <MetricBox label="Na Revenda" value={tmaRevenda} />
            </div>
          </section>

          {/* TMV */}
          <section>
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest mb-2 px-1">TMV — Tempo de Viagem</p>
            <div className="grid grid-cols-3 gap-3">
              <MetricBox label="Ida"   value={tmvIda}   />
              <MetricBox label="Volta" value={tmvVolta} />
              <MetricBox label="Total" value={tmvTotal} highlight />
            </div>
          </section>

          {/* Paletes */}
          <div className="bg-white rounded-2xl border border-cobeb-border p-4">
            <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest mb-3">Paletes</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-slate-500 text-[10px] mb-1">Esperado</p>
                <p className="text-cobeb-text font-bold text-xl">{paletesEsp.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] mb-1">Recebido</p>
                <p className="text-cobeb-text font-bold text-xl">{paletesRec.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] mb-1">Diferença</p>
                <p className={`font-bold text-xl ${diferenca === 0 ? 'text-green-400' : 'text-cobeb-yellow'}`}>
                  {diferenca > 0 ? '+' : ''}{diferenca.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                </p>
              </div>
            </div>
          </div>

          {/* Anomalias */}
          {stats.total_anomalias > 0 ? (
            <div className="bg-cobeb-navy/10 border border-cobeb-blue/30 rounded-2xl px-4 py-3 flex items-center gap-3">
              <AlertTriangle size={16} className="text-cobeb-yellow shrink-0" />
              <p className="text-cobeb-yellow text-sm">{stats.total_anomalias} anomalia{stats.total_anomalias > 1 ? 's' : ''} registrada{stats.total_anomalias > 1 ? 's' : ''}</p>
            </div>
          ) : (
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl px-4 py-3 flex items-center gap-3">
              <CheckCircle size={14} className="text-green-400 shrink-0" />
              <p className="text-green-400 text-sm">Nenhuma anomalia registrada</p>
            </div>
          )}

        </div>
      </main>

      {/* Footer fixo */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-cobeb-border px-4 py-3 z-30">
        <button onClick={onNovaViagem}
          className="w-full bg-cobeb-navy hover:bg-cobeb-blue text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 transition-colors">
          Iniciar Nova Viagem <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
