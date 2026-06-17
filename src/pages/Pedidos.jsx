import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Upload, FileSpreadsheet, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, X, Search, RefreshCw,
  CheckCircle, AlertOctagon, Clock,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import AdminLayout from '../components/AdminLayout'

// ── helpers ──────────────────────────────────────────────────────────────────

const FILE_PATTERN = /^BASE_(\d{2})-(\d{2})-(\d{4})\.xlsx$/i

function excelSerial(n) {
  if (!n) return null
  if (typeof n === 'number')
    return new Date(Math.round((n - 25569) * 86400 * 1000)).toISOString().split('T')[0]
  const d = new Date(n)
  return isNaN(d) ? null : d.toISOString().split('T')[0]
}

function arqOrigemToDate(s) {
  const m = s.match(/^BASE_(\d{2})-(\d{2})-(\d{4})$/i)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

function mapRevenda(revenda, unidades) {
  if (!revenda) return null
  const r = revenda.toLowerCase()
  if (r.includes('lagoa') || r.includes('188300'))
    return unidades.find(u => u.codigo === 'FILIAL_LP')?.id ?? null
  if (r.includes('abaet') || r.includes('98450'))
    return unidades.find(u => u.codigo === 'FILIAL_AB')?.id ?? null
  if (r.includes('para') || r.includes('77200'))
    return unidades.find(u => u.codigo === 'MATRIZ')?.id ?? null
  return null
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function ptDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function isoToday() {
  return new Date().toISOString().split('T')[0]
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Pedidos() {
  const { profile } = useAuth()
  const isAdminTotal = profile?.acesso_total === true
  const fileRef = useRef(null)

  const [unidades, setUnidades] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)

  // import state
  const [pendingFile, setPendingFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  // filter state
  const [filtData, setFiltData] = useState('')
  const [filtUnidade, setFiltUnidade] = useState('')
  const [filtFabrica, setFiltFabrica] = useState('')
  const [search, setSearch] = useState('')

  const [expanded, setExpanded] = useState(new Set())

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: unis }, { data: peds }] = await Promise.all([
      supabase.from('unidades').select('id, nome, codigo, cidade').order('nome'),
      supabase.from('pedidos').select('*')
        .order('data_puxada', { ascending: false })
        .order('numero_pedido'),
    ])
    setUnidades(unis ?? [])
    setPedidos(peds ?? [])
    setLoading(false)
  }

  // derived: unique dates sorted desc
  const datas = useMemo(
    () => [...new Set(pedidos.map(p => p.data_puxada))].sort().reverse(),
    [pedidos]
  )

  // default to most recent date on first load
  useEffect(() => {
    if (!filtData && datas.length > 0) setFiltData(datas[0])
  }, [datas])

  const fabricas = useMemo(
    () => [...new Set(pedidos.map(p => p.fabrica).filter(Boolean))].sort(),
    [pedidos]
  )

  // ── file handling ───────────────────────────────────────────────────────────

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (fileRef.current) fileRef.current.value = ''
    setFileError(''); setImportResult(null); setPendingFile(null)
    if (!file) return
    if (!FILE_PATTERN.test(file.name)) {
      setFileError('Nome inválido. Use o padrão BASE_DD-MM-YYYY.xlsx')
      return
    }
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: false })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true })
        const dataRows = rows.slice(1).filter(r => r[3])
        if (!dataRows.length) { setFileError('Arquivo sem dados válidos.'); return }
        const arqOrigem = file.name.replace(/\.xlsx$/i, '')
        setPendingFile({ name: file.name, arqOrigem, data: dataRows, count: dataRows.length })
      } catch {
        setFileError('Erro ao ler o arquivo.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImport() {
    if (!pendingFile) return
    setImporting(true); setImportResult(null)
    try {
      const records = pendingFile.data.map(r => ({
        data_puxada:    excelSerial(r[0]),
        revenda:        String(r[1] || ''),
        unidade_id:     mapRevenda(String(r[1] || ''), unidades),
        fabrica:        String(r[2] || ''),
        numero_pedido:  Number(r[3]),
        placa:          r[4] ? String(r[4]).toUpperCase().trim() : null,
        cod_produto:    String(r[5] || ''),
        descricao:      String(r[6] || ''),
        embalagem:      r[7] ? String(r[7]) : null,
        curva:          r[8] ? String(r[8]).trim() : null,
        qtde_pallets:   Number(r[9]) || 0,
        qtde_skus:      Number(r[10]) || 0,
        arquivo_origem: pendingFile.arqOrigem,
        importado_por:  profile?.id,
      }))

      const { error: delErr } = await supabase
        .from('pedidos').delete().eq('arquivo_origem', pendingFile.arqOrigem)
      if (delErr) throw delErr

      for (const batch of chunk(records, 500)) {
        const { error: insErr } = await supabase.from('pedidos').insert(batch)
        if (insErr) throw insErr
      }

      const importedDate = arqOrigemToDate(pendingFile.arqOrigem)
      setImportResult({ ok: true, msg: `${records.length.toLocaleString('pt-BR')} registros importados.` })
      setPendingFile(null)
      await loadData()
      if (importedDate) setFiltData(importedDate)
    } catch (err) {
      setImportResult({ ok: false, msg: err.message || 'Erro ao importar.' })
    } finally {
      setImporting(false)
    }
  }

  // ── grouping ────────────────────────────────────────────────────────────────

  const agrupados = useMemo(() => {
    let filtered = pedidos
    if (filtData)    filtered = filtered.filter(p => p.data_puxada === filtData)
    if (filtUnidade) filtered = filtered.filter(p => p.unidade_id === filtUnidade)
    if (filtFabrica) filtered = filtered.filter(p => p.fabrica === filtFabrica)
    if (search.trim()) {
      const q = search.trim()
      filtered = filtered.filter(p => String(p.numero_pedido).includes(q))
    }

    const map = new Map()
    for (const p of filtered) {
      const key = `${p.numero_pedido}||${p.arquivo_origem}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          numero_pedido: p.numero_pedido,
          placa:         p.placa,
          data_puxada:   p.data_puxada,
          unidade_id:    p.unidade_id,
          fabrica:       p.fabrica,
          viagem_id:     p.viagem_id,
          itens:         [],
          total_pallets: 0,
          total_skus:    0,
        })
      }
      const g = map.get(key)
      g.itens.push(p)
      g.total_pallets += Number(p.qtde_pallets) || 0
      g.total_skus    += Number(p.qtde_skus) || 0
    }
    return [...map.values()]
  }, [pedidos, filtData, filtUnidade, filtFabrica, search])

  function toggleExpand(key) {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(key) ? n.delete(key) : n.add(key)
      return n
    })
  }

  // ── render ──────────────────────────────────────────────────────────────────

  const pillBase =
    'px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border'
  const pillActive =
    'bg-cobeb-navy border-orange-500 text-white'
  const pillInactive =
    'bg-transparent border-cobeb-border text-slate-500 hover:border-orange-500/50 hover:text-cobeb-text'

  const selCls =
    'bg-white border border-cobeb-border rounded-xl px-3 py-2 text-cobeb-text text-xs ' +
    'focus:outline-none focus:border-cobeb-blue appearance-none cursor-pointer'

  return (
    <AdminLayout title="Consulta de Pedidos">
      <div className="max-w-lg mx-auto">

        {/* ── Import toggle (admin_total) ── */}
        {isAdminTotal && (
          <div className="px-4 pt-4">
            <div className="bg-white rounded-2xl border border-cobeb-border overflow-hidden">
              <button
                onClick={() => { setShowImport(v => !v); setImportResult(null) }}
                className="w-full flex items-center justify-between px-5 py-3.5"
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet size={16} className="text-cobeb-yellow" />
                  <span className="text-cobeb-text text-sm font-semibold">Importar BASE Ambev</span>
                </div>
                {showImport ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
              </button>

              {showImport && (
                <div className="border-t border-cobeb-border p-4 space-y-3">
                  <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" />

                  {!pendingFile ? (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full border-2 border-dashed border-cobeb-border hover:border-orange-500/50 rounded-xl py-6 flex flex-col items-center gap-2 transition-colors group"
                    >
                      <Upload size={18} className="text-slate-500 group-hover:text-cobeb-yellow transition-colors" />
                      <span className="text-slate-500 text-sm">Selecionar arquivo BASE...</span>
                    </button>
                  ) : (
                    <div className="bg-[#EBF5FF] rounded-xl p-3.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet size={16} className="text-cobeb-yellow shrink-0" />
                        <div>
                          <p className="text-cobeb-text text-sm font-medium">{pendingFile.name}</p>
                          <p className="text-slate-500 text-xs">{pendingFile.count.toLocaleString('pt-BR')} registros</p>
                        </div>
                      </div>
                      <button onClick={() => setPendingFile(null)} className="text-slate-500 hover:text-slate-400">
                        <X size={15} />
                      </button>
                    </div>
                  )}

                  {fileError && (
                    <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 rounded-xl px-4 py-3">
                      <AlertCircle size={13} className="shrink-0" />{fileError}
                    </div>
                  )}
                  {importResult && (
                    <div className={`flex items-center gap-2 text-xs rounded-xl px-4 py-3 ${importResult.ok ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                      {importResult.ok ? <CheckCircle2 size={13} className="shrink-0" /> : <AlertCircle size={13} className="shrink-0" />}
                      {importResult.msg}
                    </div>
                  )}

                  {pendingFile && (
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="w-full bg-cobeb-navy hover:bg-cobeb-blue disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-3 transition-colors flex items-center justify-center gap-2"
                    >
                      {importing
                        ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Importando...</>
                        : <><Upload size={15} />Importar {pendingFile.count.toLocaleString('pt-BR')} registros</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Date filter ── */}
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2">
            {/* Quick shortcuts D-1 / D0 / D1 */}
            {[{ label: 'D-1', diff: -1 }, { label: 'D0', diff: 0 }, { label: 'D1', diff: 1 }].map(({ label, diff }) => {
              const iso = addDays(isoToday(), diff)
              const active = filtData === iso
              const hasData = datas.includes(iso)
              return (
                <button
                  key={label}
                  onClick={() => setFiltData(active ? '' : iso)}
                  className={`${pillBase} ${active ? pillActive : pillInactive} ${!hasData ? 'opacity-40' : ''}`}
                >
                  {label}
                </button>
              )
            })}

            {/* Date picker for any other date */}
            <input
              type="date"
              value={filtData}
              onChange={e => setFiltData(e.target.value)}
              className="flex-1 bg-white border border-cobeb-border rounded-xl px-3 py-1.5 text-cobeb-text text-xs focus:outline-none focus:border-cobeb-blue transition-colors [color-scheme:light]"
            />

            {filtData && (
              <button onClick={() => setFiltData('')} className="text-slate-500 hover:text-cobeb-yellow transition-colors shrink-0">
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        {/* ── Search + secondary filters ── */}
        <div className="px-4 pt-3 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar número do pedido..."
              className="w-full bg-white border border-cobeb-border rounded-xl pl-9 pr-4 py-2.5 text-cobeb-text text-sm placeholder-slate-400 focus:outline-none focus:border-cobeb-blue transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <select value={filtUnidade} onChange={e => setFiltUnidade(e.target.value)} className={`flex-1 ${selCls}`}>
              <option value="">Todas unidades</option>
              {unidades.map(u => <option key={u.id} value={u.id}>{u.codigo}</option>)}
            </select>
            <select value={filtFabrica} onChange={e => setFiltFabrica(e.target.value)} className={`flex-1 ${selCls}`}>
              <option value="">Todas fábricas</option>
              {fabricas.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        {/* ── Column header ── */}
        {!loading && agrupados.length > 0 && (
          <div className="px-4 pt-4 pb-1">
            <div className="grid items-center px-4 py-1"
              style={{ gridTemplateColumns: '1fr 1fr auto auto' }}>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Data · Fábrica</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Pedido · Placa</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest pr-6">Status</span>
              <span />
            </div>
          </div>
        )}

        {/* ── List ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : agrupados.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-14 h-14 rounded-2xl bg-white border border-cobeb-border flex items-center justify-center mx-auto mb-4">
              <FileSpreadsheet size={22} className="text-cobeb-border" />
            </div>
            <p className="text-slate-500 text-sm font-medium">Nenhum pedido encontrado</p>
            <p className="text-cobeb-border text-xs mt-1">
              {pedidos.length === 0 ? 'Importe um arquivo BASE para começar' : 'Ajuste os filtros acima'}
            </p>
          </div>
        ) : (
          <div className="px-4 pt-1 pb-4 space-y-1.5">
            {agrupados.map(g => {
              const isOpen = expanded.has(g.key)
              const unidade = unidades.find(u => u.id === g.unidade_id)
              const vinculado = !!g.viagem_id

              return (
                <div key={g.key} className="bg-white rounded-2xl border border-cobeb-border overflow-hidden">
                  {/* Row */}
                  <button
                    onClick={() => toggleExpand(g.key)}
                    className="w-full text-left"
                  >
                    <div
                      className="grid items-center gap-x-2 px-4 py-3"
                      style={{ gridTemplateColumns: '1fr 1fr auto auto' }}
                    >
                      {/* Col 1: date + factory */}
                      <div className="min-w-0">
                        <p className="text-cobeb-text text-xs font-semibold">{ptDate(g.data_puxada)}</p>
                        <p className="text-slate-500 text-[11px] truncate mt-0.5">{g.fabrica}</p>
                        {unidade && (
                          <p className="text-slate-500 text-[10px] mt-0.5">{unidade.codigo}</p>
                        )}
                      </div>

                      {/* Col 2: pedido + plate */}
                      <div className="min-w-0">
                        <p className="text-cobeb-yellow font-mono text-xs font-semibold">
                          #{g.numero_pedido}
                        </p>
                        {g.placa && (
                          <p className="text-slate-400 font-mono text-[11px] mt-0.5">{g.placa}</p>
                        )}
                        <p className="text-slate-500 text-[10px] mt-0.5">
                          {g.itens.length} prod · {g.total_pallets.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pal
                        </p>
                      </div>

                      {/* Col 3: status */}
                      <div className="flex items-center gap-1.5 pr-2">
                        {vinculado ? (
                          <>
                            <CheckCircle size={14} className="text-green-400 shrink-0" />
                            <span className="text-green-400 text-[10px] font-semibold whitespace-nowrap">Vinculado</span>
                          </>
                        ) : (
                          <>
                            <Clock size={14} className="text-slate-500 shrink-0" />
                            <span className="text-slate-500 text-[10px] font-semibold whitespace-nowrap">Pendente</span>
                          </>
                        )}
                      </div>

                      {/* Col 4: chevron */}
                      <div className="text-slate-500">
                        {isOpen
                          ? <ChevronUp size={16} />
                          : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded: product lines */}
                  {isOpen && (
                    <div className="border-t border-[#0B1929]">
                      {/* Sub-header */}
                      <div className="grid px-4 py-2 bg-[#EBF5FF]"
                        style={{ gridTemplateColumns: '1fr auto' }}>
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">
                          Produto
                        </span>
                        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest text-right">
                          Pallets · Caixas
                        </span>
                      </div>
                      {g.itens.map((item, i) => (
                        <div
                          key={item.id}
                          className={`grid items-center gap-x-3 px-4 py-2.5 ${i < g.itens.length - 1 ? 'border-b border-[#0B1929]' : ''}`}
                          style={{ gridTemplateColumns: '1fr auto' }}
                        >
                          <div className="min-w-0">
                            <p className="text-cobeb-text text-xs font-medium truncate">{item.descricao}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-slate-500 text-[10px] font-mono">{item.cod_produto}</span>
                              {item.embalagem && <span className="text-slate-500 text-[10px]">{item.embalagem}</span>}
                              {item.curva && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded leading-none ${
                                  item.curva === 'A' ? 'bg-cobeb-navy/10 text-cobeb-yellow' :
                                  item.curva === 'B' ? 'bg-blue-500/20 text-blue-400' :
                                  'bg-[#1E3A5F]/50 text-slate-500'
                                }`}>{item.curva}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-cobeb-text text-xs font-semibold">
                              {Number(item.qtde_pallets).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                            </p>
                            <p className="text-slate-500 text-[10px]">
                              {Number(item.qtde_skus).toLocaleString('pt-BR')} cx
                            </p>
                          </div>
                        </div>
                      ))}

                      {/* Totais */}
                      <div className="grid items-center gap-x-3 px-4 py-2.5 bg-[#EBF5FF]"
                        style={{ gridTemplateColumns: '1fr auto' }}>
                        <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest">
                          Total ({g.itens.length} produtos)
                        </span>
                        <div className="text-right">
                          <span className="text-cobeb-yellow text-xs font-bold">
                            {g.total_pallets.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} pal
                          </span>
                          <span className="text-slate-500 text-[10px] ml-2">
                            {g.total_skus.toLocaleString('pt-BR')} cx
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Counter + refresh ── */}
        {!loading && (
          <div className="px-4 pb-6 flex items-center justify-between">
            <p className="text-slate-500 text-xs">
              Mostrando{' '}
              <span className="text-cobeb-text font-semibold">{agrupados.length}</span>
              {' '}de{' '}
              <span className="text-cobeb-text font-semibold">
                {[...new Set(pedidos.filter(p => {
                  if (filtData && p.data_puxada !== filtData) return false
                  if (filtUnidade && p.unidade_id !== filtUnidade) return false
                  if (filtFabrica && p.fabrica !== filtFabrica) return false
                  return true
                }).map(p => p.numero_pedido))].length}
              </span>
              {' '}pedidos
            </p>
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 text-slate-500 hover:text-cobeb-yellow text-xs transition-colors"
            >
              <RefreshCw size={12} />
              Atualizar
            </button>
          </div>
        )}

      </div>
    </AdminLayout>
  )
}
