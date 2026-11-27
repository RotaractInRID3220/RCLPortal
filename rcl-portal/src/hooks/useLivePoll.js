'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Live data without client caching: fetches now, then every `intervalMs` while the tab is visible
 * (and once more when it becomes visible again). Nothing is stored in localStorage; the server
 * answers 304 through ETag while nothing changed, so polling is cheap.
 * `fetcher` must return { success, data, error?, version? } like the leaderboard services.
 */
export function useLivePoll(fetcher, deps = [], { intervalMs = 20_000, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: true, error: null, updatedAt: null, version: null })
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const load = useCallback(async () => {
    const result = await fetcherRef.current()
    setState((prev) => result.success
      ? { data: result.data, loading: false, error: null, updatedAt: new Date(), version: result.version ?? null, extra: result }
      : { ...prev, loading: false, error: result.error || 'Failed to load', extra: result })
    return result
  }, [])

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    let timer
    setState({ data: null, loading: true, error: null, updatedAt: null, version: null })
    const tick = async () => {
      if (cancelled) return
      if (document.visibilityState === 'visible') await load()
      if (!cancelled) timer = setTimeout(tick, intervalMs)
    }
    const onVisible = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); tick() } }
    tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => { cancelled = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, load, ...deps])

  return { ...state, refresh: load }
}
