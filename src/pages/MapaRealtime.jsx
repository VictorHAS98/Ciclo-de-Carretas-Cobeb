import { useState, useEffect, useMemo, Fragment } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ChevronLeft, ChevronDown, ChevronUp, Truck, AlertTriangle, Navigation } from 'lucide-react'
import { supabase } from '../lib/supabase'

// ── Configuração de status (espelha EstoqueRealtime) ─────────────────────────

const STATUS_LABEL = {
  iniciada:               'Aguardando Saída',
  em_transito:            'Em Rota p/ Fábrica',
  na_fabrica:             'Na Fábrica',
  retornando:             'Retornando',
  aguardando_conferencia: 'Chegou',
}

const STATUS_COR = {
  iniciada:               'bg-slate-100 text-slate-500 border-slate-200',
  em_transito:            'bg-blue-50 text-blue-500 border-blue-200',
  na_fabrica:             'bg-blue-50 text-blue-600 border-blue-200',
  retornando:             'bg-yellow-50 text-yellow-600 border-yellow-200',
  aguardando_conferencia: 'bg-green-50 text-green-600 border-green-200',
}

// ── Ícones personalizados via DivIcon ────────────────────────────────────────

function criarIcone(tipo) {
  const cor   = tipo === 'revenda' ? '#003DA5' : '#F97316'
  const letra = tipo === 'revenda' ? 'R' : 'F'
  return L.divIcon({
    html: `<div style="
      width:36px;height:36px;
      background:${cor};
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 2px 10px rgba(0,0,0,0.35);
      display:flex;align-items:center;justify-content:center;
      color:white;font-weight:900;font-size:15px;font-family:system-ui,sans-serif;
    ">${letra}</div>`,
    className: '',
    iconSize:    [36, 36],
    iconAnchor:  [18, 18],
    popupAnchor: [0, -22],
  })
}

// ── Ajusta o mapa para mostrar todos os marcadores ───────────────────────────

function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) {
      const bounds = L.latLngBounds(positions)
      map.fitBounds(bounds, { padding: [60, 60] })
    } else if (positions.length === 1) {
      map.setView(positions[0], 12)
    }
  }, [positions.length]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function MapaRealtime({ onVoltar }) {
  const [unidades,     setUnidades]     = useState([])
  const [viagens,      setViagens]      = useState([])
  const [loading,      setLoading]      = useState(true)
  const [painelAberto, setPainelAberto] = useState(false)

  useEffect(() => {
    carregar()
    const timer = setInterval(carregarViagens, 30000)
    return () => clearInterval(timer)
  }, [])

  async function carregar() {
    const [{ data: u }, { data: v }] = await Promise.all([
      supabase
        .from('unidades')
        .select('id, nome, tipo, endereco, latitude, longitude, raio_geofence, ativo')
        .eq('ativo', true)
        .not('latitude', 'is', null),
      supabase.rpc('get_painel_viagens'),
    ])
    setUnidades(u ?? [])
    setViagens(v ?? [])
    setLoading(false)
  }

  async function carregarViagens() {
    const { data } = await supabase.rpc('get_painel_viagens')
    if (data) setViagens(data)
  }

  const { centro, posicoes } = useMemo(() => {
    if (!unidades.length) return { centro: [-19.88, -44.61], posicoes: [] }
    const pos = unidades.map(u => [parseFloat(u.latitude), parseFloat(u.longitude)])
    const lat  = pos.reduce((s, p) => s + p[0], 0) / pos.length
    const lng  = pos.reduce((s, p) => s + p[1], 0) / pos.length
    return { centro: [lat, lng], posicoes: pos }
  }, [unidades])

  const urgentes = viagens.filter(v => v.status === 'retornando').length

  return (
    <div className="absolute inset-0 overflow-hidden">

      {/* Spinner de carregamento inicial */}
      {loading && (
        <div className="absolute inset-0 bg-[#EBF5FF] flex flex-col items-center justify-center z-[1000] gap-3">
          <div className="w-8 h-8 border-2 border-cobeb-navy border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Carregando mapa...</p>
        </div>
      )}

      {/* Mapa Leaflet */}
      <MapContainer
        center={centro}
        zoom={9}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {posicoes.length > 0 && <FitBounds positions={posicoes} />}

        {unidades.map(u => (
          <Fragment key={u.id}>
            <Circle
              center={[parseFloat(u.latitude), parseFloat(u.longitude)]}
              radius={u.raio_geofence}
              pathOptions={{
                color:       u.tipo === 'revenda' ? '#003DA5' : '#F97316',
                fillColor:   u.tipo === 'revenda' ? '#003DA5' : '#F97316',
                fillOpacity: 0.07,
                weight:      1.5,
                dashArray:   '5 5',
              }}
            />
            <Marker
              position={[parseFloat(u.latitude), parseFloat(u.longitude)]}
              icon={criarIcone(u.tipo)}
            >
              <Popup>
                <div style={{ minWidth: 180, fontFamily: 'system-ui, sans-serif' }}>
                  <p style={{ fontWeight: 700, color: '#1E3A6E', fontSize: 13, marginBottom: 4 }}>{u.nome}</p>
                  <p style={{
                    fontSize: 11, fontWeight: 600, marginBottom: 6,
                    color: u.tipo === 'revenda' ? '#003DA5' : '#F97316',
                  }}>
                    {u.tipo === 'revenda' ? '🏢 Revenda' : '🏭 Fábrica'}
                  </p>
                  {u.endereco && (
                    <p style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{u.endereco}</p>
                  )}
                  <p style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
                    {parseFloat(u.latitude).toFixed(5)}, {parseFloat(u.longitude).toFixed(5)}
                  </p>
                  <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                    Geofence: {u.raio_geofence}m
                  </p>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        ))}
      </MapContainer>

      {/* Botão Voltar — flutuante sobre o mapa */}
      <div className="absolute top-3 left-3 z-[999]">
        <button
          onClick={onVoltar}
          className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-cobeb-border rounded-xl shadow-md px-3 py-2 text-cobeb-navy text-sm font-semibold hover:bg-white transition-colors"
        >
          <ChevronLeft size={16} />
          Voltar
        </button>
      </div>

      {/* Legenda — flutuante topo direito */}
      <div className="absolute top-3 right-3 z-[999] bg-white/95 backdrop-blur-sm border border-cobeb-border rounded-xl shadow-md px-3 py-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-cobeb-navy border-2 border-white shadow-sm shrink-0" />
          <span className="text-[11px] text-cobeb-text font-semibold">Revenda</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-white shadow-sm shrink-0" />
          <span className="text-[11px] text-cobeb-text font-semibold">Fábrica</span>
        </div>
        <div className="border-t border-cobeb-border/50 pt-1.5 flex items-center gap-2">
          <Truck size={11} className="text-cobeb-navy shrink-0" />
          <span className="text-[11px] text-slate-500">{viagens.length} ativo{viagens.length !== 1 ? 's' : ''}</span>
          {urgentes > 0 && (
            <span className="text-[10px] text-yellow-600 font-bold">⚠ {urgentes}</span>
          )}
        </div>
      </div>

      {/* Painel de viagens — barra inferior */}
      <div className="absolute bottom-0 left-0 right-0 z-[999]">
        <div className="bg-white/95 backdrop-blur-sm border-t border-cobeb-border shadow-xl">

          {/* Handle / cabeçalho colapsável */}
          <button
            onClick={() => setPainelAberto(p => !p)}
            className="w-full flex items-center justify-between px-5 py-3"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Truck size={14} className="text-cobeb-navy shrink-0" />
              <span className="text-cobeb-text text-sm font-semibold">
                {viagens.length} veículo{viagens.length !== 1 ? 's' : ''} ativo{viagens.length !== 1 ? 's' : ''}
              </span>
              {urgentes > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                  <AlertTriangle size={9} />
                  {urgentes} retornando
                </span>
              )}
            </div>
            {painelAberto
              ? <ChevronDown size={16} className="text-slate-400 shrink-0" />
              : <ChevronUp   size={16} className="text-slate-400 shrink-0" />
            }
          </button>

          {/* Lista de viagens expandida */}
          {painelAberto && (
            <div className="max-h-52 overflow-y-auto border-t border-cobeb-border/40">
              {viagens.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-5">Nenhum veículo ativo no momento</p>
              ) : viagens.map(v => (
                <div key={v.id} className="px-5 py-2.5 flex items-center justify-between gap-3 border-b border-cobeb-border/30 last:border-0">
                  <div className="min-w-0">
                    <p className="text-cobeb-text text-xs font-bold font-mono">
                      {v.placa_cavalo ?? '—'}{v.placa_carreta ? ` · ${v.placa_carreta}` : ''}
                    </p>
                    {v.motorista_nome && (
                      <p className="text-slate-400 text-[10px] truncate">{v.motorista_nome}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${STATUS_COR[v.status] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                    {STATUS_LABEL[v.status] ?? v.status}
                  </span>
                </div>
              ))}
              <div className="px-5 py-2 text-center border-t border-cobeb-border/20">
                <p className="text-[10px] text-slate-300 flex items-center justify-center gap-1">
                  <Navigation size={9} />
                  Rastreamento GPS em breve
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
