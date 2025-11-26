'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FaChevronRight } from 'react-icons/fa'

export default function SportSelector({ sport }) {
  const [recentMatches, setRecentMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecentMatches()
  }, [sport.sport_id])

  const fetchRecentMatches = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/brackets?sport_id=${sport.sport_id}`)
      const result = await response.json()

      if (result.success && result.data && Array.isArray(result.data)) {
        // Extract matches from all rounds and get the 2 most recent
        const allMatches = []
        result.data.forEach(round => {
          if (round.seeds && Array.isArray(round.seeds)) {
            allMatches.push(...round.seeds)
          }
        })
        
        // Sort by match ID (descending to get most recent) and take first 2
        const recent = allMatches
          .sort((a, b) => b.id - a.id)
          .slice(0, 2)
        
        setRecentMatches(recent)
      }
    } catch (error) {
      console.error('Error fetching recent matches:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Link href={`/e-arena/schedule/${sport.sport_id}`}>
      <div className="group relative overflow-hidden rounded-xl h-full cursor-pointer transition-all duration-300 hover:scale-[1.02]">
        {/* Animated border effect */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cranberry via-pink-500 to-cranberry bg-[length:200%_100%] animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
             style={{ padding: '2px' }}>
          <div className="absolute inset-[2px] bg-black rounded-xl"></div>
        </div>

        {/* Card Content */}
        <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 h-full transition-all duration-300 group-hover:bg-cranberry/10 group-hover:border-cranberry">
          
          {/* Sport Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="font-bebas text-white text-2xl tracking-wider mb-1 group-hover:text-cranberry transition-colors">
                {sport.sport_name}
              </h3>
              <div className="flex gap-2">
                <span className="bg-white/10 border border-white/20 px-2 py-1 rounded text-xs text-white/70 font-poppins">
                  {sport.gender_type}
                </span>
                <span className="bg-white/10 border border-white/20 px-2 py-1 rounded text-xs text-white/70 font-poppins">
                  {sport.category}
                </span>
              </div>
            </div>
            <div className="bg-cranberry/20 p-2 rounded-full group-hover:bg-cranberry transition-colors">
              <FaChevronRight className="text-cranberry text-sm group-hover:text-white transition-colors" />
            </div>
          </div>

          {/* Recent Matches Summary */}
          {/* <div className="space-y-3">
            <p className="font-poppins text-white/50 text-xs uppercase tracking-wider mb-3">
              Recent Matches
            </p>
            
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-cranberry/30 border-t-cranberry rounded-full animate-spin"></div>
              </div>
            ) : recentMatches.length === 0 ? (
              <div className="text-center py-4 bg-white/5 rounded-lg border border-white/10">
                <p className="font-poppins text-white/40 text-xs">No matches yet</p>
              </div>
            ) : (
              recentMatches.map((match) => {
                const team1 = match.teams?.[0]?.name || 'TBD'
                const team2 = match.teams?.[1]?.name || 'TBD'
                const score1 = match.score?.[0] || 0
                const score2 = match.score?.[1] || 0
                const winner = score1 > score2 ? 'team1' : score2 > score1 ? 'team2' : 'draw'

                return (
                  <div key={match.id} className="bg-white/5 rounded-lg p-3 border border-white/10 group-hover:border-cranberry/30 transition-colors">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className={`font-poppins truncate flex-1 ${winner === 'team1' ? 'text-white font-semibold' : 'text-white/70'}`}>
                        {team1}
                      </span>
                      <span className={`font-bold mx-2 ${winner === 'team1' ? 'text-cranberry' : 'text-white/50'}`}>
                        {score1}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-poppins truncate flex-1 ${winner === 'team2' ? 'text-white font-semibold' : 'text-white/70'}`}>
                        {team2}
                      </span>
                      <span className={`font-bold mx-2 ${winner === 'team2' ? 'text-cranberry' : 'text-white/50'}`}>
                        {score2}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div> */}

          {/* View All Link */}
          <div className="mt-6 pt-4 border-t border-white/10 group-hover:border-cranberry/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="font-bebas text-white/60 text-sm tracking-wider group-hover:text-cranberry transition-colors">
                VIEW ALL MATCHES
              </span>
              <div className="transform group-hover:translate-x-1 transition-transform">
                <FaChevronRight className="text-white/60 text-xs group-hover:text-cranberry transition-colors" />
              </div>
            </div>
          </div>

          {/* Glow effect on hover */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-cranberry/30 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        </div>
      </div>
    </Link>
  )
}
