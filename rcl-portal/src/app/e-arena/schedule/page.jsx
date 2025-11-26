'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FaBolt, FaTrophy, FaClock } from 'react-icons/fa'
import SportSelector from './components/SportSelector'

export default function SchedulePage() {
  const [recentMatches, setRecentMatches] = useState([])
  const [sports, setSports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchScheduleData()
  }, [])

  const fetchScheduleData = async () => {
    try {
      setLoading(true)

      // Fetch all sports/events from API
      const sportsRes = await fetch('/api/events', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      const sportsData = await sportsRes.json()
      if (!sportsData.success) throw new Error(sportsData.error || 'Failed to fetch sports')

      // Fetch recent matches from API
      const matchesRes = await fetch('/api/brackets', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      const matchesData = await matchesRes.json()
      if (matchesData.success && matchesData.data) {
        // Extract and flatten all matches, then get 5 most recent
        const allMatches = []
        matchesData.data.forEach(round => {
          if (round.seeds && Array.isArray(round.seeds)) {
            allMatches.push(...round.seeds)
          }
        })
        
        // Sort by match ID descending and take first 5
        const recent = allMatches
          .sort((a, b) => (b.id || 0) - (a.id || 0))
          .slice(0, 5)
        
        setRecentMatches(recent)
      }

      setSports(sportsData.data || [])
    } catch (error) {
      console.error('Error fetching schedule data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black md:mt-14 mt-5">
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Belanosima:wght@400;600;700&display=swap" rel="stylesheet" />
      
      {/* Pink Glow Effect */}
      <div className="fixed top-[-900px] left-0 right-0 mx-auto w-[1490px] h-[864px] bg-cranberry/60 rounded-full z-0"
           style={{ filter: 'blur(1000px)' }}></div>

      {/* Content Container */}
      <div className="relative z-10 max-w-[1920px] mx-auto px-6 md:px-12 lg:px-24 pt-24 pb-20">
        
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="font-belanosima text-5xl md:text-7xl lg:text-8xl font-normal bg-gradient-to-b from-cranberry to-cranberry/20 bg-clip-text text-transparent mb-2 select-none"
              style={{ 
                fontFamily: 'Belanosima, system-ui, sans-serif',
                WebkitTextStroke: '2px rgba(216, 27, 93, 0.3)',
              }}>
            LIVE SCHEDULE
          </h1>
          <p className="font-bebas text-white/70 text-xl md:text-2xl tracking-wider">
            TRACK EVERY MATCH IN REAL-TIME
          </p>
        </div>

        {/* Sports Selector Section */}
        <section>
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <FaTrophy className="text-cranberry text-2xl" />
              <h2 className="font-bebas text-white text-3xl md:text-4xl tracking-wider">
                SELECT SPORT
              </h2>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-cranberry/50 to-transparent"></div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <img src="/load.svg" alt="Loading" className="w-20" />
            </div>
          ) : sports.length === 0 ? (
            <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
              <p className="font-poppins text-white/60 text-lg">No sports available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sports.map((sport) => (
                <SportSelector key={sport.sport_id} sport={sport} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
