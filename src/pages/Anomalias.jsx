import { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw, MapPin, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AdminLayout from '../components/AdminLayout'

function formatTs(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function Anomalias() {
  const [anomalias, setAnomalias]           = useState([])
  const [unidades, setUnidades]             = useState([])
  const [loading, setLoading]               = useState(true)
  const [filtroUnidade, setFiltroUnidade]   = useState('')
  const [fotoAmpliada, setFotoAmpliada]     = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: anos }, { data: uns }] = await Promise.all([
      supabase
        .from('anomalias')
        .select(`
          *,
          tarefa:tarefas(numero_nf),
          pedido:pedidos(descricao, cod_produto),
          conferente:profiles(nome),
          unidade:unidades(id, nome, cidade)
        `)
        .order('created_at', { ascending: false }),
      supabase.from('unidades').select('*').eq('ativo', true).order('nome'),
    ])
    setAnomalias(anos ?? [])
    setUnidades(uns ?? [])
    setLoading(false)
  }

  const anomaliasFiltradas = filtroUnidade
    ? anomalias.filter(a => a.unidade_id === filtroUnidade)
    : anomalias

  return (
    <AdminLayout title="Anomalias">
      <div className="max-w-2xl mx-auto px-4 pt-5 pb-8 space-y-5">

        {/* Header strip */}
        <div className="flex items-center justify-between">
          <p className="text-slate-500 text-xs">
            {anomaliasFiltradas.length} anomalia(s)
          </p>
          <button onClick={load} className="text-slate-500 hover:text-cobeb-yellow transition-colors">
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Unidade filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {[{ id: '', nome: 'Todas', cidade: '' }, ...unidades].map(u => {
            const active = filtroUnidade === u.id
            return (
              <button
                key={u.id}
                onClick={() => setFiltroUnidade(u.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
                  active
                    ? 'bg-cobeb-navy border-orange-500 text-white'
                    : 'bg-transparent border-cobeb-border text-slate-500 hover:border-cobeb-blue/40'
                }`}
              >
                {u.id ? (
                  <><MapPin size={9} />{u.nome}{u.cidade ? ` — ${u.cidade}` : ''}</>
                ) : 'Todas'}
              </button>
            )
          })}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : anomaliasFiltradas.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-white border border-cobeb-border flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-cobeb-border" />
            </div>
            <p className="text-slate-500 text-sm font-medium">Nenhuma anomalia registrada</p>
            <p className="text-cobeb-border text-xs mt-1">As anomalias aparecem durante a conferência de chegada</p>
          </div>
        ) : (
          <div className="space-y-4">
            {anomaliasFiltradas.map(ano => (
              <div key={ano.id} className="bg-white rounded-2xl border border-orange-500/20 overflow-hidden">
                <div className="px-4 py-3 border-b border-cobeb-border/50">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {ano.tarefa?.numero_nf && (
                          <span className="text-cobeb-yellow font-semibold text-sm">NF {ano.tarefa.numero_nf}</span>
                        )}
                        {ano.unidade && (
                          <span className="text-slate-500 text-[10px] flex items-center gap-1">
                            <MapPin size={9} />{ano.unidade.nome}{ano.unidade.cidade ? ` — ${ano.unidade.cidade}` : ''}
                          </span>
                        )}
                      </div>
                      {ano.pedido && (
                        <p className="text-slate-500 text-[10px] font-mono mb-1.5">
                          {ano.pedido.cod_produto} — {ano.pedido.descricao}
                        </p>
                      )}
                      <p className="text-cobeb-text text-xs leading-relaxed">{ano.descricao}</p>
                      {ano.conferente?.nome && (
                        <p className="text-slate-500 text-[10px] mt-1.5">Conferente: {ano.conferente.nome}</p>
                      )}
                    </div>
                    <span className="text-slate-500 text-[10px] shrink-0 whitespace-nowrap">{formatTs(ano.created_at)}</span>
                  </div>
                </div>

                {/* Photos */}
                {ano.fotos?.length > 0 && (
                  <div className="flex gap-3 px-4 py-3">
                    {ano.fotos.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setFotoAmpliada(url)}
                        className="w-20 h-20 rounded-xl overflow-hidden border border-cobeb-border shrink-0 hover:border-cobeb-blue/40 transition-colors"
                      >
                        <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <button className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10">
            <X size={24} />
          </button>
          <img
            src={fotoAmpliada}
            alt="Foto anomalia"
            className="max-w-full max-h-full rounded-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </AdminLayout>
  )
}
