'use client'
import { useRef, useEffect } from 'react'

export default function DesktopBracketView({ rounds }) {
  const containerRef = useRef(null)

  // Auto-scroll to show the bracket properly
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current
      const scrollWidth = container.scrollWidth
      const clientWidth = container.clientWidth
      container.scrollLeft = (scrollWidth - clientWidth) / 2
    }
  }, [rounds])

  return (
    <div 
      ref={containerRef}
      className="overflow-x-auto pb-8 scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-cranberry/50 hover:scrollbar-thumb-cranberry"
    >
      <div className="inline-flex gap-8 md:gap-12 lg:gap-16 min-w-full justify-center px-4">
        {rounds.map((round, roundIndex) => (
          <div key={roundIndex} className="flex flex-col">
            {/* Round Title */}
            <div className="mb-6 sticky top-0  backdrop-blur-sm py-3 z-10">
              <h3 className="font-bebas text-cranberry text-xl md:text-2xl tracking-wider text-center whitespace-nowrap">
                {round.title}
              </h3>
              <div className="h-px bg-gradient-to-r from-transparent via-cranberry to-transparent mt-2"></div>
            </div>

            {/* Seeds */}
            <div className="flex flex-col justify-around gap-6 flex-1">
              {round.seeds.map((seed, seedIndex) => (
                <BracketSeed key={seedIndex} seed={seed} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BracketSeed({ seed }) {
  const team1 = seed.teams?.[0]?.name || 'TBD'
  const team2 = seed.teams?.[1]?.name || 'TBD'
  const score1 = seed.score?.[0] || 0
  const score2 = seed.score?.[1] || 0
  const hasScores = score1 > 0 || score2 > 0
  const winner = hasScores ? (score1 > score2 ? 'team1' : score2 > score1 ? 'team2' : 'draw') : null

  return (
    <div className="group relative w-64 cursor-default transition-all duration-300 hover:scale-105">
      {/* Animated border effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cranberry via-pink-500 to-cranberry bg-[length:200%_100%] animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
           style={{ padding: '2px' }}>
        <div className="absolute inset-[2px] bg-black rounded-xl"></div>
      </div>

      {/* Seed Content */}
      <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 transition-all duration-300 group-hover:bg-cranberry/10 group-hover:border-cranberry/30">
        
        {/* Match Info */}
        <div className="flex items-center justify-between mb-3">
          <span className="font-poppins text-white/40 text-xs">
            Match {seed.id || 'TBD'}
          </span>
          {seed.date && seed.date !== 'TBD' && (
            <span className="font-poppins text-white/30 text-[10px]">
              {new Date(seed.date).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Teams */}
        <div className="space-y-2">
          {/* Team 1 */}
          <div className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 ${
            winner === 'team1'
              ? 'bg-cranberry/30 border border-cranberry/60 shadow-lg shadow-cranberry/20'
              : 'bg-white/5 border border-white/10'
          }`}>
            <div className="flex-1 min-w-0 mr-2">
              <p className={`font-poppins text-sm truncate transition-all ${
                winner === 'team1' 
                  ? 'text-white font-semibold' 
                  : 'text-white/80'
              }`}>
                {team1}
              </p>
              {seed.teams?.[0]?.seed && (
                <p className="font-poppins text-white/30 text-[10px] mt-0.5">
                  Seed #{seed.teams[0].seed}
                </p>
              )}
            </div>
            {hasScores && (
              <div className={`font-bold text-lg px-3 py-1 rounded-md flex-shrink-0 transition-all ${
                winner === 'team1'
                  ? 'bg-cranberry text-white'
                  : 'bg-white/10 text-white/70'
              }`}>
                {score1}
              </div>
            )}
          </div>

          {/* Team 2 */}
          <div className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 ${
            winner === 'team2'
              ? 'bg-cranberry/30 border border-cranberry/60 shadow-lg shadow-cranberry/20'
              : 'bg-white/5 border border-white/10'
          }`}>
            <div className="flex-1 min-w-0 mr-2">
              <p className={`font-poppins text-sm truncate transition-all ${
                winner === 'team2' 
                  ? 'text-white font-semibold' 
                  : 'text-white/80'
              }`}>
                {team2}
              </p>
              {seed.teams?.[1]?.seed && (
                <p className="font-poppins text-white/30 text-[10px] mt-0.5">
                  Seed #{seed.teams[1].seed}
                </p>
              )}
            </div>
            {hasScores && (
              <div className={`font-bold text-lg px-3 py-1 rounded-md flex-shrink-0 transition-all ${
                winner === 'team2'
                  ? 'bg-cranberry text-white'
                  : 'bg-white/10 text-white/70'
              }`}>
                {score2}
              </div>
            )}
          </div>
        </div>

        {/* Glow effect on hover */}
        <div className="absolute -top-2 -right-2 w-16 h-16 bg-cranberry/30 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      </div>
    </div>
  )
}
