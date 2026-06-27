import { useState, useEffect, useRef } from 'react'
import { Forklift, LogOut, ChevronDown, ChevronUp, AlertTriangle, Clock, RefreshCw, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

// ── Configuração de status ────────────────────────────────────────────────────

const STATUS_CFG = {
  iniciada: {
    label:  'Aguardando Saída',
    step:   0,
    border: 'border-l-slate-300',
    badge:  'bg-slate-100 text-slate-500 border-slate-200',
    urgent: false,
  },
  em_transito: {
    label:  'Em Rota p/ Fábrica',
    step:   1,
    border: 'border-l-blue-400',
    badge:  'bg-blue-50 text-blue-500 border-blue-200',
    urgent: false,
  },
  na_fabrica: {
    label:  'Na Fábrica',
    step:   2,
    border: 'border-l-blue-500',
    badge:  'bg-blue-50 text-blue-600 border-blue-200',
    urgent: false,
  },
  retornando: {
    label:  'Retornando',
    step:   3,
    border: 'border-l-yellow-400',
    badge:  'bg-yellow-50 text-yellow-600 border-yellow-200',
    urgent: true,
  },
  aguardando_conferencia: {
    label:  'Chegou',
    step:   4,
    border: 'border-l-green-400',
    badge:  'bg-green-50 text-green-600 border-green-200',
    urgent: false,
  },
}

const STEP_LABELS = ['Saída', 'Em Rota', 'Fábrica', 'Retorno', 'Chegou']

// ── Componente principal ──────────────────────────────────────────────────────

export default function EstoqueRealtime({ adminMode = false }) {
  const { profile, signOut } = useAuth()
  const [viagens,    setViagens]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [expanded,   setExpanded]   = useState(new Set())
  const [lastUpdate, setLastUpdate] = useState(null)
  const channelRef = useRef(null)

  useEffect(() => {
    loadData()

    // Polling a cada 15s para manter painel atualizado
    const timer = setInterval(() => loadData(true), 15000)

    // Supabase Realtime — funciona se a tabela viagens tiver Realtime habilitado
    channelRef.current = supabase
      .channel('painel-viagens')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viagens' }, () => {
        loadData(true)
      })
      .subscribe()

    return () => {
      clearInterval(timer)
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  async function loadData(silent = false) {
    if (!silent) setLoading(true)
    const { data, error } = await supabase.rpc('get_painel_viagens')
    if (!error && data) {
      setViagens(data)
      setLastUpdate(new Date())
    }
    if (!silent) setLoading(false)
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const urgentes = viagens.filter(v => v.status === 'retornando').length

  const conteudo = (
    <>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-2 border-cobeb-navy border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Carregando veículos...</p>
        </div>
      ) : viagens.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="px-4 pt-4 space-y-3 max-w-lg mx-auto">
          <div className="flex items-center justify-between">
            <p className="text-cobeb-text font-semibold text-sm">
              {viagens.length} veículo{viagens.length !== 1 ? 's' : ''} ativo{viagens.length !== 1 ? 's' : ''}
            </p>
            {urgentes > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2.5 py-1 rounded-full">
                <AlertTriangle size={11} />
                {urgentes} retornando
              </span>
            )}
            {lastUpdate && (
              <span className="text-slate-400 text-[10px]">
                {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          {viagens.map(v => (
            <ViagemCard
              key={v.id}
              viagem={v}
              expanded={expanded.has(v.id)}
              onToggle={() => toggleExpand(v.id)}
            />
          ))}
        </div>
      )}
    </>
  )

  if (adminMode) {
    return <div className="pb-6">{conteudo}</div>
  }

  return (
    <div className="min-h-dvh bg-[#EBF5FF] flex flex-col">

      {/* Header */}
      <header className="bg-cobeb-navy px-5 py-3.5 flex items-center justify-between shadow-md shadow-cobeb-navy/20 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src={`${import.meta.env.BASE_URL}logos/logo-cobeb-transparent.png`}
            alt="COBEB"
            className="h-12 w-auto object-contain"
            style={{ filter: 'brightness(0) invert(1)', opacity: 0.92 }}
            onError={e => { e.target.style.display = 'none' }}
          />
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Painel de Veículos</p>
            <p className="text-blue-300/60 text-[10px] font-medium tracking-wide uppercase">
              {profile?.unidade?.nome ?? 'Tempo Real'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {lastUpdate && (
            <span className="text-blue-300/40 text-[10px] mr-1">
              {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => loadData(true)}
            className="text-blue-300/70 hover:text-cobeb-yellow transition-colors p-1.5 rounded-lg hover:bg-white/10"
            title="Atualizar"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={signOut}
            className="text-blue-300/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-6">
        {conteudo}
      </main>
    </div>
  )
}

// ── Card de viagem ────────────────────────────────────────────────────────────

function ViagemCard({ viagem, expanded, onToggle }) {
  const cfg     = STATUS_CFG[viagem.status] ?? STATUS_CFG.iniciada
  const produtos = viagem.produtos ?? []

  return (
    <div className={`bg-white rounded-2xl border border-cobeb-border overflow-hidden border-l-4 ${cfg.border} shadow-sm`}>

      {/* Banner ⚠️ ATENÇÃO */}
      {cfg.urgent && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={13} className="text-yellow-500 shrink-0" />
          <p className="text-yellow-700 font-bold text-xs uppercase tracking-wide">
            ATENÇÃO — Veículo a caminho
          </p>
        </div>
      )}

      {/* Corpo (clicável) */}
      <button onClick={onToggle} className="w-full text-left px-4 py-3.5">

        {/* Linha 1: placas + badge de status + chevron */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-cobeb-text font-bold text-sm font-mono tracking-wide">
                {viagem.placa_cavalo ?? '—'}
              </span>
              {viagem.placa_carreta && (
                <>
                  <span className="text-slate-300 text-xs">·</span>
                  <span className="text-slate-500 text-xs font-mono">{viagem.placa_carreta}</span>
                </>
              )}
            </div>
            {viagem.motorista_nome && (
              <p className="text-slate-500 text-xs mt-0.5">{viagem.motorista_nome}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${cfg.badge}`}>
              {cfg.label}
            </span>
            {expanded
              ? <ChevronUp  size={14} className="text-slate-400" />
              : <ChevronDown size={14} className="text-slate-400" />}
          </div>
        </div>

        {/* Linha 2: NF + pedidos + horário */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {viagem.numero_nf && (
            <span className="text-[11px] text-slate-500">
              NF <span className="font-semibold text-cobeb-text">{viagem.numero_nf}</span>
            </span>
          )}
          {Number(viagem.total_pedidos) > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              <Package size={10} />
              {viagem.total_pedidos} pedido{viagem.total_pedidos !== 1 ? 's' : ''}
            </span>
          )}
          {viagem.horario_agendado && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-cobeb-navy">
              <Clock size={10} />
              Prev. {viagem.horario_agendado}
            </span>
          )}
        </div>

        {/* Indicador de etapas */}
        <StepIndicator step={cfg.step} />
      </button>

      {/* Produtos (expandido) */}
      {expanded && (
        <div className="border-t border-cobeb-border/40">
          {produtos.length > 0 ? (
            <>
              <div className="px-4 py-2 bg-[#EBF5FF]">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                  Produtos do pedido
                </p>
              </div>
              <div className="divide-y divide-cobeb-border/30">
                {produtos.map((p, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-cobeb-text text-xs font-medium">{p.descricao}</p>
                      {p.embalagem && (
                        <p className="text-slate-400 text-[10px] mt-0.5">{p.embalagem}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-cobeb-text text-xs font-semibold">
                        {Number(p.qtde_pallets).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} plt
                      </p>
                      <p className="text-slate-400 text-[10px]">
                        {Number(p.qtde_skus).toLocaleString('pt-BR')} cx
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="px-4 py-4 text-center">
              <p className="text-slate-400 text-xs">Produtos não vinculados ao pedido ainda</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Indicador de etapas ───────────────────────────────────────────────────────

function StepIndicator({ step }) {
  return (
    <div className="flex items-start mt-3.5 gap-0">
      {STEP_LABELS.map((label, i) => {
        const done    = i < step
        const current = i === step
        const isLast  = i === STEP_LABELS.length - 1
        return (
          <div key={i} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full border-2 transition-all ${
                current ? 'bg-cobeb-navy border-cobeb-navy scale-125' :
                done    ? 'bg-cobeb-navy border-cobeb-navy' :
                          'bg-white border-cobeb-border'
              }`} />
              <p className={`text-[8px] font-semibold mt-0.5 whitespace-nowrap ${
                current ? 'text-cobeb-navy' :
                done    ? 'text-cobeb-navy/50' :
                          'text-slate-300'
              }`}>{label}</p>
            </div>
            {!isLast && (
              <div className={`h-0.5 flex-1 mx-0.5 mb-3 ${
                done ? 'bg-cobeb-navy' : 'bg-cobeb-border'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Estado vazio ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-5 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-white border border-cobeb-border flex items-center justify-center shadow-sm">
        <Forklift size={32} className="text-cobeb-border" />
      </div>
      <div>
        <p className="text-cobeb-text font-bold text-base">Nenhum veículo ativo</p>
        <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
          Quando um motorista iniciar uma viagem para esta unidade, o card aparecerá aqui automaticamente.
        </p>
      </div>
    </div>
  )
}
