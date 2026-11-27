'use client'

import { useEffect, useState } from 'react'
import { LAST_SEASON } from '@/data/lastSeasonStandings'
import { chamfer, chamferInset } from './chamfer'

/**
 * Standings crawl in the same angular broadcast style as the hero status: a chamfered panel with a
 * hairline outline, a label tab centred on its top edge, a corner bracket and a hatch block, with a
 * scrolling top-5 per club category inside. No curves.
 *
 * - Until the new season goes live it shows last season's final standings.
 * - Set NEXT_PUBLIC_RCL_LIVE_FROM (ISO date, e.g. 2026-12-05T07:00:00+05:30) and from then on it
 *   fetches the live leaderboard (never cached, refreshed every minute). If the fetch fails or
 *   nobody has points yet, it quietly keeps showing last season.
 *
 * Sizing: everything is a multiple of `--u` (the `unit` prop, a CSS length).
 */
const LIVE_FROM = process.env.NEXT_PUBLIC_RCL_LIVE_FROM
const CATEGORIES = [
  ['institute', 'INSTITUTE'],
  ['community', 'COMMUNITY'],
]
const REFRESH_MS = 60_000

const MEDAL = {
  1: 'linear-gradient(145deg,#fff1a8,#f5b82e 55%,#b7791f)',
  2: 'linear-gradient(145deg,#ffffff,#c9d3e0 55%,#8794a8)',
  3: 'linear-gradient(145deg,#ffd2b0,#e0905a 55%,#9a5424)',
}

const u = (n) => `calc(var(--u) * ${n})`
const shortName = (club) => club.replace(/^RAC\s+/i, '')

async function fetchLive() {
  const out = {}
  for (const [key] of CATEGORIES) {
    const res = await fetch(`/api/leaderboard/aggregated?category=${key}&limit=5`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`leaderboard ${res.status}`)
    const json = await res.json()
    out[key] = (json.data || []).map((r) => ({ rank: r.rank, club: shortName(r.club_name), points: r.total_points }))
  }
  if (CATEGORIES.every(([key]) => !out[key].some((r) => r.points > 0))) throw new Error('no points yet')
  return out
}

function RankBadge({ rank }) {
  const medal = MEDAL[rank]
  const size = u(44)
  return (
    <span
      className="relative grid flex-none place-items-center font-sakana leading-none"
      style={{ width: size, height: size, fontSize: u(26), background: medal || '#00d9ff', color: '#06152a', clipPath: chamfer(u(10)) }}
    >
      {!medal && (
        // 4th / 5th: outlined, not filled
        <span aria-hidden className="absolute inset-0 bg-[#0a2547]" style={{ clipPath: chamferInset(u(10), u(2)) }} />
      )}
      <span className="relative" style={{ color: medal ? '#06152a' : '#00d9ff' }}>{rank}</span>
    </span>
  )
}

function Entry({ rank, name, points }) {
  return (
    <span className="inline-flex items-center" style={{ gap: u(14), marginRight: u(28) }}>
      <RankBadge rank={rank} />
      <span className="font-sakana leading-none text-white" style={{ fontSize: u(34) }}>{name}</span>
      <span className="inline-flex items-baseline" style={{ gap: u(6) }}>
        <span className="font-sakana leading-none text-[#00d9ff]" style={{ fontSize: u(30) }}>{points.toLocaleString('en-US')}</span>
        <span className="font-poppins font-semibold leading-none tracking-[0.18em] text-white/45" style={{ fontSize: u(12) }}>PTS</span>
      </span>
      <i aria-hidden className="bg-white/25" style={{ width: u(2), height: u(38), marginLeft: u(14), transform: 'skewX(-16deg)' }} />
    </span>
  )
}

function Divider({ label }) {
  return (
    <span
      className="inline-block font-sakana leading-none tracking-[0.08em] text-[#04101e]"
      style={{ fontSize: u(20), padding: `${u(10)} ${u(22)}`, marginRight: u(30), background: 'linear-gradient(100deg,#00e5ff,#1e8cff)', clipPath: chamfer(u(9)) }}
    >
      TOP 5 · {label}
    </span>
  )
}

export default function StandingsTicker({ unit, className = '' }) {
  const [live, setLive] = useState(null)

  useEffect(() => {
    if (!LIVE_FROM || Number.isNaN(Date.parse(LIVE_FROM))) return
    let timer
    let cancelled = false
    const tick = async () => {
      if (Date.now() >= Date.parse(LIVE_FROM)) {
        try {
          const data = await fetchLive()
          if (!cancelled) setLive(data)
        } catch {
          if (!cancelled) setLive(null)
        }
      }
      if (!cancelled) timer = setTimeout(tick, REFRESH_MS)
    }
    tick()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const isLive = Boolean(live)
  const data = live || Object.fromEntries(CATEGORIES.map(([k]) => [k, LAST_SEASON.categories[k].map((r) => ({ ...r, club: r.short || r.club }))]))

  const track = CATEGORIES.flatMap(([key, label]) => [
    <Divider key={`${key}-d`} label={label} />,
    ...data[key].map((r) => <Entry key={`${key}-${r.rank}-${r.club}`} rank={r.rank} name={r.club} points={r.points} />),
  ])

  const cut = u(26)
  const edge = 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)'

  return (
    <div
      role="marquee"
      aria-label={isLive ? 'Live top 5 clubs per category' : `Final standings ${LAST_SEASON.label}, top 5 clubs per category`}
      className={`relative ${className}`}
      style={{ '--u': unit, filter: `drop-shadow(0 ${u(6)} ${u(18)} rgba(0,0,0,0.55)) drop-shadow(0 0 ${u(16)} rgba(0,217,255,0.28))` }}
    >
      {/* hairline outline */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg,#00d9ff,rgba(255,255,255,0.6) 40%,#1e7bff 75%,#00d9ff)', clipPath: chamfer(cut) }} />

      {/* panel */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          clipPath: chamferInset(cut, u(2)),
          background:
            'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px) 0 0 / 100% calc(var(--u) * 26), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px) 0 0 / calc(var(--u) * 26) 100%, linear-gradient(180deg,#0b2a52 0%,#050f20 100%)',
        }}
      >
        {/* crawl */}
        <div className="absolute inset-0 flex items-center overflow-hidden" style={{ paddingTop: u(14), paddingBottom: u(12), maskImage: edge, WebkitMaskImage: edge }}>
          <div className="flex w-max items-center whitespace-nowrap motion-reduce:!animate-none" style={{ animation: 'ticker 60s linear infinite' }}>
            <div className="flex flex-none items-center" style={{ paddingLeft: u(34) }}>{track}</div>
            <div aria-hidden className="flex flex-none items-center" style={{ paddingLeft: u(34) }}>{track}</div>
          </div>
        </div>

        {/* hatch block, bottom-left */}
        <span aria-hidden className="absolute" style={{ left: u(26), bottom: u(10), width: u(58), height: u(12), background: 'repeating-linear-gradient(115deg, rgba(0,217,255,0.75) 0 2px, transparent 2px 7px)' }} />
        {/* corner bracket, top-right */}
        <span aria-hidden className="absolute border-white/70" style={{ top: u(12), right: u(16), width: u(20), height: u(20), borderTopWidth: u(2), borderRightWidth: u(2) }} />
      </div>

      {/* label tab centred on the top edge */}
      <div
        className="absolute z-10 flex items-center text-[#04101e]"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          top: u(-19),
          height: u(38),
          padding: `0 ${u(30)}`,
          gap: u(10),
          whiteSpace: 'nowrap',
          background: isLive ? 'linear-gradient(100deg,#ff5d6c,#ff2f4a)' : 'linear-gradient(100deg,#00e5ff,#1e8cff)',
          clipPath: chamfer(u(11)),
        }}
      >
        {isLive && <span className="animate-pulse bg-white" style={{ width: u(10), height: u(10) }} />}
        <span className="font-sakana leading-none tracking-[0.1em]" style={{ fontSize: u(22) }}>
          {isLive ? 'LIVE STANDINGS' : `FINAL STANDINGS · ${LAST_SEASON.label}`}
        </span>
      </div>
    </div>
  )
}
