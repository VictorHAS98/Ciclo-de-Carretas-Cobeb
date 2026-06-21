import { useState } from 'react'
import { ChevronLeft, Plus, X, Download, Printer, AlertCircle, Loader2, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { jsPDF } from 'jspdf'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt4Y(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmt2Y(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(-2)}`
}

function minus30(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() - 30)
  return d.toISOString().slice(0, 10)
}

function newGrupo() {
  return {
    _id:          crypto.randomUUID(),
    codigo:       '',
    descricao:    null,
    cxPallet:     null,
    qtdePaletes:  '',
    qtdeCaixas:   null,
    dataValidade: '',
    curva:        null,
    buscando:     false,
    erroCodigo:   null,
    erroQtd:      false,
    erroData:     false,
  }
}

// ── PDF: render one NRI block ─────────────────────────────────────────────────

function renderNRI(doc, {
  nri, yBase, marginX, W,
  dataRecebimento, horaEmissao,
  cabecalho, placa, motorista, origem,
}) {
  const x0       = marginX
  const BLUE     = [26, 79, 156]
  const BLACK    = [0, 0, 0]
  const WHITE    = [255, 255, 255]
  const GRAY_LT  = [232, 232, 232]
  const GRAY_MID = [212, 212, 212]
  const GRAY_TXT = [90, 90, 90]
  const GRAY_BAR = [185, 185, 185]

  // row heights — total = 97mm (dentro de 99mm por NRI)
  const r1H = 12   // cabeçalho: COBEB + número
  const r2H = 19   // produto: código + descrição (maior)
  const r3H = 33   // vencimento + curva/carregar até (maior)
  const r4H = 22   // recebimento — 4 linhas com folga
  const r5H = 11   // rodapé table
  const totalH = r1H + r2H + r3H + r4H + r5H  // 97mm

  const r1Y = yBase + 1
  const r2Y = r1Y + r1H
  const r3Y = r2Y + r2H
  const r4Y = r3Y + r3H
  const r5Y = r4Y + r4H

  const hline = (y, lw = 0.25) => {
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(lw)
    doc.line(x0, y, x0 + W, y)
  }

  // Borda externa
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.5)
  doc.rect(x0, r1Y, W, totalH, 'S')

  // ─── Row 1: "COBEB" (esq) + número sequencial (dir) ──────────────────────

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLUE)
  doc.text('COBEB', x0 + 3, r1Y + 9)

  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLACK)
  doc.text(String(nri.numero), x0 + W - 3, r1Y + 8.5, { align: 'right' })

  doc.setFontSize(6)
  doc.setFont('courier', 'normal')
  doc.setTextColor(...GRAY_BAR)
  doc.text(String(nri.numero).padStart(12, '0'), x0 + W - 3, r1Y + 11.5, { align: 'right' })

  hline(r1Y + r1H)

  // ─── Row 2: Código (pequeno, cinza) + Descrição (grande, negrito, center) ─

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY_TXT)
  doc.text(`CÓD. ${nri.codigo || ''}`, x0 + W / 2, r2Y + 5, { align: 'center' })

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLACK)
  const descRaw   = (nri.descricao || '').toUpperCase()
  const descLines = doc.splitTextToSize(descRaw, W - 6)
  if (descLines.length === 1) {
    doc.text(descLines[0], x0 + W / 2, r2Y + 14, { align: 'center' })
  } else {
    doc.text(descLines[0], x0 + W / 2, r2Y + 10, { align: 'center' })
    doc.text(descLines[1], x0 + W / 2, r2Y + 17, { align: 'center' })
  }

  hline(r2Y + r2H)

  // ─── Row 3: VENCIMENTO (esq, preto) + CURVA / CARREGAR ATÉ (dir, cinza) ──

  const rightW = 54
  const leftW  = W - rightW
  const halfH  = r3H / 2

  // Bloco esquerdo: fundo preto, texto branco
  doc.setFillColor(...BLACK)
  doc.rect(x0, r3Y, leftW, r3H, 'F')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('VENCIMENTO', x0 + leftW / 2, r3Y + 6.5, { align: 'center' })

  doc.setFontSize(32)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text(fmt2Y(nri.dataValidade), x0 + leftW / 2, r3Y + 27, { align: 'center' })

  // Bloco direito superior: CURVA
  doc.setFillColor(...GRAY_LT)
  doc.rect(x0 + leftW, r3Y, rightW, halfH, 'F')

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY_TXT)
  doc.text('CURVA', x0 + leftW + rightW / 2, r3Y + 5, { align: 'center' })

  doc.setFontSize(19)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLACK)
  doc.text(nri.curva || '', x0 + leftW + rightW / 2, r3Y + 14, { align: 'center' })

  // Divisor horizontal entre CURVA e CARREGAR ATÉ
  doc.setDrawColor(...GRAY_TXT)
  doc.setLineWidth(0.2)
  doc.line(x0 + leftW, r3Y + halfH, x0 + W, r3Y + halfH)

  // Bloco direito inferior: CARREGAR ATÉ
  doc.setFillColor(...GRAY_MID)
  doc.rect(x0 + leftW, r3Y + halfH, rightW, halfH, 'F')

  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY_TXT)
  doc.text('CARREGAR ATÉ', x0 + leftW + rightW / 2, r3Y + halfH + 5, { align: 'center' })

  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLACK)
  doc.text(fmt2Y(minus30(nri.dataValidade)), x0 + leftW + rightW / 2, r3Y + halfH + 13, { align: 'center' })

  // Divisor vertical entre blocos esq e dir
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.25)
  doc.line(x0 + leftW, r3Y, x0 + leftW, r3Y + r3H)

  hline(r3Y + r3H)

  // ─── Row 4: Informações de recebimento (4 linhas com espaçamento seguro) ──

  const lineH4 = (r4H - 4) / 4   // espaço entre linhas
  doc.setFontSize(7.5)
  doc.setTextColor(...BLACK)

  doc.setFont('helvetica', 'normal')
  doc.text(`RECEBIMENTO: ${dataRecebimento}`,                            x0 + 3, r4Y + 2 + lineH4 * 0.8)
  doc.setFont('helvetica', 'bold')
  doc.text(`RESPONSÁVEL: ${(cabecalho.operador  || '').toUpperCase()}`,  x0 + 3, r4Y + 2 + lineH4 * 1.8)
  doc.setFont('helvetica', 'normal')
  doc.text(`PLACA: ${placa}`,                                             x0 + 3, r4Y + 2 + lineH4 * 2.8)
  doc.text(`CONFERENTE: ${(cabecalho.conferente || '').toUpperCase()}`,  x0 + 3, r4Y + 2 + lineH4 * 3.8)

  hline(r4Y + r4H)

  // ─── Row 5: Rodapé table ──────────────────────────────────────────────────

  const cols = [
    { label: 'OPERADOR',  value: (cabecalho.operador  || '').toUpperCase(), w: 0.27 },
    { label: 'TURNO',     value:  cabecalho.turno      || '',               w: 0.10 },
    { label: 'HORA',      value:  horaEmissao,                              w: 0.13 },
    { label: 'ORIGEM',    value: (origem    || '').toUpperCase(),           w: 0.27 },
    { label: 'MOTORISTA', value: (motorista || '').toUpperCase(),           w: 0.23 },
  ]

  const hdrH = 5
  const datH = r5H - hdrH
  let cx = x0

  for (const col of cols) {
    const cW = col.w * W

    doc.setFillColor(...BLACK)
    doc.rect(cx, r5Y, cW, hdrH, 'F')
    doc.setFontSize(5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...WHITE)
    doc.text(col.label, cx + cW / 2, r5Y + 3.6, { align: 'center' })

    doc.setFillColor(...WHITE)
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.15)
    doc.rect(cx, r5Y + hdrH, cW, datH, 'FD')
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...BLACK)
    const v = doc.splitTextToSize(col.value, cW - 2)
    doc.text(v[0] || '', cx + cW / 2, r5Y + hdrH + datH * 0.72, { align: 'center' })

    cx += cW
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EmissaoNRI({ tarefa, pedidos, profileNome, onVoltar }) {
  const [cab, setCab]           = useState({ operador: '', conferente: profileNome, turno: '' })
  const [grupos, setGrupos]     = useState([newGrupo()])
  const [errCab, setErrCab]     = useState({})
  const [gerando, setGerando]   = useState(false)
  const [pdfUrl, setPdfUrl]     = useState(null)
  const [pdfFilename, setPdfFn] = useState('')

  // Dados automáticos da viagem
  const placa     = tarefa.viagem?.carreta?.placa ?? tarefa.viagem?.cavalo?.placa ?? ''
  const motorista = tarefa.viagem?.motorista?.nome ?? ''
  const origem    = pedidos[0]?.fabrica ?? ''

  // ─── Busca produto no catálogo ──────────────────────────────────────────────

  async function buscarProduto(idx) {
    const codigo = grupos[idx].codigo.trim()
    if (!codigo) return
    setGrupos(g => g.map((gr, i) => i === idx ? { ...gr, buscando: true, erroCodigo: null } : gr))

    const { data } = await supabase
      .from('produtos_catalogo')
      .select('codigo, descricao, caixas_pallet')
      .eq('codigo', codigo)
      .maybeSingle()

    const pedidoCurva = pedidos.find(p => p.cod_produto === codigo)

    setGrupos(g => g.map((gr, i) => {
      if (i !== idx) return gr
      if (data) {
        const cxPallet   = Number(data.caixas_pallet) || null
        const qtdeCaixas = gr.qtdePaletes && cxPallet
          ? Math.round(Number(gr.qtdePaletes) * cxPallet)
          : null
        return { ...gr, buscando: false, descricao: data.descricao, cxPallet, qtdeCaixas, curva: pedidoCurva?.curva ?? null, erroCodigo: null }
      }
      return { ...gr, buscando: false, descricao: null, cxPallet: null, qtdeCaixas: null, curva: null, erroCodigo: 'Produto não encontrado' }
    }))
  }

  function updateGrupo(idx, field, value) {
    setGrupos(g => g.map((gr, i) => {
      if (i !== idx) return gr
      const next = { ...gr, [field]: value }
      if (field === 'qtdePaletes') {
        next.qtdeCaixas = value && gr.cxPallet ? Math.round(Number(value) * gr.cxPallet) : null
      }
      return next
    }))
  }

  // ─── Validação ──────────────────────────────────────────────────────────────

  function validar() {
    const ec = {}
    if (!cab.operador.trim())   ec.operador   = true
    if (!cab.conferente.trim()) ec.conferente = true
    if (!cab.turno)             ec.turno      = true
    setErrCab(ec)

    const gruposV = grupos.map(gr => ({
      ...gr,
      erroCodigo: !gr.codigo.trim() ? 'Obrigatório' : (!gr.descricao ? (gr.erroCodigo || 'Busque o produto') : null),
      erroQtd:    !gr.qtdePaletes || Number(gr.qtdePaletes) <= 0,
      erroData:   !gr.dataValidade,
    }))
    setGrupos(gruposV)

    return Object.keys(ec).length === 0 &&
      gruposV.every(gr => !gr.erroCodigo && !gr.erroQtd && !gr.erroData)
  }

  // ─── Geração do PDF ─────────────────────────────────────────────────────────

  async function gerarPDF() {
    if (!validar()) return
    setGerando(true)
    setPdfUrl(null)

    try {
      const totalNRIs = grupos.reduce((s, gr) => s + Number(gr.qtdePaletes) * 3, 0)

      const { data: primeiro, error } = await supabase.rpc('get_next_nri_batch', { p_quantidade: totalNRIs })
      if (error) throw error

      await supabase.from('nri_emissoes').insert({
        tarefa_id:       tarefa.id,
        numero_nf:       tarefa.numero_nf,
        operador:        cab.operador.trim(),
        conferente:      cab.conferente.trim(),
        turno:           cab.turno,
        total_nris:      totalNRIs,
        primeiro_numero: primeiro,
        ultimo_numero:   primeiro + totalNRIs - 1,
      })

      // Montar lista de todas as NRIs
      const allNRIs = []
      let num = primeiro
      for (const gr of grupos) {
        const qtd = Number(gr.qtdePaletes)
        for (let p = 0; p < qtd; p++) {
          for (let n = 0; n < 3; n++) {
            allNRIs.push({
              numero:       num++,
              codigo:       gr.codigo,
              descricao:    gr.descricao,
              dataValidade: gr.dataValidade,
              curva:        gr.curva ?? '',
            })
          }
        }
      }

      const now             = new Date()
      const horaEmissao     = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      const dataRecebimento = now.toLocaleDateString('pt-BR')

      const doc     = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW   = 210
      const pageH   = 297
      const nriH    = pageH / 3   // 99mm
      const marginX = 3
      const W       = pageW - 2 * marginX  // 204mm

      const ctx = { marginX, W, dataRecebimento, horaEmissao, cabecalho: cab, placa, motorista, origem }

      for (let i = 0; i < allNRIs.length; i++) {
        const posOnPage = i % 3
        if (i > 0 && posOnPage === 0) doc.addPage()

        const yBase = posOnPage * nriH
        renderNRI(doc, { nri: allNRIs[i], yBase, ...ctx })

        // Linha tracejada entre NRIs (não após a última da página nem após a última de todas)
        const isLastOnPage = posOnPage === 2
        const isLastNRI    = i === allNRIs.length - 1
        if (!isLastOnPage && !isLastNRI) {
          const dashY = yBase + nriH - 0.5
          doc.setLineDashPattern([2, 1.5], 0)
          doc.setDrawColor(100, 100, 100)
          doc.setLineWidth(0.4)
          doc.line(marginX, dashY, pageW - marginX, dashY)
          doc.setLineDashPattern([], 0)
        }
      }

      const dateStr  = now.toISOString().slice(0, 10).replace(/-/g, '')
      const filename = `NRI_${tarefa.numero_nf}_${dateStr}.pdf`
      setPdfFn(filename)

      // Download automático
      doc.save(filename)

      // Guarda blob URL para botão Imprimir
      const blob = doc.output('blob')
      const url  = URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (err) {
      console.error('Erro ao gerar NRI:', err)
      alert('Erro ao gerar o PDF. Tente novamente.')
    } finally {
      setGerando(false)
    }
  }

  function baixarPdf() {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl
    a.download = pdfFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  function imprimirPdf() {
    if (!pdfUrl) return
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;opacity:0'
    iframe.src = pdfUrl
    document.body.appendChild(iframe)
    iframe.onload = () => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      setTimeout(() => document.body.removeChild(iframe), 2000)
    }
  }

  const totalNRIs   = grupos.reduce((s, gr) => s + (Number(gr.qtdePaletes) > 0 ? Number(gr.qtdePaletes) * 3 : 0), 0)
  const totalFolhas = Math.ceil(totalNRIs / 3)

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#EBF5FF] flex flex-col">

      {/* Header */}
      <header className="bg-cobeb-navy border-b border-blue-800 px-4 py-3 shrink-0 shadow-md shadow-cobeb-navy/20">
        <div className="flex items-center gap-3">
          <button onClick={onVoltar} className="text-blue-300/70 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10 -ml-1">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold truncate">Emissão de NRI — NF {tarefa.numero_nf}</p>
            <p className="text-blue-300/60 text-[11px] truncate">
              {motorista && `${motorista} · `}{placa || 'Placa não informada'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-blue-300/60 text-[10px]">
            <FileText size={12} />
            <span>{totalNRIs > 0 ? `${totalNRIs} NRIs · ${totalFolhas} fl.` : '—'}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-36 space-y-5">

          {/* Dados automáticos */}
          {(placa || motorista || origem) && (
            <div className="bg-white rounded-2xl border border-cobeb-border px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Dados da Viagem</p>
              <div className="grid grid-cols-3 gap-3 text-xs">
                {placa     && <div><p className="text-slate-400 text-[10px]">Placa</p><p className="text-cobeb-text font-semibold font-mono">{placa}</p></div>}
                {motorista && <div><p className="text-slate-400 text-[10px]">Motorista</p><p className="text-cobeb-text font-semibold truncate">{motorista}</p></div>}
                {origem    && <div><p className="text-slate-400 text-[10px]">Origem</p><p className="text-cobeb-text font-semibold truncate">{origem}</p></div>}
              </div>
            </div>
          )}

          {/* Cabeçalho */}
          <section className="bg-white rounded-2xl border border-cobeb-border px-4 py-4 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Cabeçalho</p>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 block mb-1.5">
                Operador do Turno <span className="text-cobeb-yellow">*</span>
              </label>
              <input
                type="text"
                value={cab.operador}
                onChange={e => setCab(c => ({ ...c, operador: e.target.value }))}
                placeholder="Nome do operador"
                className={`w-full bg-[#EBF5FF] border rounded-xl px-3 py-2.5 text-xs text-cobeb-text placeholder-slate-400 focus:outline-none focus:border-cobeb-blue transition-colors ${errCab.operador ? 'border-red-400' : 'border-cobeb-border'}`}
              />
              {errCab.operador && <p className="text-red-400 text-[10px] mt-1">Obrigatório</p>}
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 block mb-1.5">
                Conferente <span className="text-cobeb-yellow">*</span>
              </label>
              <input
                type="text"
                value={cab.conferente}
                onChange={e => setCab(c => ({ ...c, conferente: e.target.value }))}
                placeholder="Nome do conferente"
                className={`w-full bg-[#EBF5FF] border rounded-xl px-3 py-2.5 text-xs text-cobeb-text placeholder-slate-400 focus:outline-none focus:border-cobeb-blue transition-colors ${errCab.conferente ? 'border-red-400' : 'border-cobeb-border'}`}
              />
              {errCab.conferente && <p className="text-red-400 text-[10px] mt-1">Obrigatório</p>}
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 block mb-2">
                Turno <span className="text-cobeb-yellow">*</span>
              </label>
              <div className="flex gap-2">
                {['A', 'B', 'C'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setCab(c => ({ ...c, turno: t }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                      cab.turno === t
                        ? 'bg-cobeb-navy text-white border-cobeb-navy'
                        : errCab.turno
                        ? 'bg-white text-red-400 border-red-400/50'
                        : 'bg-white text-slate-500 border-cobeb-border hover:border-cobeb-blue/50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {errCab.turno && <p className="text-red-400 text-[10px] mt-1">Selecione o turno</p>}
            </div>
          </section>

          {/* Grupos de produto */}
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Produtos</p>
              <span className="text-[10px] text-slate-400">{grupos.length} grupo(s)</span>
            </div>

            <div className="space-y-4">
              {grupos.map((gr, idx) => (
                <div key={gr._id} className="bg-white rounded-2xl border border-cobeb-border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-cobeb-border/60 bg-[#EBF5FF]/50">
                    <span className="text-[11px] font-semibold text-cobeb-navy">Produto {idx + 1}</span>
                    {grupos.length > 1 && (
                      <button onClick={() => setGrupos(g => g.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-red-400 transition-colors p-1">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <div className="px-4 py-4 space-y-4">
                    {/* Código */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 block mb-1.5">
                        Código do Produto <span className="text-cobeb-yellow">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={gr.codigo}
                          onChange={e => updateGrupo(idx, 'codigo', e.target.value)}
                          onBlur={() => buscarProduto(idx)}
                          placeholder="Ex: 38026"
                          className={`flex-1 bg-[#EBF5FF] border rounded-xl px-3 py-2.5 text-xs font-mono text-cobeb-text placeholder-slate-400 focus:outline-none focus:border-cobeb-blue transition-colors ${gr.erroCodigo ? 'border-red-400' : 'border-cobeb-border'}`}
                        />
                        <button
                          type="button"
                          onClick={() => buscarProduto(idx)}
                          disabled={gr.buscando || !gr.codigo.trim()}
                          className="px-3 py-2.5 bg-cobeb-navy text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors whitespace-nowrap"
                        >
                          {gr.buscando ? <Loader2 size={12} className="animate-spin" /> : 'Buscar'}
                        </button>
                      </div>
                      {gr.descricao && (
                        <p className="text-cobeb-text text-xs mt-1.5 font-medium">{gr.descricao}</p>
                      )}
                      {gr.erroCodigo && (
                        <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                          <AlertCircle size={10} />{gr.erroCodigo}
                        </p>
                      )}
                      {gr.curva && (
                        <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded leading-none ${
                          gr.curva === 'A' ? 'bg-cobeb-navy/10 text-cobeb-yellow' :
                          gr.curva === 'B' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-slate-500/10 text-slate-500'
                        }`}>
                          Curva {gr.curva}
                        </span>
                      )}
                    </div>

                    {/* Quantidade */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 block mb-1.5">
                        Qtde de Paletes <span className="text-cobeb-yellow">*</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={gr.qtdePaletes}
                          onChange={e => updateGrupo(idx, 'qtdePaletes', e.target.value)}
                          placeholder="0"
                          className={`w-24 bg-[#EBF5FF] border rounded-xl px-3 py-2.5 text-xs text-right text-cobeb-text focus:outline-none focus:border-cobeb-blue transition-colors ${gr.erroQtd ? 'border-red-400' : 'border-cobeb-border'}`}
                        />
                        <span className="text-slate-500 text-xs">plt</span>
                        {gr.qtdeCaixas !== null && (
                          <span className="text-slate-400 text-xs">= {gr.qtdeCaixas.toLocaleString('pt-BR')} cx</span>
                        )}
                        {gr.qtdePaletes && Number(gr.qtdePaletes) > 0 && (
                          <span className="text-cobeb-navy/60 text-[10px] ml-auto">
                            → {Number(gr.qtdePaletes) * 3} NRIs
                          </span>
                        )}
                      </div>
                      {gr.erroQtd && <p className="text-red-400 text-[10px] mt-1">Informe uma quantidade válida</p>}
                    </div>

                    {/* Data de validade */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 block mb-1.5">
                        Data de Validade <span className="text-cobeb-yellow">*</span>
                      </label>
                      <input
                        type="date"
                        value={gr.dataValidade}
                        onChange={e => updateGrupo(idx, 'dataValidade', e.target.value)}
                        className={`bg-[#EBF5FF] border rounded-xl px-3 py-2.5 text-xs text-cobeb-text focus:outline-none focus:border-cobeb-blue transition-colors [color-scheme:light] ${gr.erroData ? 'border-red-400' : 'border-cobeb-border'}`}
                      />
                      {gr.dataValidade && (
                        <p className="text-slate-400 text-[10px] mt-1">
                          Carregar até: {fmt4Y(minus30(gr.dataValidade))}
                        </p>
                      )}
                      {gr.erroData && <p className="text-red-400 text-[10px] mt-1">Obrigatório</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setGrupos(g => [...g, newGrupo()])}
              className="mt-3 w-full border-2 border-dashed border-cobeb-border hover:border-cobeb-blue/40 text-slate-500 hover:text-cobeb-navy text-xs font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={14} />Adicionar Produto
            </button>
          </section>

          {/* Resultado */}
          {pdfUrl && (
            <section className="bg-green-500/10 border border-green-500/30 rounded-2xl px-4 py-4 space-y-3">
              <p className="text-green-400 text-xs font-semibold flex items-center gap-2">
                <FileText size={13} />
                PDF gerado — {totalNRIs} NRIs · {totalFolhas} folha(s)
              </p>
              <p className="text-slate-500 text-[10px] font-mono">{pdfFilename}</p>
              <div className="flex gap-3">
                <button onClick={baixarPdf}
                  className="flex-1 bg-cobeb-navy text-white text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-cobeb-blue transition-colors">
                  <Download size={13} />Baixar PDF
                </button>
                <button onClick={imprimirPdf}
                  className="flex-1 border border-cobeb-border text-cobeb-navy text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-cobeb-navy/5 transition-colors">
                  <Printer size={13} />Imprimir
                </button>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-cobeb-border px-4 py-3 z-30">
        <div className="max-w-lg mx-auto flex gap-3">
          <button onClick={onVoltar}
            className="flex-1 border border-cobeb-border text-slate-500 text-sm font-semibold py-3 rounded-2xl transition-colors hover:bg-[#EBF5FF]">
            Voltar à Lista
          </button>
          <button
            onClick={gerarPDF}
            disabled={gerando}
            className="flex-1 bg-cobeb-navy hover:bg-cobeb-blue disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            {gerando
              ? <><Loader2 size={15} className="animate-spin" />Gerando...</>
              : <><FileText size={15} />{pdfUrl ? 'Gerar Novamente' : 'Gerar NRI'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
