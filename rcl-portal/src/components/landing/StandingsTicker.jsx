'use client'

import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { LAST_SEASON } from '@/data/lastSeasonStandings'

/**
 * Broadcast "lower third": a solid cyan tag with a diagonal cut, then a crawl of the top 5 clubs
 * per category with medal badges.
 *
 * - Until the new season goes live it shows last season's final standings.
 * - Set NEXT_PUBLIC_RCL_LIVE_FROM (ISO date, e.g. 2026-12-05T07:00:00+05:30) and from then on it
 *   fetches the live leaderboard (never cached, refreshed every minute). If the fetch fails or
 *   nobody has points yet, it quietly keeps showing last season.
 *
 * Sizing: everything is a multiple of `--u`, set from the `unit` prop (a CSS length), so the same
 * component scales on the desktop stage and on phones. `radius` is the pill's corner radius.
 */
const LIVE_FROM = process.env.NEXT_PUBLIC_RCL_LIVE_FROM
const CATEGORIES = [
  ['institute', 'INSTITUTE'],
  ['community', 'COMMUNITY'],
]
const REFRESH_MS = 60_000

const MEDAL = {
  1: { bg: 'linear-gradient(145deg,#fff1a8,#f5b82e 55%,#b7791f)', glow: 'rgba(255,200,60,0.65)' },
  2: { bg: 'linear-gradient(145deg,#ffffff,#c9d3e0 55%,#8794a8)', glow: 'rgba(200,215,235,0.45)' },
  3: { bg: 'linear-gradient(145deg,#ffd2b0,#e0905a 55%,#9a5424)', glow: 'rgba(224,144,90,0.5)' },
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
  return (
    <span
      className="grid flex-none place-items-center rounded-full font-sakana leading-none"
      style={{
        width: u(48),
        height: u(48),
        fontSize: u(28),
        background: medal ? medal.bg : 'rgba(0,217,255,0.12)',
        color: medal ? '#0b1a2e' : '#00d9ff',
        boxShadow: medal ? `0 0 ${u(16)} ${medal.glow}, inset 0 ${u(2)} ${u(2)} rgba(255,255,255,0.6)` : `inset 0 0 0 ${u(2)} rgba(0,217,255,0.55)`,
      }}
    >
      {rank}
    </span>
  )
}

function Entry({ rank, name, points }) {
  return (
    <span className="inline-flex items-center" style={{ gap: u(14), marginRight: u(30) }}>
      <RankBadge rank={rank} />
      <span className="font-sakana leading-none text-white" style={{ fontSize: u(36) }}>{name}</span>
      <span className="inline-flex items-baseline" style={{ gap: u(6) }}>
        <span className="font-sakana leading-none text-[#00d9ff]" style={{ fontSize: u(32) }}>{points.toLocaleString('en-US')}</span>
        <span className="font-sakana leading-none text-white/45" style={{ fontSize: u(17) }}>PTS</span>
      </span>
      <i aria-hidden className="bg-white/25" style={{ width: u(2), height: u(40), marginLeft: u(16), transform: 'skewX(-18deg)' }} />
    </span>
  )
}

function Divider({ label }) {
  return (
    <span
      className="inline-block bg-white font-sakana leading-none text-[#06152a]"
      style={{ fontSize: u(22), padding: `${u(9)} ${u(22)}`, marginRight: u(34), transform: 'skewX(-14deg)', borderRadius: u(4) }}
    >
      <span className="inline-block" style={{ transform: 'skewX(14deg)', letterSpacing: '0.04em' }}>TOP 5 · {label}</span>
    </span>
  )
}

export default function StandingsTicker({ unit, radius, className = '', layout = 'row' }) {
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

  const edge = 'linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent)'

  return (
    <div
      role="marquee"
      aria-label={isLive ? 'Live top 5 clubs per category' : `Final standings ${LAST_SEASON.label}, top 5 clubs per category`}
      className={`relative ${className}`}
      style={{ '--u': unit, borderRadius: radius, padding: u(3), background: 'linear-gradient(100deg,#00d9ff,rgba(255,255,255,0.55) 35%,#1e7bff 70%,#00d9ff)', boxShadow: `0 ${u(8)} ${u(40)} rgba(0,0,0,0.55), 0 0 ${u(34)} rgba(0,217,255,0.35)` }}
    >
      <div
        className={`relative flex h-full overflow-hidden ${layout === 'row' ? 'items-stretch' : 'flex-col'}`}
        style={{ borderRadius: `calc(${radius} - ${u(3)})`, background: 'linear-gradient(180deg,#0a2547 0%,#050f20 100%)' }}
      >
        {/* tag */}
        <div
          className="relative z-10 flex flex-none items-center text-[#04101e]"
          style={{
            gap: u(16),
            padding: `${u(16)} ${u(52)} ${u(16)} ${u(30)}`,
            background: 'linear-gradient(100deg,#00e5ff,#1e8cff)',
            clipPath: layout === 'row' ? `polygon(0 0, 100% 0, calc(100% - ${u(32)}) 100%, 0 100%)` : `polygon(0 0, 100% 0, calc(100% - ${u(32)}) 100%, 0 100%)`,
          }}
        >
          {isLive ? (
            <span className="relative flex" style={{ width: u(40), height: u(40) }}>
              <span className="absolute inset-0 animate-ping rounded-full bg-red-600/70" />
              <span className="relative m-auto rounded-full bg-red-600" style={{ width: u(24), height: u(24) }} />
            </span>
          ) : (
            <Trophy style={{ width: u(44), height: u(44) }} strokeWidth={2.2} />
          )}
          <span className="font-sakana leading-[1.1]" style={{ fontSize: u(30) }}>
            {isLive ? 'LIVE' : 'FINAL'} STANDINGS
            <span className="block opacity-70" style={{ fontSize: u(20) }}>{isLive ? 'TOP 5 PER CATEGORY' : `RCL ${LAST_SEASON.label}`}</span>
          </span>
        </div>

        {/* crawl */}
        <div className="relative min-w-0 flex-1 overflow-hidden" style={{ maskImage: edge, WebkitMaskImage: edge }}>
          <div
            className="flex h-full w-max items-center whitespace-nowrap motion-reduce:!animate-none"
            style={{ animation: 'ticker 60s linear infinite', padding: `${u(16)} 0` }}
          >
            <div className="flex flex-none items-center" style={{ paddingLeft: u(34) }}>{track}</div>
            <div aria-hidden className="flex flex-none items-center" style={{ paddingLeft: u(34) }}>{track}</div>
          </div>
        </div>

        {/* soft top sheen */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-white/10 to-transparent" style={{ height: '42%' }} />
      </div>
    </div>
  )
}
