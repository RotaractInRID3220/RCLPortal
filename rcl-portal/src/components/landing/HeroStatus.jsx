'use client'

import { useEffect, useState } from 'react'
import { APP_CONFIG } from '@/config/app.config'
import { chamfer, chamferInset } from './chamfer'

/**
 * Season status panel for the hero, styled after esports broadcast graphics: a chamfered panel with a
 * hairline outline, a solid label tab sitting on its top edge, corner brackets, a hatch block and
 * big numerals. No curves anywhere.
 *
 * Same states as the old e-arena hero, driven by the same APP_CONFIG dates
 * (REGISTRATION_OPENING_DATE, REGISTRATION_DEADLINE, EVENT_DAY):
 *
 *   before opening      -> tab "REGISTRATIONS OPEN IN" + countdown
 *   registration window -> tab "REGISTRATIONS" + "ARE NOW OPEN" notice
 *   after the deadline  -> tab "SEE YOU IN" + countdown to event day
 *   from event day      -> tab "LIVE" + "THE ACTION IS LIVE"
 *
 * If REGISTRATION_DEADLINE isn't set, registration is treated as open until event day.
 * In development you can preview a state with ?status=opening | open | countdown | live.
 *
 * Sizing: everything is a multiple of `--u` (the `unit` prop, a CSS length).
 */
const u = (n) => `calc(var(--u) * ${n})`
const ts = (d) => (d ? new Date(d).getTime() : NaN)

function resolve(now) {
  const opening = ts(APP_CONFIG.REGISTRATION_OPENING_DATE)
  const deadline = ts(APP_CONFIG.REGISTRATION_DEADLINE)
  const event = ts(APP_CONFIG.EVENT_DAY)
  if (opening > now) return { kind: 'opening', target: opening }
  const regClosesAt = Number.isNaN(deadline) ? event : deadline
  if (Number.isNaN(regClosesAt) || now < regClosesAt) return { kind: 'open' }
  if (event > now) return { kind: 'countdown', target: event }
  return { kind: 'live' }
}

function preview(kind, now) {
  const span = 12 * 864e5 + 4 * 36e5 + 33 * 6e4 + 21e3
  if (kind === 'opening' || kind === 'countdown') return { kind, target: now + span }
  if (kind === 'open' || kind === 'live') return { kind }
  return null
}

const split = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return [Math.floor(s / 86400), Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60]
}
const pad = (n) => String(n).padStart(2, '0')

const TAB = {
  opening: 'REGISTRATIONS OPEN IN',
  countdown: 'SEE YOU IN',
  open: 'REGISTRATIONS',
  live: 'LIVE',
}

function Bracket({ className = '', style }) {
  return <span aria-hidden className={`absolute border-white/70 ${className}`} style={style} />
}

function Digits({ remaining }) {
  const units = split(remaining).map((v, i) => [pad(v), ['DAYS', 'HRS', 'MINS', 'SECS'][i]])
  return (
    <div className="flex items-center justify-center" style={{ gap: u(28) }}>
      {units.map(([value, label], i) => (
        <div key={label} className="flex items-center" style={{ gap: u(28) }}>
          <div className="flex flex-col items-center">
            <span className="font-sakana leading-none text-white tabular-nums" style={{ fontSize: u(68) }}>{value}</span>
            <span className="font-poppins font-semibold leading-none tracking-[0.2em] text-[#00d9ff]" style={{ fontSize: u(16), marginTop: u(9), paddingLeft: u(4) }}>{label}</span>
          </div>
          {i < 3 && <i aria-hidden className="block bg-white/30" style={{ width: u(2), height: u(56), transform: 'skewX(-16deg)' }} />}
        </div>
      ))}
    </div>
  )
}

export default function HeroStatus({ unit, className = '' }) {
  const [now, setNow] = useState(null)
  const [forced, setForced] = useState(null)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const q = new URLSearchParams(window.location.search).get('status')
      if (q) setForced(q)
    }
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const state = now == null ? null : (forced && preview(forced, now)) || resolve(now)
  const kind = state?.kind || 'open'
  const counting = kind === 'opening' || kind === 'countdown'
  const isLive = kind === 'live'
  const cut = u(26)
  const accent = isLive ? 'linear-gradient(100deg,#ff5d6c,#ff2f4a)' : 'linear-gradient(100deg,#00e5ff,#1e8cff)'

  return (
    <div
      role="status"
      aria-live="off"
      className={`relative ${className}`}
      style={{ '--u': unit, visibility: state ? 'visible' : 'hidden', filter: `drop-shadow(0 ${u(6)} ${u(18)} rgba(0,0,0,0.55)) drop-shadow(0 0 ${u(16)} rgba(0,217,255,0.28))` }}
    >
      {/* hairline outline */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg,#00d9ff,rgba(255,255,255,0.6) 40%,#1e7bff 75%,#00d9ff)', clipPath: chamfer(cut) }} />

      {/* panel */}
      <div
        className="absolute inset-0 flex items-center justify-center text-center"
        style={{
          clipPath: chamferInset(cut, u(2)),
          background:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px) 0 0 / 100% calc(var(--u) * 26), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px) 0 0 / calc(var(--u) * 26) 100%, linear-gradient(180deg,#0b2a52 0%,#050f20 100%)',
          padding: `${u(30)} ${u(50)} ${u(34)}`,
        }}
      >
        {/* hatch block, bottom-left */}
        <span
          aria-hidden
          className="absolute"
          style={{ left: u(26), bottom: u(14), width: u(58), height: u(14), background: 'repeating-linear-gradient(115deg, rgba(0,217,255,0.75) 0 2px, transparent 2px 7px)' }}
        />
        {/* corner brackets, top-right */}
        <Bracket style={{ top: u(14), right: u(18), width: u(22), height: u(22), borderTopWidth: u(2), borderRightWidth: u(2) }} />

        {counting && state && <Digits remaining={state.target - now} />}

        {kind === 'open' && (
          <div className="flex flex-col items-center" style={{ gap: u(10) }}>
            <p className="flex items-center whitespace-nowrap font-sakana leading-none text-white" style={{ fontSize: u(50), gap: u(20) }}>
              <Chevrons />
              ARE NOW OPEN
              <Chevrons flip />
            </p>
            <p className="font-poppins font-semibold uppercase tracking-[0.08em] text-white/70" style={{ fontSize: u(16) }}>
              Contact your club president or secretary to register
            </p>
          </div>
        )}

        {isLive && (
          <p className="whitespace-nowrap font-sakana leading-none text-white" style={{ fontSize: u(46) }}>
            THE ACTION IS <span className="text-[#ff5d6c]">LIVE</span>
          </p>
        )}
      </div>

      {/* label tab sitting on the top edge */}
      <div
        className="absolute z-10 flex items-center text-[#04101e]"
        style={{ left: '50%', transform: 'translateX(-50%)', top: u(-19), height: u(38), padding: `0 ${u(30)}`, gap: u(10), background: accent, clipPath: chamfer(u(11)), whiteSpace: 'nowrap' }}
      >
        {isLive && <span className="animate-pulse rounded-none bg-white" style={{ width: u(10), height: u(10) }} />}
        <span className="font-sakana leading-none tracking-[0.1em]" style={{ fontSize: u(22) }}>{TAB[kind]}</span>
      </div>
    </div>
  )
}

/** Three slanted bars, like broadcast "forward" marks. */
function Chevrons({ flip = false }) {
  const bars = ['bg-[#00d9ff]', 'bg-[#00d9ff]/60', 'bg-[#00d9ff]/30']
  return (
    <span aria-hidden className={`flex ${flip ? 'flex-row-reverse' : ''}`} style={{ gap: u(5) }}>
      {bars.map((c) => (
        <i key={c} className={`block ${c}`} style={{ width: u(8), height: u(30), transform: `skewX(${flip ? 16 : -16}deg)` }} />
      ))}
    </span>
  )
}
