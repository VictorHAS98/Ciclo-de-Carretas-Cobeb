import { useState, useEffect } from 'react'
import { Search, Save, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const TIPOS_DIA = ['SEMANA', 'SÁBADO', 'DOMINGO']

const MOTIVOS = [
  'TROCA DE TURNO',
  'INTERVALO ALMOÇO',
  'INTERVALO JANTA',
  'IMPACTO HISTOGRAMA CARREGAMENTO',
  'IMPACTO HISTOGRAMA DESCARGA',
  'SEM ESCALA',
]

function formatDT(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function Grade() {
  const { profile } = useAuth()

  const [revendas, setRevendas]         = useState([])
  const [revendaId, setRevendaId]       = useState('')
  const [tipoDia, setTipoDia]           = useState('SEMANA')
  const [busca, setBusca]               = useState('')

  const [grade, setGrade]               = useState([])
  const [loadingGrade, setLoadingGrade] = useState(false)

  const [draft, setDraft]               = useState({})
  const [publicando, setPublicando]     = useState(false)

  const [showLog, setShowLog]           = useState(false)
  const [log, setLog]                   = useState([])
  const [loadingLog, setLoadingLog]     = useState(false)

  useEffect(() => { carregarRevendas() }, [])

  async function carregarRevendas() {
    const { data } = await supabase
      .from('unidades')
      .select('id, nome, codigo_ambev, cidade')
      .eq('tipo', 'revenda')
      .eq('ativo', true)
      .order('nome')
    const lista = data ?? []
    setRevendas(lista)
    if (lista.length > 0) setRevendaId(lista[0].id)
  }

  useEffect(() => {
    if (!revendaId) return
    setDraft({})
    setLog([])
    setShowLog(false)
    carregarGrade(revendaId)
  }, [revendaId])

  async function carregarGrade(id) {
    setLoadingGrade(true)
    const { data } = await supabase
      .from('grade_horarios')
      .select('id, tipo_dia, bloco, bloco_ordem, status, motivo_criticidade, vagas')
      .eq('revenda_id', id)
      .order('bloco_ordem')
    setGrade(data ?? [])
    setLoadingGrade(false)
  }

  function getValor(row) {
    return draft[row.id] ?? {
      status: row.status,
      motivo_criticidade: row.motivo_criticidade,
      vagas: row.vagas,
    }
  }

  function atualizarDraft(rowId, changes) {
    const row = grade.find(r => r.id === rowId)
    if (!row) return
    setDraft(prev => {
      const base = prev[rowId] ?? {
        status: row.status,
        motivo_criticidade: row.motivo_criticidade,
        vagas: row.vagas,
      }
      const novo = { ...base, ...changes }
      const mesmosValores =
        novo.status === row.status &&
        (novo.motivo_criticidade ?? null) === (row.motivo_criticidade ?? null) &&
        (novo.vagas ?? 1) === (row.vagas ?? 1)
      if (mesmosValores) {
        const { [rowId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [rowId]: novo }
    })
  }

  function alterarStatus(rowId, novoStatus) {
    atualizarDraft(rowId, {
      status: novoStatus,
      ...(novoStatus === 'OK' ? { motivo_criticidade: null } : {}),
    })
  }

  function alterarMotivo(rowId, motivo) {
    atualizarDraft(rowId, { motivo_criticidade: motivo || null })
  }

  function alterarVagas(rowId, valor) {
    const n = Math.max(1, parseInt(valor) || 1)
    atualizarDraft(rowId, { vagas: n })
  }

  const hasDraft   = Object.keys(draft).length > 0
  const draftCount = Object.keys(draft).length

  const errosValidacao = Object.entries(draft).filter(
    ([, v]) => v.status === 'CRÍTICO' && !v.motivo_criticidade
  )
  const hasErrors = errosValidacao.length > 0

  function mudarRevenda(id) {
    if (hasDraft && !window.confirm('Há alterações não publicadas. Descartar e trocar de revenda?')) return
    setRevendaId(id)
  }

  async function publicar() {
    if (!hasDraft || hasErrors) return
    setPublicando(true)

    const logEntries = Object.entries(draft).map(([rowId, values]) => {
      const row     = grade.find(r => r.id === rowId)
      const revenda = revendas.find(r => r.id === revendaId)
      return {
        revenda_id:         revendaId,
        revenda_nome:       revenda?.nome ?? '',
        tipo_dia:           row.tipo_dia,
        bloco:              row.bloco,
        status_anterior:    row.status,
        motivo_anterior:    row.motivo_criticidade ?? null,
        status_novo:        values.status,
        motivo_novo:        values.motivo_criticidade ?? null,
        vagas_anterior:     row.vagas ?? 1,
        vagas_novo:         values.vagas ?? 1,
        publicado_por:      profile.id,
        publicado_por_nome: profile.nome,
      }
    })

    const resultados = await Promise.all(
      Object.entries(draft).map(([rowId, values]) =>
        supabase
          .from('grade_horarios')
          .update({
            status:             values.status,
            motivo_criticidade: values.motivo_criticidade ?? null,
            vagas:              values.vagas ?? 1,
            updated_by:         profile.id,
          })
          .eq('id', rowId)
      )
    )

    const erroUpdate = resultados.find(r => r.error)?.error
    if (erroUpdate) {
      alert('Erro ao publicar: ' + erroUpdate.message)
      setPublicando(false)
      return
    }

    await supabase.from('grade_horarios_log').insert(logEntries)

    await carregarGrade(revendaId)
    setDraft({})
    setPublicando(false)
  }

  async function carregarLog() {
    setLoadingLog(true)
    const { data } = await supabase
      .from('grade_horarios_log')
      .select('*')
      .eq('revenda_id', revendaId)
      .order('publicado_em', { ascending: false })
      .limit(100)
    setLog(data ?? [])
    setLoadingLog(false)
  }

  useEffect(() => {
    if (showLog && revendaId) carregarLog()
  }, [showLog, revendaId])

  const linhas = grade
    .filter(r => r.tipo_dia === tipoDia)
    .filter(r => !busca.trim() || r.bloco.includes(busca.trim()))

  return (
    <div className="px-5 py-4 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-cobeb-text font-semibold text-sm">
            {revendas.length} revenda{revendas.length !== 1 ? 's' : ''} na grade
          </p>
          <p className="text-slate-500 text-xs">12 blocos × 3 tipos de dia por revenda</p>
        </div>
      </div>

      {/* Seletor de revenda */}
      <div className="mb-3">
        <label className="block text-slate-500 text-[11px] font-semibold uppercase tracking-widest mb-1.5">
          Revenda
        </label>
        <div className="flex flex-wrap gap-2">
          {revendas.map(r => (
            <button key={r.id} onClick={() => mudarRevenda(r.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                revendaId === r.id
                  ? 'bg-cobeb-navy text-white border-cobeb-navy'
                  : 'bg-[#EBF5FF] text-slate-500 border-cobeb-border hover:border-cobeb-blue/40'
              }`}>
              {r.codigo_ambev ? `${r.codigo_ambev} — ` : ''}{r.nome}
              {r.cidade ? ` (${r.cidade})` : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Tipo de dia */}
      <div className="flex gap-2 mb-4">
        {TIPOS_DIA.map(t => {
          const alteracoesNesseTipo = Object.keys(draft).filter(
            rowId => grade.find(r => r.id === rowId)?.tipo_dia === t
          ).length
          return (
            <button key={t} onClick={() => setTipoDia(t)}
              className={`flex-1 relative py-2 rounded-xl text-xs font-semibold border transition-colors ${
                tipoDia === t
                  ? 'bg-cobeb-navy text-white border-cobeb-navy'
                  : 'bg-[#EBF5FF] text-slate-500 border-cobeb-border hover:border-cobeb-blue/40'
              }`}>
              {t}
              {alteracoesNesseTipo > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {alteracoesNesseTipo}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Busca */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" placeholder="Filtrar por horário..."
          value={busca} onChange={e => setBusca(e.target.value)}
          className="w-full bg-[#EBF5FF] border border-cobeb-border rounded-xl pl-9 pr-4 py-3 text-cobeb-text text-sm placeholder-blue-200 focus:outline-none focus:border-cobeb-blue transition-all" />
      </div>

      {/* Banner de rascunho */}
      {hasDraft && (
        <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-amber-700 text-sm font-semibold">
              {draftCount} alteração{draftCount > 1 ? 'ões' : ''} em rascunho
            </p>
            {hasErrors && (
              <p className="text-red-500 text-xs mt-0.5">
                {errosValidacao.length} bloco(s) CRÍTICO sem motivo — corrija antes de publicar
              </p>
            )}
          </div>
          <button onClick={() => setDraft({})}
            className="text-xs text-amber-600 font-semibold underline whitespace-nowrap shrink-0">
            Descartar
          </button>
        </div>
      )}

      {/* Lista de blocos */}
      {loadingGrade ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-cobeb-navy border-t-transparent rounded-full animate-spin" />
        </div>
      ) : grade.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 text-sm">Grade não inicializada para esta revenda.</p>
          <p className="text-slate-400 text-xs mt-1">Execute o script SQL 042 no Supabase Studio.</p>
        </div>
      ) : linhas.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-12">Nenhum bloco encontrado</p>
      ) : (
        <div className="space-y-2">
          {linhas.map(row => {
            const val        = getValor(row)
            const changed    = !!draft[row.id]
            const isCritico  = val.status === 'CRÍTICO'
            const erroMotivo = isCritico && !val.motivo_criticidade

            return (
              <div key={row.id}
                className={`rounded-xl border transition-all ${
                  changed ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-cobeb-border'
                }`}>
                <div className="p-3 flex items-center gap-2.5">

                  {/* Bloco horário */}
                  <div className="shrink-0 w-28">
                    <p className="font-mono text-cobeb-text text-sm font-semibold leading-tight">
                      {row.bloco}
                    </p>
                    {changed && (
                      <span className="text-[10px] text-amber-600 font-semibold">rascunho</span>
                    )}
                  </div>

                  {/* Toggle status */}
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => alterarStatus(row.id, 'OK')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                        val.status === 'OK'
                          ? 'bg-green-500 text-white border-green-500'
                          : 'bg-[#F5F9FF] text-slate-400 border-cobeb-border hover:border-green-400/50'
                      }`}>
                      OK
                    </button>
                    <button onClick={() => alterarStatus(row.id, 'CRÍTICO')}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                        val.status === 'CRÍTICO'
                          ? 'bg-red-500 text-white border-red-500'
                          : 'bg-[#F5F9FF] text-slate-400 border-cobeb-border hover:border-red-400/50'
                      }`}>
                      CRÍTICO
                    </button>
                  </div>

                  {/* Select de motivo */}
                  <div className="flex-1 min-w-0">
                    <select
                      value={val.motivo_criticidade ?? ''}
                      onChange={e => alterarMotivo(row.id, e.target.value)}
                      disabled={!isCritico}
                      className={`w-full text-[11px] rounded-lg border px-2 py-1.5 transition-colors appearance-none cursor-pointer ${
                        !isCritico
                          ? 'bg-gray-50 text-slate-300 border-cobeb-border cursor-not-allowed'
                          : erroMotivo
                            ? 'bg-red-50 text-cobeb-text border-red-400 focus:outline-none'
                            : 'bg-[#F5F9FF] text-cobeb-text border-cobeb-border focus:outline-none focus:border-cobeb-blue'
                      }`}>
                      <option value="">— Motivo —</option>
                      {MOTIVOS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Vagas por bloco */}
                  <div className="shrink-0 flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider leading-none">
                      Vagas
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={val.vagas ?? 1}
                      onChange={e => alterarVagas(row.id, e.target.value)}
                      className="w-12 text-center text-xs font-semibold text-cobeb-text bg-[#F5F9FF] border border-cobeb-border rounded-lg py-1.5 focus:outline-none focus:border-cobeb-blue transition-colors"
                    />
                  </div>
                </div>

                {/* Indicador de erro de motivo */}
                {erroMotivo && (
                  <div className="px-3 pb-2.5">
                    <p className="text-[10px] text-red-500 font-medium">
                      Motivo obrigatório quando status = CRÍTICO
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Barra de publicação (fixa acima do bottom nav) */}
      {hasDraft && (
        <div className="fixed bottom-16 left-0 right-0 z-30 bg-white border-t border-cobeb-border px-4 py-3 flex gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <button onClick={() => setDraft({})}
            className="flex-1 bg-[#EBF5FF] border border-cobeb-border text-slate-500 text-sm font-semibold py-3 rounded-xl transition-colors hover:border-cobeb-blue/40">
            Cancelar
          </button>
          <button onClick={publicar} disabled={publicando || hasErrors}
            title={hasErrors ? 'Corrija os motivos de criticidade antes de publicar' : undefined}
            className="flex-1 flex items-center justify-center gap-2 bg-cobeb-navy hover:bg-cobeb-blue disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-3 rounded-xl transition-colors">
            <Save size={15} />
            {publicando ? 'Publicando...' : `Publicar ${draftCount}`}
          </button>
        </div>
      )}

      {/* Histórico de publicações */}
      {revendaId && (
        <div className="mt-6">
          <button onClick={() => setShowLog(v => !v)}
            className="flex items-center gap-2 w-full text-left py-3 border-t border-cobeb-border">
            <span className="text-cobeb-text font-semibold text-sm flex-1">
              Histórico de Publicações
            </span>
            {showLog
              ? <ChevronUp size={16} className="text-slate-500" />
              : <ChevronDown size={16} className="text-slate-500" />}
          </button>

          {showLog && (
            <div className="pb-4">
              {loadingLog ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-cobeb-navy border-t-transparent rounded-full animate-spin" />
                </div>
              ) : log.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-6">
                  Nenhuma publicação registrada para esta revenda
                </p>
              ) : (
                <div className="space-y-2">
                  {log.map(l => (
                    <div key={l.id} className="bg-white rounded-xl p-3 border border-cobeb-border">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <span className="font-mono text-cobeb-text text-xs font-bold">{l.bloco}</span>
                          <span className="text-slate-400 text-[10px] ml-2 font-medium">{l.tipo_dia}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                          {formatDT(l.publicado_em)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <StatusBadge status={l.status_anterior} />
                        <span className="text-slate-400 text-xs">→</span>
                        <StatusBadge status={l.status_novo} />
                        {l.motivo_novo && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                            {l.motivo_novo}
                          </span>
                        )}
                        {l.vagas_anterior != null && l.vagas_anterior !== l.vagas_novo && (
                          <span className="text-[10px] text-cobeb-navy bg-cobeb-navy/10 border border-cobeb-navy/20 px-2 py-0.5 rounded-full">
                            {l.vagas_anterior} → {l.vagas_novo} vagas
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-400">
                        por <span className="text-slate-500 font-medium">{l.publicado_por_nome}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  if (!status) return <span className="text-[10px] text-slate-400">—</span>
  const isCritico = status === 'CRÍTICO'
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
      isCritico
        ? 'bg-red-500/10 text-red-500 border-red-400/30'
        : 'bg-green-500/10 text-green-600 border-green-400/30'
    }`}>
      {status}
    </span>
  )
}
