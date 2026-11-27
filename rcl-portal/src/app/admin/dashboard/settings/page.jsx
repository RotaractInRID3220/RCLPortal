'use client'

import { useCallback, useEffect, useState } from 'react'
import PrivateRoute from '@/lib/PrivateRoute'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatColombo } from '@/hooks/useEventInfo'

const GROUPS = [
  ['dates', 'Dates (Sri Lanka time)'],
  ['checkin', 'Day check-in'],
  ['money', 'Fees'],
  ['points', 'Points'],
  ['penalty', 'Membership penalty'],
  ['limits', 'Registration limits per player'],
  ['system', 'System'],
]
const LIMIT_GROUPS = [['standard', 'Team / individual events'], ['track', 'Track, shot put, discus'], ['swimming', 'Swimming']]

// datetime-local <-> ISO, always in Sri Lanka time (UTC+05:30) whatever the browser's time zone is
const toLocalInput = (iso) => {
  if (!iso) return ''
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}
const fromLocalInput = (v) => (v ? `${v}:00+05:30` : null)

async function api(path, init) {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json' } })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) throw new Error(body?.error || `Request failed (${res.status})`)
  return body.data
}

function SettingEditor({ setting, days, onSave, onClear, busy }) {
  const [draft, setDraft] = useState(null)
  useEffect(() => {
    const v = setting.value
    if (setting.type === 'datetime') setDraft(toLocalInput(v))
    else if (setting.type === 'numbers') setDraft((v ?? []).join(', '))
    else if (setting.type === 'tiers') setDraft((v ?? []).map((t) => ({ lt: String(t.lt), points: String(t.points) })))
    else if (setting.type === 'limits') setDraft(Object.fromEntries(LIMIT_GROUPS.map(([g]) => [g, { per: v?.[g]?.per ?? 'day', max: String(v?.[g]?.max ?? 1) }])))
    else setDraft(v ?? (setting.type === 'boolean' ? false : ''))
  }, [setting])
  if (draft === null) return null

  const build = () => {
    switch (setting.type) {
      case 'datetime': return fromLocalInput(draft)
      case 'number': return draft === '' ? NaN : Number(draft)
      case 'numbers': return draft.split(',').map((x) => Number(x.trim()))
      case 'boolean': return Boolean(draft)
      case 'day': return draft
      case 'tiers': return draft.map((t) => ({ lt: Number(t.lt), points: Number(t.points) }))
      case 'limits': return Object.fromEntries(Object.entries(draft).map(([g, r]) => [g, { per: r.per, max: Number(r.max) }]))
      default: return draft
    }
  }
  const field = 'h-9 bg-black/20 border-white/20 text-white'
  return (
    <div className="py-4 border-b border-white/10 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white">{setting.label}</p>
          {setting.help && <p className="text-xs text-white/50 mt-0.5">{setting.help}</p>}
          {setting.unconfirmed && (
            <Badge className="mt-1 border bg-yellow-500/20 text-yellow-200 border-yellow-400 text-xs">Default value, not confirmed yet</Badge>
          )}
          <p className="text-xs text-white/40 mt-1">
            {setting.isSet ? `Last saved ${formatColombo(setting.updated_at)}${setting.updated_by ? ` by member ${setting.updated_by}` : ''}` : 'Not set'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {setting.type === 'datetime' && <Input type="datetime-local" value={draft} onChange={(e) => setDraft(e.target.value)} className={`${field} w-56`} />}
          {setting.type === 'number' && <Input type="number" step="any" value={draft} onChange={(e) => setDraft(e.target.value)} className={`${field} w-32`} />}
          {setting.type === 'numbers' && <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="100, 75, 50" className={`${field} w-48`} />}
          {setting.type === 'boolean' && (
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input type="checkbox" checked={Boolean(draft)} onChange={(e) => setDraft(e.target.checked)} /> {draft ? 'On' : 'Off'}
            </label>
          )}
          {setting.type === 'day' && (
            <select value={draft} onChange={(e) => setDraft(e.target.value)} className={`${field} rounded-md px-2`}>
              <option value="">Choose a day…</option>
              {days.map((d) => <option key={d.day_code} value={d.day_code}>{d.label} ({d.day_code})</option>)}
            </select>
          )}
          {setting.type !== 'tiers' && setting.type !== 'limits' && (
            <Button size="sm" disabled={busy} onClick={() => onSave(setting.key, build())} className="bg-cranberry hover:bg-cranberry/80">{setting.unconfirmed ? 'Confirm' : 'Save'}</Button>
          )}
          {setting.clearable && setting.isSet && <Button size="sm" variant="outline" disabled={busy} onClick={() => onClear(setting.key)}>Clear</Button>}
        </div>
      </div>

      {setting.type === 'tiers' && (
        <div className="mt-3 space-y-2">
          {draft.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-white/80">
              If the general-member share is below <Input type="number" value={t.lt} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, lt: e.target.value } : x)))} className={`${field} w-20`} /> %
              → points <Input type="number" value={t.points} onChange={(e) => setDraft(draft.map((x, j) => (j === i ? { ...x, points: e.target.value } : x)))} className={`${field} w-24`} />
              <Button size="sm" variant="outline" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setDraft([...draft, { lt: '', points: '' }])}>Add tier</Button>
            <Button size="sm" disabled={busy} onClick={() => onSave(setting.key, build())} className="bg-cranberry hover:bg-cranberry/80">{setting.unconfirmed ? 'Confirm tiers' : 'Save tiers'}</Button>
          </div>
          <p className="text-xs text-white/40">The lowest threshold the share is below applies. At or above every threshold there is no penalty.</p>
        </div>
      )}

      {setting.type === 'limits' && (
        <div className="mt-3 space-y-2">
          {LIMIT_GROUPS.map(([g, label]) => (
            <div key={g} className="flex flex-wrap items-center gap-2 text-sm text-white/80">
              <span className="w-56">{label}</span> at most
              <Input type="number" min="0" value={draft[g].max} onChange={(e) => setDraft({ ...draft, [g]: { ...draft[g], max: e.target.value } })} className={`${field} w-20`} />
              <select value={draft[g].per} onChange={(e) => setDraft({ ...draft, [g]: { ...draft[g], per: e.target.value } })} className={`${field} rounded-md px-2`}>
                <option value="day">per day</option>
                <option value="total">in total</option>
              </select>
            </div>
          ))}
          <Button size="sm" disabled={busy} onClick={() => onSave(setting.key, build())} className="bg-cranberry hover:bg-cranberry/80">{setting.unconfirmed ? 'Confirm limits' : 'Save limits'}</Button>
        </div>
      )}
    </div>
  )
}

function DaysEditor({ days, reload }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  useEffect(() => setRows(days.map((d) => ({ ...d, sort_order: String(d.sort_order), event_date: d.event_date ? String(d.event_date).slice(0, 10) : '' }))), [days])
  const field = 'h-9 bg-black/20 border-white/20 text-white'
  const save = async (r) => {
    setBusy(true)
    try { await api('/api/admin/event-days', { method: 'PUT', body: JSON.stringify({ day_code: r.day_code.trim(), label: r.label, sort_order: Number(r.sort_order), event_date: r.event_date || null }) }); toast.success('Day saved'); await reload() }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const del = async (r) => {
    setBusy(true)
    try { await api(`/api/admin/event-days?day_code=${encodeURIComponent(r.day_code)}`, { method: 'DELETE' }); toast.success('Day deleted'); await reload() }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const set = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={r.day_code || `new-${i}`} className="flex flex-wrap items-center gap-2">
          <Input value={r.day_code} disabled={!r.isNew} onChange={(e) => set(i, { day_code: e.target.value })} placeholder="D-06" className={`${field} w-24`} />
          <Input value={r.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Label" className={`${field} w-40`} />
          <Input type="number" value={r.sort_order} onChange={(e) => set(i, { sort_order: e.target.value })} className={`${field} w-20`} title="Order" />
          <Input type="date" value={r.event_date} onChange={(e) => set(i, { event_date: e.target.value })} className={`${field} w-44`} />
          <Button size="sm" disabled={busy} onClick={() => save(r)} className="bg-cranberry hover:bg-cranberry/80">Save</Button>
          {!r.isNew && <Button size="sm" variant="outline" disabled={busy} onClick={() => del(r)}>Delete</Button>}
          {!r.isNew && (r.events > 0 || r.check_ins > 0) && <Badge variant="outline" className="text-xs">{r.events} sport(s), {r.check_ins} check-in(s)</Badge>}
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => setRows([...rows, { day_code: '', label: '', sort_order: String((rows.at(-1) ? Number(rows.at(-1).sort_order) : 0) + 1), event_date: '', isNew: true }])}>Add day</Button>
    </div>
  )
}

function SettingsScreen() {
  const [settings, setSettings] = useState([])
  const [days, setDays] = useState([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([api('/api/admin/settings'), api('/api/admin/event-days')])
      setSettings(s); setDays(d)
    } catch (e) { toast.error(e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async (key, value) => {
    if (typeof value === 'number' && Number.isNaN(value)) return toast.error('Enter a number')
    setBusy(true)
    try { await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify({ key, value }) }); toast.success('Saved'); await load() }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }
  const clear = async (key) => {
    setBusy(true)
    try { await api(`/api/admin/settings?key=${encodeURIComponent(key)}`, { method: 'DELETE' }); toast.success('Cleared'); await load() }
    catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  if (loading) return <div className="p-8 text-white/70">Loading settings…</div>
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Event settings</h1>
        <p className="text-sm text-white/60 mt-1">Only super admins can change these. Every change is recorded. Dates that are not set mean “not scheduled yet”: registration stays closed until it is set.</p>
      </div>
      {(() => {
        const unconfirmed = settings.filter((s) => s.unconfirmed)
        const unsetDates = settings.filter((s) => s.group === 'dates' && !s.isSet && ['registration.open_at', 'membership.cutoff'].includes(s.key))
        if (!unconfirmed.length && !unsetDates.length) return null
        return (
          <Card className="p-4 border-yellow-400/50 bg-yellow-500/10">
            <p className="font-medium text-yellow-100">Check these before the event</p>
            <ul className="list-disc ml-5 mt-1 text-sm text-yellow-100/80">
              {unsetDates.map((s) => <li key={s.key}>{s.label} is not set (registration cannot work without it).</li>)}
              {unconfirmed.length > 0 && <li>{unconfirmed.length} value(s) are still the built-in defaults and nobody has confirmed them: {unconfirmed.map((s) => s.label).join('; ')}.</li>}
            </ul>
          </Card>
        )
      })()}
      {GROUPS.map(([group, title]) => {
        const items = settings.filter((s) => s.group === group)
        return items.length === 0 ? null : (
          <Card key={group} className="p-5 bg-black/20 border-white/10">
            <h2 className="text-lg font-medium text-white mb-1">{title}</h2>
            {items.map((s) => <SettingEditor key={s.key} setting={s} days={days} onSave={save} onClear={clear} busy={busy} />)}
          </Card>
        )
      })}
      <Card className="p-5 bg-black/20 border-white/10">
        <h2 className="text-lg font-medium text-white mb-1">Event days</h2>
        <p className="text-xs text-white/50 mb-3">Check-in and the one-per-day limit use these. A day that has sports or check-ins cannot be deleted.</p>
        <DaysEditor days={days} reload={load} />
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <PrivateRoute accessType="admin" requiredPermission="super_admin">
      <SettingsScreen />
    </PrivateRoute>
  )
}
