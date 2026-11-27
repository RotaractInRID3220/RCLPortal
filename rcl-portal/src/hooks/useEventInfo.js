'use client'
import { useEffect, useState } from 'react'

/**
 * Public event dates (registration window, replacement window, event start, day labels) as set by
 * a super admin. Always fetched fresh, never cached in the browser. `null` while loading.
 * Unset dates come back as `null` and mean "not scheduled yet".
 */
export function useEventInfo() {
  const [info, setInfo] = useState(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/public/event-info', { cache: 'no-store' })
      .then((r) => r.json())
      .then((b) => { if (!cancelled && b?.success) setInfo(b.data) })
      .catch((e) => console.error('Could not load event dates:', e))
    return () => { cancelled = true }
  }, [])
  return info
}

export const toDate = (iso) => (iso ? new Date(iso) : null)

/** Dates are shown in Sri Lanka time whatever the visitor's browser is set to. */
export const formatColombo = (iso) =>
  iso ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : 'not announced yet'

/**
 * Event days from the database as [{ value, label }], plus the day check-in is currently set to and
 * whether it is open. Replaces the old hard-coded SPORT_DAYS / CURRENT_SPORT_DAY.
 */
export function useSportDays() {
  const info = useEventInfo()
  return {
    loading: info === null,
    days: (info?.days ?? []).map((d) => ({ value: d.day_code, label: d.label })),
    currentDay: info?.checkinDay ?? null,
    checkinOpen: info?.checkinOpen === true,
  }
}
