'use client'
import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Download, Search } from 'lucide-react'
import { getRegistrationsWithPlayerData } from '@/services/registrationService'
import RegistrationStats from './RegistrationStats'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

const RegistrationsList = ({ event, clubId, sportId, onBack, filterType }) => {
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  useEffect(() => {
    fetchRegistrations()
  }, [event, clubId, sportId])

  const fetchRegistrations = async () => {
    try {
      setLoading(true)
      let filters = {}
      
      if (filterType === 'sport' && event) {
        filters.sport_id = event.sport_id
      }
      
      if (filterType === 'club') {
        if (clubId) filters.club_id = parseInt(clubId)
        if (sportId) filters.sport_id = parseInt(sportId)
      }

      const result = await getRegistrationsWithPlayerData(filters)
      if (result.success) {
        setRegistrations(result.data || [])
      } else {
        toast.error('Failed to fetch registrations')
      }
    } catch (error) {
      console.error('Error fetching registrations:', error)
      toast.error('Error loading registrations')
    } finally {
      setLoading(false)
    }
  }

  // Filter registrations based on search term
  const filteredRegistrations = useMemo(() => {
    if (!searchTerm) return registrations
    
    return registrations.filter(registration => {
      const playerName = registration.players?.name?.toLowerCase() || ''
      const rmisId = registration.players?.RMIS_ID?.toLowerCase() || ''
      const clubName = registration.clubs?.club_name?.toLowerCase() || ''
      const searchLower = searchTerm.toLowerCase()
      
      return playerName.includes(searchLower) || 
             rmisId.includes(searchLower) || 
             clubName.includes(searchLower)
    })
  }, [registrations, searchTerm])

  // Pagination
  const totalPages = Math.ceil(filteredRegistrations.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentRegistrations = filteredRegistrations.slice(startIndex, endIndex)

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const handleExportExcel = () => {
    try {
      // Prepare data for Excel
      const excelData = filteredRegistrations.map(registration => ({
        'RMIS ID': registration.players?.RMIS_ID || '',
        'Player Name': registration.players?.name || '',
        'Club Name': registration.clubs?.club_name || '',
        'Sport': registration.sports?.sport_name || '',
        'Gender Type': registration.sports?.gender_type || '',
        'Player Type': registration.main_player ? 'Main Player' : 'Reserve Player',
        'NIC': registration.players?.NIC || '',
        'Birthdate': registration.players?.birthdate || '',
        'Gender': registration.players?.gender || '',
        'Status': registration.players?.status || '',
        'RI ID': registration.players?.RI_ID || '',
        'Registration Date': new Date(registration.created_at).toLocaleDateString(),
      }))

      // Create worksheet and workbook
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations')

      // Generate filename
      let filename = 'registrations'
      if (filterType === 'sport' && event) {
        filename = `${event.sport_name}_registrations`
      } else if (filterType === 'club' && clubId) {
        const clubName = registrations[0]?.clubs?.club_name || clubId
        filename = `${clubName}_registrations`
      }
      filename += `_${new Date().toISOString().split('T')[0]}.xlsx`

      // Download file
      XLSX.writeFile(workbook, filename)
      toast.success('Excel file downloaded successfully')
    } catch (error) {
      console.error('Error exporting Excel:', error)
      toast.error('Failed to export Excel file')
    }
  }

  const renderPagination = () => {
    const pages = []
    const maxVisiblePages = 5
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
    
    if (endPage - startPage < maxVisiblePages - 1) {
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
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="bg-transparent border border-white/20 cursor-pointer text-white/70 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-medium tracking-wide">
              {filterType === 'sport' && event 
                ? `${event.sport_name} (${event.gender_type})` 
                : `${registrations[0]?.clubs?.club_name} ${sportId && registrations[0]?.sports && ` - ${registrations[0].sports.sport_name}`}`
              }
            </h2>
          </div>
        </div>
        
        <Button
          onClick={handleExportExcel}
          disabled={filteredRegistrations.length === 0}
          className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center mt-40">
          <img src="/load.svg" alt="" className="w-20" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <RegistrationStats registrations={registrations} />

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by name, RMIS ID, or club..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />
            </div>
          </div>

          {/* Registrations List */}
          <div className="bg-white/5 border border-white/20 rounded-lg overflow-hidden">
            {currentRegistrations.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">
                  {searchTerm ? 'No registrations found matching your search.' : 'No registrations found.'}
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
                          Club
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                          Player Type
                        </th>
                        {filterType === 'club' && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                            Sport
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {currentRegistrations.map((registration, index) => (
                        <tr key={`${registration.RMIS_ID}-${registration.sport_id}-${index}`} className="hover:bg-white/5">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                            {registration.players?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                            {registration.players?.RMIS_ID || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                            {registration.clubs?.club_name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              registration.main_player 
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}>
                              {registration.main_player ? 'Main Player' : 'Reserve Player'}
                            </span>
                          </td>
                          {filterType === 'club' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                              {registration.sports?.sport_name || 'N/A'} ({registration.sports?.gender_type || ''})
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && renderPagination()}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default RegistrationsList
