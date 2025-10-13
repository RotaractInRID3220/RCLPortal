'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAtom } from 'jotai'
import { userDeetsAtom, loadingAtom } from '@/app/state/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { UserMinus, Users, AlertTriangle, Search } from 'lucide-react'
import { getPlayersByClub } from '@/services/playerService'
import { APP_CONFIG } from '@/config/app.config'
import { useDebounce } from '@/hooks/useDebounce'

const PlayersPage = () => {
  const [userDetails, setUserDetails] = useAtom(userDeetsAtom)
  const [loading, setLoading] = useAtom(loadingAtom)
  const [allPlayers, setAllPlayers] = useState([])
  const [dataLoading, setDataLoading] = useState(false)
  const [cleaningPlayers, setCleaningPlayers] = useState(false)
  const [hasLoadedData, setHasLoadedData] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const itemsPerPage = 10

  // Check if registration deadline has passed
  const isAfterDeadline = useMemo(() => {
    const currentDate = new Date();
    const deadlineDate = new Date(APP_CONFIG.REGISTRATION_DEADLINE);
    return currentDate > deadlineDate;
  }, []);

  useEffect(() => {
    if (userDetails?.club_id && !hasLoadedData && !dataLoading) {
      fetchPlayers()
    }
  }, [userDetails?.club_id, hasLoadedData, dataLoading])

  const fetchPlayers = useCallback(async () => {
    if (!userDetails?.club_id) return

    try {
      setDataLoading(true)
      const data = await getPlayersByClub(userDetails.club_id)
      setAllPlayers(data)
      setHasLoadedData(true)
    } catch (error) {
      console.error('Error fetching players:', error)
      toast.error('Failed to fetch players')
    } finally {
      setDataLoading(false)
    }
  }, [userDetails?.club_id])

  const cleanPlayers = async () => {
    if (!userDetails?.club_id) return

    try {
      setCleaningPlayers(true)

      const response = await fetch('/api/players/clean', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          club_id: userDetails.club_id
        })
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`Successfully removed ${result.deletedCount} players without registrations`)

        // Refresh players data
        setHasLoadedData(false)
        setCurrentPage(1)
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Failed to clean players')
      }
    } catch (error) {
      console.error('Error cleaning players:', error)
      toast.error('Failed to clean players: ' + error.message)
    } finally {
      setCleaningPlayers(false)
    }
  }

  // Filter players based on search term
  const filteredPlayers = useMemo(() => {
    if (!debouncedSearchTerm) return allPlayers

    return allPlayers.filter(player =>
      player.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      player.RMIS_ID?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    )
  }, [allPlayers, debouncedSearchTerm])

  // Paginate filtered players
  const paginatedPlayers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredPlayers.slice(startIndex, endIndex)
  }, [filteredPlayers, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredPlayers.length / itemsPerPage)

  // Calculate general member percentage for warning
  const generalMembers = allPlayers.filter(player => player.status === 1).length
  const totalMembers = allPlayers.length
  const generalPercentage = totalMembers > 0 ? (generalMembers / totalMembers) * 100 : 0
  const showWarning = generalPercentage < APP_CONFIG.GENERAL_MEMBER_WARNING_THRESHOLD && totalMembers > 0

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearchTerm])

  // Pagination controls
  const PaginationControls = useMemo(() => {
    if (totalPages <= 1) return null

    const pages = []
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button
          key={i}
          variant={i === currentPage ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCurrentPage(i)}
          className={`
            ${i === currentPage
              ? 'bg-cranberry hover:bg-cranberry/90 text-white cursor-pointer'
              : 'bg-transparent border border-white/20 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer'
            }
          `}
        >
          {i}
        </Button>
      )
    }

    return (
      <div className="flex items-center justify-center space-x-2 mt-6 mb-5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="bg-transparent border border-white/20 cursor-pointer text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          Previous
        </Button>
        {pages}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="bg-transparent border border-white/20 cursor-pointer text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          Next
        </Button>
      </div>
    )
  }, [totalPages, currentPage])

  if (dataLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cranberry"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex w-full justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold tracking-wide">PLAYERS</h1>
        {!isAfterDeadline && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={cleaningPlayers}
                className="bg-red-500/20 border border-red-500 hover:bg-red-500/30 text-red-200"
              >
                <UserMinus className="w-4 h-4 mr-2" />
                {cleaningPlayers ? 'Cleaning...' : 'Clean Players'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-gray-900 border-gray-700">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Clean Players</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-300">
                  This will remove all players from your club who don't have any sport registrations.
                  This action cannot be undone. Are you sure you want to continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-gray-700 hover:bg-gray-600">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={cleanPlayers}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Clean Players
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Warning message for low general member percentage */}
      {showWarning && (
        <div className="mb-6 px-4 py-3 bg-yellow-500/20 border border-yellow-400 rounded-lg flex items-center gap-3">
          <AlertTriangle className="text-yellow-400 w-5 h-5 flex-shrink-0" />
          <div className="text-yellow-200">
            <div className="font-medium">Low general membership ratio</div>
            <div className="text-sm text-yellow-200/80">
              Only {generalPercentage.toFixed(1)}% of your players are general members ({generalMembers}/{totalMembers}).
              Consider registering more general members to meet the {APP_CONFIG.GENERAL_MEMBER_WARNING_THRESHOLD}% threshold.
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-cranberry/10 border-cranberry">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Total Players</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cranberry">{totalMembers}</div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">General Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{generalMembers}</div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Prospective Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">{totalMembers - generalMembers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by name or RMIS ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
          />
        </div>
      </div>

      {/* Players Table */}
      <div className="bg-white/5 border border-white/20 rounded-lg overflow-hidden">
        {paginatedPlayers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">
              {searchTerm ? 'No players found matching your search.' : 'No players found for your club.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                      Player Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                      RMIS ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {paginatedPlayers.map((player) => (
                    <tr key={player.RMIS_ID} className="hover:bg-white/5">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {player.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                        {player.RMIS_ID || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={`border ${
                          player.status === 1
                            ? 'bg-green-500/20 text-green-200 border-green-400'
                            : player.status === 5
                            ? 'bg-blue-500/20 text-blue-200 border-blue-400'
                            : 'bg-gray-500/20 text-gray-200 border-gray-400'
                        }`}>
                          {player.status === 1 ? 'General' : player.status === 5 ? 'Prospective' : 'Unknown'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {PaginationControls}

            {/* Results info */}
            <div className="px-6 py-3 bg-white/5 text-sm text-white/70 text-center">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredPlayers.length)} of {filteredPlayers.length} results
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default PlayersPage