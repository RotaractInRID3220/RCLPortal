'use client'
import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'

const ClubDetailsDisplay = ({ clubPoints }) => {
  const [detailedPoints, setDetailedPoints] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSportNames = async () => {
      if (!clubPoints || clubPoints.length === 0) {
        setDetailedPoints([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        // Get unique sport IDs
        const sportIds = [...new Set(clubPoints.map(point => point.sport_id))]
        
        // Fetch events to get sport names
        const response = await fetch('/api/events')
        if (!response.ok) {
          throw new Error('Failed to fetch sports data')
        }

        const result = await response.json()
        const sports = result.data || []

        // Create sport lookup map
        const sportMap = {}
        sports.forEach(sport => {
          sportMap[sport.sport_id] = sport
        })

        // Combine club points with sport names
        const enrichedPoints = clubPoints.map(point => ({
          ...point,
          sport: sportMap[point.sport_id] || { sport_name: 'Penalty' }
        }))

        // Sort by points descending, then by sport name ascending
        enrichedPoints.sort((a, b) => {
          if (b.points !== a.points) {
            return b.points - a.points
          }
          return (a.sport.sport_name || '').localeCompare(b.sport.sport_name || '')
        })

        setDetailedPoints(enrichedPoints)
      } catch (error) {
        console.error('Error fetching sport names:', error)
        toast.error('Failed to load sport details')
        
        // Fallback: show points without sport names
        const fallbackPoints = clubPoints.map(point => ({
          ...point,
          sport: { sport_name: 'Unknown Sport' }
        })).sort((a, b) => b.points - a.points)
        
        setDetailedPoints(fallbackPoints)
      } finally {
        setLoading(false)
      }
    }

    fetchSportNames()
  }, [clubPoints])

  if (loading) {
    return (
      <div className="bg-white/5 rounded-lg p-6">
        <h3 className="text-xl font-medium mb-4">Points Breakdown</h3>
        <div className="flex justify-center py-8">
          <img src="/load.svg" alt="" className="w-8" />
        </div>
      </div>
    )
  }

  if (!detailedPoints || detailedPoints.length === 0) {
    return (
      <div className="bg-white/5 rounded-lg p-6">
        <h3 className="text-xl font-medium mb-4">Points Breakdown</h3>
        <div className="text-center py-8">
          <p className="text-gray-400">No points entries found for this club.</p>
          <p className="text-gray-500 text-sm mt-2">Points will appear here once added by admin.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white/5 rounded-lg p-6">
      <h3 className="text-xl font-medium mb-4">Points Breakdown</h3>
      
      <div className="space-y-4">
        {/* Header Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 py-3 px-4 bg-white/10 rounded-lg font-medium">
          <div className="col-span-1 sm:col-span-2 lg:col-span-2">Sport</div>
          <div className="text-center">Place</div>
          <div className="text-center">Points</div>
        </div>
        
        {/* Data Rows */}
        {detailedPoints.map((entry, index) => (
          <div 
            key={entry.point_id || index} 
            className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 py-4 px-4 bg-white/5 rounded-lg hover:bg-white/8 transition-colors border-l-4 border-cranberry/50"
          >
            {/* Sport Info */}
            <div className="col-span-1 sm:col-span-2 lg:col-span-2">
              <div className="font-medium text-white">
                {entry.sport.sport_name || 'Penalty'}
              </div>
              {entry.sport.category && entry.sport.gender_type && (
                <div className="text-sm text-gray-400 mt-1">
                  <span className="capitalize">{entry.sport.category}</span>
                  {entry.sport.gender_type && (
                    <>
                      <span className="mx-1">•</span>
                      <span className="capitalize">{entry.sport.gender_type}</span>
                    </>
                  )}
                  {entry.sport.sport_type && (
                    <>
                      <span className="mx-1">•</span>
                      <span className="capitalize">{entry.sport.sport_type}</span>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {/* Place */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-white/10 rounded-full font-semibold text-white">
                {entry.place}
              </div>
            </div>
            
            {/* Points */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-10 bg-cranberry/20 border border-cranberry/30 rounded-full font-bold text-cranberry-300">
                {entry.points}
              </div>
            </div>
          </div>
        ))}
        
        {/* Summary */}
        <div className="pt-4 border-t border-white/20">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 py-3 px-4 bg-cranberry/10 rounded-lg font-bold">
            <div className="col-span-1 sm:col-span-2 lg:col-span-2 text-lg">
              Total
            </div>
            <div className="text-center">
              {detailedPoints.length} entries
            </div>
            <div className="text-center text-lg text-cranberry-300">
              {detailedPoints.reduce((sum, entry) => sum + (entry.points || 0), 0)} pts
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClubDetailsDisplay