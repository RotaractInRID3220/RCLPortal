'use client'
import React, { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Users, Trophy, Target } from 'lucide-react'

const TeamStats = ({ teams, sportName, loading = false }) => {
  // Calculate stats from provided team data
  const stats = useMemo(() => {
    if (!teams || teams.length === 0) {
      return {
        totalTeams: 0,
        totalPlayers: 0,
        averagePlayersPerTeam: 0,
        sportName: sportName || 'Unknown Sport'
      }
    }

    const totalTeams = teams.length
    const totalPlayers = teams.reduce((sum, team) => sum + (team.player_count || 0), 0)
    const averagePlayersPerTeam = totalTeams > 0 ? Math.round(totalPlayers / totalTeams) : 0

    return {
      totalTeams,
      totalPlayers,
      averagePlayersPerTeam,
      sportName: sportName || 'Unknown Sport'
    }
  }, [teams, sportName])

  if (loading) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4 flex justify-center items-center">
          <img src="/load.svg" alt="Loading" className="w-12" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-white/5 border-white/10">
      <CardHeader className="pb-3">
        <h3 className="text-lg font-medium text-white">Team Statistics</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-white/70">Teams:</span>
          </div>
          <Badge variant="secondary" className="bg-cranberry/20 text-cranberry">
            {stats.totalTeams}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-white/70">Total Players:</span>
          </div>
          <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
            {stats.totalPlayers}
          </Badge>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="w-4 h-4 text-green-500" />
            <span className="text-white/70">Avg per Team:</span>
          </div>
          <Badge variant="secondary" className="bg-green-500/20 text-green-300">
            {stats.averagePlayersPerTeam}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

export default TeamStats