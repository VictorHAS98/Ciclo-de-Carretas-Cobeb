const QUEUE_KEY  = 'cobeb_offline_queue'
const VIAGEM_KEY = 'cobeb_viagem_cache'

// ── Action queue ──────────────────────────────────────────────────────────────

export function saveOfflineAction(action) {
  const queue = getOfflineQueue()
  queue.push({ ...action, queued_at: new Date().toISOString() })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') }
  catch { return [] }
}

export function clearOfflineQueue() {
  localStorage.removeItem(QUEUE_KEY)
}

export function hasOfflineActions() {
  return getOfflineQueue().length > 0
}

// ── Viagem cache (allows viewing trip info while offline) ─────────────────────

export function cacheViagem(viagem) {
  if (viagem) localStorage.setItem(VIAGEM_KEY, JSON.stringify(viagem))
  else        localStorage.removeItem(VIAGEM_KEY)
}

export function getCachedViagem() {
  try { return JSON.parse(localStorage.getItem(VIAGEM_KEY) ?? 'null') }
  catch { return null }
}
