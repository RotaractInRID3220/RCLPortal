'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Download, Search } from 'lucide-react'
import { getRegistrationsWithPlayerData } from '@/services/registrationService'
import RegistrationStats from './RegistrationStats'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { useDebounce } from '@/hooks/useDebounce'

const RegistrationsList = React.memo(({ event, clubId, sportId, onBack, filterType }) => {
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const itemsPerPage = 8

  const fetchRegistrations = useCallback(async (page = 1, search = '') => {
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

      const result = await getRegistrationsWithPlayerData(filters, {
        page,
        limit: itemsPerPage,
        search
      })
      
      if (result.success) {
        setRegistrations(result.data || [])
        setTotalPages(result.totalPages || 1)
        setTotalCount(result.totalCount || result.count || 0)
      } else {
        toast.error('Failed to fetch registrations')
      }
    } catch (error) {
      console.error('Error fetching registrations:', error)
      toast.error('Error loading registrations')
    } finally {
      setLoading(false)
    }
  }, [event, clubId, sportId, filterType, itemsPerPage])

  // Fetch data when filters or search changes
  useEffect(() => {
    fetchRegistrations(1, debouncedSearchTerm)
    setCurrentPage(1)
  }, [fetchRegistrations, debouncedSearchTerm])

  // Fetch data when page changes
  useEffect(() => {
    if (currentPage > 1) {
      fetchRegistrations(currentPage, debouncedSearchTerm)
    }
  }, [currentPage, fetchRegistrations, debouncedSearchTerm])

  const handlePageChange = useCallback((newPage) => {
    setCurrentPage(newPage)
  }, [])

  const handleExportExcel = useCallback(async () => {
    try {
      // Fetch all data for export without pagination
      const filters = {}
      if (filterType === 'sport' && event) {
        filters.sport_id = event.sport_id
      }
      if (filterType === 'club') {
        if (clubId) filters.club_id = parseInt(clubId)
        if (sportId) filters.sport_id = parseInt(sportId)
      }

      const result = await getRegistrationsWithPlayerData(filters, {
        page: 1,
        limit: 10000, // Large limit for export
        search: debouncedSearchTerm
      })

      if (!result.success) {
        toast.error('Failed to fetch data for export')
        return
      }

      // Prepare Excel data
      const excelData = result.data.map(registration => ({
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
        const clubName = result.data[0]?.clubs?.club_name || clubId
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
  }, [filterType, event, clubId, sportId, debouncedSearchTerm])

  // Memoized pagination component
  const PaginationControls = useMemo(() => {
    if (totalPages <= 1) return null;

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
          onClick={() => handlePageChange(i)}
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
          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="bg-transparent border border-white/20 cursor-pointer text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          Previous
        </Button>
        {pages}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="bg-transparent border border-white/20 cursor-pointer text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
        >
          Next
        </Button>
      </div>
    )
  }, [totalPages, currentPage, handlePageChange])

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
          disabled={totalCount === 0}
          className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Excel ({totalCount} records)
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center mt-40">
          <img src="/load.svg" alt="" className="w-20" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <RegistrationStats registrations={registrations} totalCount={totalCount} />

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
            {registrations.length === 0 ? (
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
                      {registrations.map((registration, index) => (
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
                {PaginationControls}
                
                {/* Results info */}
                <div className="px-6 py-3 bg-white/5 text-sm text-white/70 text-center">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} results
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
})

RegistrationsList.displayName = 'RegistrationsList'

export default RegistrationsList
