import { useRef, useEffect, useCallback } from 'react'
import { registerPlugin } from '@capacitor/core'
import { supabase } from '../lib/supabase'

// Proxy para o plugin nativo — não importa o pacote npm (sem JS entry),
// usa o bridge do Capacitor registrado pelo sync do Android.
const BackgroundGeolocation = registerPlugin('BackgroundGeolocation')

// ── Detecção de ambiente nativo ───────────────────────────────────────────────

export const IS_NATIVE_APP =
  typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true

// ── Haversine: distância em metros entre dois pontos GPS ──────────────────────

function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R  = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Gerencia rastreamento GPS em background (Capacitor) ou foreground (browser).
 *
 * @param {string|null}   viagemId      - ID da viagem ativa
 * @param {React.Ref}     statusRef     - Ref que aponta para o status atual da viagem
 * @param {Array}         fabricasAlvo  - Unidades tipo 'fabrica' com lat/lng/raio_geofence
 * @param {boolean}       isOnline      - Estado de conectividade
 * @param {Function}      onMudarStatus - Chamado com o objeto etapa ao detectar transição
 */
export function useRastreamento({ viagemId, statusRef, fabricasAlvo, isOnline, onMudarStatus }) {
  const ativoRef        = useRef(false)
  const watcherIdRef    = useRef(null)   // ID do watcher (nativo ou browser)
  const syncTimerRef    = useRef(null)   // setInterval para sync de 30s
  const posRef          = useRef(null)   // última posição conhecida
  const dentroFabRef    = useRef(false)  // está dentro do geofence de alguma fábrica?
  const callbackRef     = useRef(null)   // ref para onMudarStatus (evita stale closure)
  const viagemIdRef     = useRef(null)   // ref para viagemId (evita stale closure)
  const isOnlineRef     = useRef(isOnline)

  // Mantém refs atualizadas a cada render
  callbackRef.current  = onMudarStatus
  viagemIdRef.current  = viagemId
  isOnlineRef.current  = isOnline

  // ── Inicializar estado de geofence com status atual ─────────────────────────
  useEffect(() => {
    dentroFabRef.current = statusRef.current === 'na_fabrica'
  }, [statusRef.current])

  // ── Sync posição para Supabase ──────────────────────────────────────────────

  const sincronizar = useCallback(async () => {
    const pos = posRef.current
    const vid = viagemIdRef.current
    if (!pos || !vid || !isOnlineRef.current) return
    await supabase
      .from('viagens')
      .update({
        motorista_lat:          pos.lat,
        motorista_lng:          pos.lng,
        motorista_last_seen_at: new Date().toISOString(),
      })
      .eq('id', vid)
  }, [])

  // ── Lógica de geofence ──────────────────────────────────────────────────────

  function processarPosicao(lat, lng) {
    posRef.current = { lat, lng }

    const status = statusRef.current
    if (!fabricasAlvo?.length) return

    const dentroAgora = fabricasAlvo.some(f => {
      if (!f.latitude || !f.longitude) return false
      return distanciaMetros(lat, lng, parseFloat(f.latitude), parseFloat(f.longitude))
             <= (f.raio_geofence || 100)
    })

    // Entrou na fábrica
    if (dentroAgora && !dentroFabRef.current && status === 'em_transito') {
      dentroFabRef.current = true
      callbackRef.current?.({
        key:        'chegada_fabrica',
        field:      'dt_chegada_fabrica',
        nextStatus: 'na_fabrica',
        requireNF:  false,
        closeCycle: false,
      })
    }

    // Saiu da fábrica
    if (!dentroAgora && dentroFabRef.current && status === 'na_fabrica') {
      dentroFabRef.current = false
      callbackRef.current?.({
        key:        'saida_fabrica',
        field:      'dt_saida_fabrica',
        nextStatus: 'retornando',
        requireNF:  false,
        closeCycle: false,
      })
    }
  }

  // ── Iniciar rastreamento ────────────────────────────────────────────────────

  async function iniciar() {
    if (ativoRef.current) return
    ativoRef.current = true

    // Sync imediata + timer de 30s
    sincronizar()
    syncTimerRef.current = setInterval(sincronizar, 30000)

    if (IS_NATIVE_APP) {
      // ── Background via Capacitor bridge ────────────────────────────────────
      try {
        const id = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage:  'COBEB está rastreando sua localização',
            backgroundTitle:    'COBEB Ciclo — Rastreamento ativo',
            requestPermissions: true,
            stale:              false,
            distanceFilter:     20,
          },
          (location, error) => {
            if (error) {
              if (error.code === 'NOT_AUTHORIZED') BackgroundGeolocation.openSettings()
              return
            }
            if (location) processarPosicao(location.latitude, location.longitude)
          }
        )

        watcherIdRef.current = { type: 'capacitor', id }
      } catch (err) {
        console.error('[Rastreamento] Erro ao iniciar plugin nativo:', err)
      }

    } else {
      // ── Fallback browser (foreground only, para testes) ─────────────────────
      if (!navigator.geolocation) return

      const watchId = navigator.geolocation.watchPosition(
        pos => processarPosicao(pos.coords.latitude, pos.coords.longitude),
        err => console.warn('[Rastreamento] Erro GPS:', err),
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      )

      watcherIdRef.current = { type: 'browser', id: watchId }
    }
  }

  // ── Parar rastreamento ──────────────────────────────────────────────────────

  async function parar() {
    if (!ativoRef.current) return
    ativoRef.current = false

    clearInterval(syncTimerRef.current)
    syncTimerRef.current = null

    await sincronizar() // sync final antes de parar

    const w = watcherIdRef.current
    if (!w) return

    if (w.type === 'capacitor' && w.id) {
      try { await BackgroundGeolocation.removeWatcher({ id: w.id }) } catch {}
    } else if (w.type === 'browser') {
      navigator.geolocation.clearWatch(w.id)
    }

    watcherIdRef.current = null

    // Limpa posição no Supabase ao encerrar viagem
    const vid = viagemIdRef.current
    if (vid && isOnlineRef.current) {
      await supabase.from('viagens').update({
        motorista_lat:          null,
        motorista_lng:          null,
        motorista_last_seen_at: null,
      }).eq('id', vid)
    }
  }

  // Cleanup ao desmontar componente
  useEffect(() => {
    return () => {
      if (ativoRef.current) parar()
    }
  }, [])

  return { iniciar, parar }
}
