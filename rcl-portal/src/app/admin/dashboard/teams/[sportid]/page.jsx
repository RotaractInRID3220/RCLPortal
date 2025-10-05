'use client'
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { ArrowLeft, Search, Trash2, Users } from 'lucide-react'
import AddTeamsButton from '../components/AddTeamsButton'
import TeamStats from '../components/TeamStats'
import ManualTeamAddition from '../components/ManualTeamAddition'
import NonEligibleClubs from '../components/NonEligibleClubs'

const SportTeamsPage = ({ params }) => {
  const router = useRouter()
  const [teams, setTeams] = useState([])
  const [allTeams, setAllTeams] = useState([]) // Store all teams for local search
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sportName, setSportName] = useState('')
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [showPlayerDetails, setShowPlayerDetails] = useState(null)
  const [eligibleClubs, setEligibleClubs] = useState([]) // Clubs that can have teams but don't

  // Unwrap params using React.use()
  const unwrappedParams = React.use(params)
  const sportId = unwrappedParams.sportid

  // Fetch teams for this sport
  const fetchTeams = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/teams?sport_id=${sportId}`)
      const data = await response.json()
      
      if (response.ok) {
        setAllTeams(data.teams || [])
        setSportName(data.sport_name || 'Unknown Sport')
        setEligibleClubs(data.eligible_clubs || [])
      } else {
        toast.error(data.error || 'Failed to fetch teams')
      }
    } catch (error) {
      console.error('Error fetching teams:', error)
      toast.error('Failed to fetch teams')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sportId) {
      fetchTeams()
    }
  }, [sportId])

  // Local search effect
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setTeams(allTeams)
    } else {
      const filtered = allTeams.filter(team =>
        team.clubs.club_name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setTeams(filtered)
    }
  }, [searchTerm, allTeams])

  // Debounced search - removed since we're doing local search now

  const handleDeleteTeam = async (teamId, clubName) => {
    try {
      const response = await fetch(`/api/teams?team_id=${teamId}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (result.success) {
        toast.success(`Team from ${clubName} deleted successfully`)
        // Refetch teams data
        fetchTeams()
      } else {
        toast.error(result.error || 'Failed to delete team')
      }
    } catch (error) {
      console.error('Error deleting team:', error)
      toast.error('Failed to delete team. Please try again.')
    }
  }

  const togglePlayerDetails = (teamId) => {
    setShowPlayerDetails(showPlayerDetails === teamId ? null : teamId)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <img src="/load.svg" alt="Loading" className="w-20" />
      </div>
    )
  }

  const totalTeams = teams.length
  const totalPlayers = teams.reduce((sum, team) => sum + team.player_count, 0)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Button
            size="sm"
            onClick={() => router.back()}
            className="text-white/70 hover:text-white hover:bg-white/10 bg-white/5 border border-white/10 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-wide">{sportName.toUpperCase()} TEAMS</h1>
            {/* <div className="flex items-center space-x-4 mt-2">
              <Badge variant="secondary" className="bg-cranberry/20 text-cranberry">
                {totalTeams} Teams
              </Badge>
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
                {totalPlayers} Players
              </Badge>
            </div> */}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <NonEligibleClubs
            sportId={sportId}
            sportName={sportName}
          />
          <ManualTeamAddition
            sportId={sportId}
            sportName={sportName}
            onTeamAdded={fetchTeams}
          />
          <AddTeamsButton 
            sportId={parseInt(sportId)}
            sportName={sportName}
            onTeamsCreated={fetchTeams}
            size="sm"
          />
        </div>
      </div>


      {/* Teams List */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Stats Sidebar */}
        <div className="lg:col-span-1 flex flex-col space-y-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
          <Input
            placeholder="Search clubs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder-white/50"
          />
        </div>
          <TeamStats 
            teams={allTeams} 
            sportName={sportName} 
            loading={loading}
          />
        </div>
        
        {/* Teams List */}
        <div className="lg:col-span-3 space-y-4">
          {/* Eligible Clubs Without Teams */}
          {eligibleClubs && eligibleClubs.length > 0 && (
            <Card className="bg-yellow-500/10 border-yellow-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-yellow-200">
                    Clubs Without Teams ({eligibleClubs.length})
                  </h3>
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300">
                    Can be added manually
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {eligibleClubs.map((club) => (
                    <div key={club.club_id} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg">
                      <span className="text-white text-sm">{club.club_name}</span>
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 text-xs">
                        {club.count} players
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing Teams */}
        {teams.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-white/70 mb-4">No teams found for this sport</div>
            <div className="text-white/50 text-sm">
              {searchTerm ? 'Try adjusting your search term.' : 'Click "Create Teams" to generate teams based on registrations.'}
            </div>
          </div>
        ) : (
          teams.map((team) => (
            <Card key={team.team_id} className="bg-white/5 border-white/10">
              <CardHeader className="pb-3 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-white">
                      {team.clubs.club_name}
                    </h3>
                    <Badge variant="secondary" className="bg-green-500/20 text-green-300">
                      {team.player_count} players
                    </Badge>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePlayerDetails(team.team_id)}
                      className="text-blue-300 hover:text-blue-200 hover:bg-blue-500/10 cursor-pointer"
                    >
                      <Users className="w-4 h-4 " />
                      {showPlayerDetails === team.team_id ? 'Hide' : 'View'} Players
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-slate-800 border-slate-700">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Delete Team</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-300">
                            Are you sure you want to delete the team from {team.clubs.club_name}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-slate-700 text-white border-slate-600">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTeam(team.team_id, team.clubs.club_name)}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              
              {showPlayerDetails === team.team_id && (
                <CardContent className="pt-0">
                  <div className="border-t border-white/10 pt-4">
                    <h4 className="text-sm font-medium text-white/70 mb-3">Registered Players:</h4>
                    <div className="space-y-2">
                      {team.registrations && team.registrations.length > 0 ? (
                        team.registrations
                          .sort((a, b) => {
                            // Sort main players first
                            if (a.main_player === true && b.main_player === false) return -1;
                            if (a.main_player === false && b.main_player === true) return 1;
                            return 0;
                          })
                          .map((reg, index) => (
                          <div key={reg.RMIS_ID} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <span className="text-xs text-white/50 w-6">
                                {index + 1}.
                              </span>
                              <span className="text-white">
                                {reg.players.name}
                              </span>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${
                                  reg.main_player === true 
                                    ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                }`}
                              >
                                {reg.main_player === true ? 'Main' : 'Reserve'}
                              </Badge>
                            </div>
                            <span className="text-xs text-white/50">
                              ID: {reg.RMIS_ID}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-white/50 italic">No player details available</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
        </div>
      </div>
    </div>
  )
}

export default SportTeamsPage