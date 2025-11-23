'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import BracketService from '@/services/bracketServices'
import { FaArrowLeft, FaTrophy } from 'react-icons/fa'
import DesktopBracketView from '../components/DesktopBracketView'
import MobileMatchCard from '../components/MobileMatchCard'

export default function SportSchedulePage() {
  const params = useParams()
  const router = useRouter()
  const [rounds, setRounds] = useState([])
  const [sportInfo, setSportInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('bracket')

  // Determine view mode once on mount
  useEffect(() => {
    const isMobile = window.innerWidth < 1024
    setViewMode(isMobile ? 'cards' : 'bracket')
  }, [])

  // Fetch data on mount
  useEffect(() => {
    if (!params?.sportId) {
      console.log('No sportId in params yet:', params)
      return
    }

    const sportId = parseInt(params.sportId)
    console.log('UseEffect triggered with sportId:', sportId)
    loadData(sportId)
  }, [params.sportId])

  const loadData = async (sportId) => {
    try {
      setLoading(true)
      setError(null)

      console.log('Loading data for sport:', sportId)

      // Fetch both bracket and sport info from API
      const [bracketResponse, eventsResponse] = await Promise.all([
        fetch(`/api/brackets?sport_id=${sportId}`),
        fetch(`/api/events?sport_id=${sportId}`)
      ])

      const bracketResult = await bracketResponse.json()
      const eventsResult = await eventsResponse.json()

      console.log('Bracket API response:', bracketResult)
      console.log('Events API response:', eventsResult)

      if (!bracketResponse.ok || !bracketResult.success) {
        throw new Error(bracketResult.error || 'Failed to fetch brackets')
      }

      if (!eventsResponse.ok || !eventsResult.success) {
        throw new Error(eventsResult.error || 'Failed to fetch sport info')
      }

      // Get first sport from the results (should be the one we're looking for)
      const sport = Array.isArray(eventsResult.data) && eventsResult.data.length > 0
        ? eventsResult.data[0]
        : null

      setSportInfo(sport)
      setRounds(bracketResult.data || [])
    } catch (err) {
      console.error('Error loading schedule:', err)
      setError(err.message || 'Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black md:mt-12 md:px-10 mt-5 px-5">
      {/* Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Belanosima:wght@400;600;700&display=swap" rel="stylesheet" />
      
      {/* Pink Glow Effect */}
      <div className="fixed top-[-900px] left-0 right-0 mx-auto w-[1490px] h-[864px] bg-cranberry/60 rounded-full z-0"
           style={{ filter: 'blur(1000px)' }}></div>

      {/* Content Container */}
      <div className="relative z-10 max-w-[1920px] mx-auto px-4 md:px-8 lg:px-16 pt-24 pb-20">
        
        {/* Header */}
        <div className="mb-12">
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="group flex items-center gap-2 mb-6 text-white/70 hover:text-cranberry transition-colors cursor-pointer"
          >
            <FaArrowLeft className="text-sm" />
            <span className="font-poppins text-sm">Back to Schedule</span>
          </button>

          {/* Sport Info - Only show when not loading */}
          {!loading && sportInfo ? (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="font-belanosima text-5xl md:text-6xl lg:text-7xl font-normal bg-gradient-to-b from-cranberry to-cranberry/20 bg-clip-text text-transparent mb-2 select-none uppercase"
                    style={{ 
                      fontFamily: 'Belanosima, system-ui, sans-serif',
                      WebkitTextStroke: '2px rgba(216, 27, 93, 0.3)',
                    }}>
                  {sportInfo.sport_name}
                </h1>
                <div className="flex gap-2 flex-wrap">
                  <span className="bg-cranberry/20 border border-cranberry/50 px-3 py-1 rounded-full font-poppins text-cranberry text-sm">
                    {sportInfo.gender_type}
                  </span>
                  <span className="bg-white/10 border border-white/20 px-3 py-1 rounded-full font-poppins text-white/70 text-sm">
                    {sportInfo.category}
                  </span>
                  <span className="bg-white/10 border border-white/20 px-3 py-1 rounded-full font-poppins text-white/70 text-sm">
                    {sportInfo.sport_type}
                  </span>
                </div>
              </div>

              {/* View Mode Toggle - Desktop Only */}
              <div className="hidden lg:flex bg-white/5 border border-white/10 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('bracket')}
                  className={`px-4 py-2 rounded-md font-bebas tracking-wider transition-all ${
                    viewMode === 'bracket'
                      ? 'bg-cranberry text-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  BRACKET VIEW
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-4 py-2 rounded-md font-bebas tracking-wider transition-all ${
                    viewMode === 'cards'
                      ? 'bg-cranberry text-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  LIST VIEW
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Content - Single Loading State */}
        {loading ? (
          <div className="flex justify-center items-center py-40">
            <div className="flex flex-col items-center gap-4">
              <img src="/load.svg" alt="Loading" className="w-20 animate-spin" />
              <p className="font-poppins text-white/60 text-lg">Loading schedule...</p>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20 bg-white/5 rounded-xl border border-white/10">
            <p className="font-poppins text-white/60 text-lg mb-2">Error loading schedule</p>
            <p className="font-poppins text-white/40 text-sm">{error}</p>
          </div>
        ) : rounds.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-xl border border-white/10">
            <FaTrophy className="text-cranberry text-5xl mx-auto mb-4 opacity-50" />
            <p className="font-bebas text-white/60 text-2xl tracking-wider">NO MATCHES SCHEDULED YET</p>
            <p className="font-poppins text-white/40 text-sm mt-2">Check back soon for updates</p>
          </div>
        ) : (
          <>
            {viewMode === 'bracket' ? (
              <DesktopBracketView rounds={rounds} />
            ) : (
              <div className="space-y-8">
                {rounds.map((round, roundIndex) => (
                  <div key={roundIndex}>
                    <div className="flex items-center gap-4 mb-6">
                      <h2 className="font-bebas text-white text-2xl md:text-3xl tracking-wider">
                        {round.title}
                      </h2>
                      <div className="flex-1 h-px bg-gradient-to-r from-cranberry/50 to-transparent"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {round.seeds.map((seed, seedIndex) => (
                        <MobileMatchCard key={seedIndex} seed={seed} roundTitle={round.title} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
