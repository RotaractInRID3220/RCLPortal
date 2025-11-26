'use client'
import { FaTrophy } from 'react-icons/fa'

export default function MobileMatchCard({ seed, roundTitle }) {
  const team1 = seed.teams?.[0]?.name || 'TBD'
  const team2 = seed.teams?.[1]?.name || 'TBD'
  const score1 = seed.score?.[0] || 0
  const score2 = seed.score?.[1] || 0
  const hasScores = score1 > 0 || score2 > 0
  const winner = hasScores ? (score1 > score2 ? 'team1' : score2 > score1 ? 'team2' : 'draw') : null
  const status = seed.status || 'scheduled'

  return (
    <div className="group relative overflow-hidden rounded-xl cursor-default transition-all duration-300 hover:scale-[1.01]">
      {/* Animated border effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cranberry via-pink-500 to-cranberry bg-[length:200%_100%] animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
           style={{ padding: '2px' }}>
        <div className="absolute inset-[2px] bg-black rounded-xl"></div>
      </div>

      {/* Card Content */}
      <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 transition-all duration-300 group-hover:bg-cranberry/10 group-hover:border-cranberry/30">
        
        {/* Match Info Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="bg-cranberry/20 border border-cranberry/50 px-3 py-1 rounded-full font-bebas text-cranberry text-xs tracking-wider">
              MATCH {seed.id || 'TBD'}
            </span>
            {status === 'completed' && (
              <span className="bg-green-500/20 border border-green-500/50 px-3 py-1 rounded-full font-poppins text-green-400 text-xs">
                Completed
              </span>
            )}
          </div>
          {seed.date && seed.date !== 'TBD' && (
            <span className="font-poppins text-white/40 text-xs">
              {seed.date}
            </span>
          )}
        </div>

        {/* Teams Container */}
        <div className="space-y-3">
          {/* Team 1 */}
          <div className={`relative overflow-hidden rounded-lg p-4 transition-all duration-300 ${
            winner === 'team1'
              ? 'bg-gradient-to-r from-cranberry/30 to-cranberry/10 border-2 border-cranberry shadow-lg shadow-cranberry/20'
              : 'bg-white/5 border border-white/10 group-hover:border-white/20'
          }`}>
            {/* Shine effect for winner */}
            {winner === 'team1' && (
              <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            )}
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {winner === 'team1' && (
                  <FaTrophy className="text-cranberry text-lg flex-shrink-0 animate-pulse" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`font-poppins text-base truncate transition-all ${
                    winner === 'team1' 
                      ? 'text-white font-bold text-lg' 
                      : 'text-white/80'
                  }`}>
                    {team1}
                  </p>
                  {seed.teams?.[0]?.seed && (
                    <p className="font-poppins text-white/40 text-xs mt-0.5">
                      Seed #{seed.teams[0].seed}
                    </p>
                  )}
                </div>
              </div>
              {hasScores && (
                <div className={`font-bold text-2xl ml-4 px-4 py-2 rounded-lg flex-shrink-0 transition-all ${
                  winner === 'team1'
                    ? 'bg-cranberry text-white shadow-lg shadow-cranberry/30 scale-110'
                    : 'bg-white/10 text-white/70'
                }`}>
                  {score1}
                </div>
              )}
            </div>
          </div>

          {/* VS Divider */}
          <div className="flex items-center justify-center py-1">
            <div className="bg-gradient-to-r from-transparent via-cranberry/50 to-transparent h-px flex-1"></div>
            <span className="font-bebas text-cranberry text-sm px-4 tracking-wider">VS</span>
            <div className="bg-gradient-to-r from-cranberry/50 via-transparent to-transparent h-px flex-1"></div>
          </div>

          {/* Team 2 */}
          <div className={`relative overflow-hidden rounded-lg p-4 transition-all duration-300 ${
            winner === 'team2'
              ? 'bg-gradient-to-r from-cranberry/30 to-cranberry/10 border-2 border-cranberry shadow-lg shadow-cranberry/20'
              : 'bg-white/5 border border-white/10 group-hover:border-white/20'
          }`}>
            {/* Shine effect for winner */}
            {winner === 'team2' && (
              <div className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            )}
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {winner === 'team2' && (
                  <FaTrophy className="text-cranberry text-lg flex-shrink-0 animate-pulse" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`font-poppins text-base truncate transition-all ${
                    winner === 'team2' 
                      ? 'text-white font-bold text-lg' 
                      : 'text-white/80'
                  }`}>
                    {team2}
                  </p>
                  {seed.teams?.[1]?.seed && (
                    <p className="font-poppins text-white/40 text-xs mt-0.5">
                      Seed #{seed.teams[1].seed}
                    </p>
                  )}
                </div>
              </div>
              {hasScores && (
                <div className={`font-bold text-2xl ml-4 px-4 py-2 rounded-lg flex-shrink-0 transition-all ${
                  winner === 'team2'
                    ? 'bg-cranberry text-white shadow-lg shadow-cranberry/30 scale-110'
                    : 'bg-white/10 text-white/70'
                }`}>
                  {score2}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Result Footer */}
        {winner && winner !== 'draw' && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="flex items-center justify-center gap-2">
              <FaTrophy className="text-cranberry text-sm animate-pulse" />
              <p className="font-bebas text-cranberry text-sm tracking-wider">
                {winner === 'team1' ? team1 : team2} WINS
              </p>
            </div>
          </div>
        )}

        {/* Glow effect on hover */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-cranberry/30 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      </div>
    </div>
  )
}
