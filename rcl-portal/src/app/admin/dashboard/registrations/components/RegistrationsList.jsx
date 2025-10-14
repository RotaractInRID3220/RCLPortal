'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useAtom } from 'jotai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Download, Search, RefreshCw, Filter } from 'lucide-react'
import { getRegistrationsWithPlayerData, convertPlayer } from '@/services/registrationService'
import RegistrationStats from './RegistrationStats'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { useDebounce } from '@/hooks/useDebounce'
import { userDeetsAtom } from '@/app/state/store'

const RegistrationsList = React.memo(({ event, clubId, sportId, onBack, filterType }) => {
  const { data: session } = useSession()
  const [userDeets] = useAtom(userDeetsAtom)
  const [allRegistrations, setAllRegistrations] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [showUniqueRMIS, setShowUniqueRMIS] = useState(false)
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [registrationToConvert, setRegistrationToConvert] = useState(null)
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const itemsPerPage = 8

  // Filter registrations for unique RMIS IDs if toggle is active
  const filteredRegistrations = useMemo(() => {
    if (!showUniqueRMIS) return registrations
    
    const seenRMIS = new Set()
    return registrations.filter(registration => {
      const rmisId = registration.players?.RMIS_ID
      if (!rmisId || seenRMIS.has(rmisId)) return false
      seenRMIS.add(rmisId)
      return true
    })
  }, [registrations, showUniqueRMIS])

  // Get all filtered data for export
  const allFilteredRegistrations = useMemo(() => {
    if (!showUniqueRMIS) return allRegistrations
    
    const seenRMIS = new Set()
    return allRegistrations.filter(registration => {
      const rmisId = registration.players?.RMIS_ID
      if (!rmisId || seenRMIS.has(rmisId)) return false
      seenRMIS.add(rmisId)
      return true
    })
  }, [allRegistrations, showUniqueRMIS])

  // Check if user has admin permissions
  const isAdmin = useMemo(() => {
    const adminCheck = session?.user?.hasAdminAccess || userDeets?.permission_level === 'admin' || userDeets?.permission_level === 'super_admin'
    console.log('Session user:', session?.user)
    console.log('User details:', userDeets)
    console.log('Is admin:', adminCheck)
    return adminCheck
  }, [session, userDeets])

  const fetchAllRegistrations = useCallback(async (search = '') => {
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

      // Fetch all data at once (reasonable limit to prevent memory issues)
      const result = await getRegistrationsWithPlayerData(filters, {
        page: 1,
        limit: 5000, // Fetch up to 5000 records for client-side pagination
        search
      })
      
      if (result.success) {
        const allData = result.data || []
        setAllRegistrations(allData)
        setTotalCount(result.totalCount || result.count || allData.length)
        
        // Calculate total pages based on itemsPerPage
        const calculatedTotalPages = Math.ceil(allData.length / itemsPerPage)
        setTotalPages(calculatedTotalPages || 1)
        
        // Set current page data
        const startIndex = 0
        const endIndex = itemsPerPage
        setRegistrations(allData.slice(startIndex, endIndex))
        setCurrentPage(1)
      } else {
        toast.error('Failed to fetch registrations')
        setAllRegistrations([])
        setRegistrations([])
        setTotalCount(0)
        setTotalPages(1)
      }
    } catch (error) {
      console.error('Error fetching registrations:', error)
      toast.error('Error loading registrations')
      setAllRegistrations([])
      setRegistrations([])
      setTotalCount(0)
      setTotalPages(1)
    } finally {
      setLoading(false)
    }
  }, [event, clubId, sportId, filterType, itemsPerPage])

  // Fetch all data when filters or search changes
  useEffect(() => {
    fetchAllRegistrations(debouncedSearchTerm)
  }, [fetchAllRegistrations, debouncedSearchTerm])

  // Handle client-side pagination
  const handlePageChange = useCallback((newPage) => {
    const startIndex = (newPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    setRegistrations(allRegistrations.slice(startIndex, endIndex))
    setCurrentPage(newPage)
  }, [allRegistrations, itemsPerPage])

  const handleExportExcel = useCallback(async () => {
    try {
      // Use already fetched data for export
      const dataToExport = allFilteredRegistrations

      // Prepare Excel data
      const excelData = dataToExport.map(registration => ({
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
        const clubName = allRegistrations[0]?.clubs?.club_name || clubId
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
  }, [filterType, event, clubId, allFilteredRegistrations, allRegistrations])

  const handleConvertClick = useCallback((registration) => {
    setRegistrationToConvert(registration)
    setShowConvertDialog(true)
  }, [])

  const handleConvertConfirm = useCallback(async () => {
    const membershipId = session?.user?.membership_id || userDeets?.membership_id
    if (!registrationToConvert || !membershipId) {
      console.log('Missing data:', { registrationToConvert, membershipId, session: session?.user, userDeets })
      toast.error('Missing registration data or user session')
      return
    }

    try {
      const result = await convertPlayer(
        registrationToConvert.players.RMIS_ID,
        membershipId
      )

      if (result.success) {
                toast.success('Player converted successfully')
        
        // Update the local data
        setAllRegistrations(prev => 
          prev.map(reg => 
            reg.RMIS_ID === registrationToConvert.players.RMIS_ID && reg.sport_id === registrationToConvert.sport_id
              ? { 
                  ...reg, 
                  players: {
                    ...reg.players,
                    status: 5, 
                    converted: true, 
                    converted_by: membershipId 
                  }
                }
              : reg
          )
        )
        
        // Update current page data as well
        setRegistrations(prev => 
          prev.map(reg => 
            reg.RMIS_ID === registrationToConvert.players.RMIS_ID && reg.sport_id === registrationToConvert.sport_id
              ? { 
                  ...reg, 
                  players: {
                    ...reg.players,
                    status: 5, 
                    converted: true, 
                    converted_by: membershipId 
                  }
                }
              : reg
          )
        )
      } else {
        toast.error(result.error || 'Failed to convert registration')
      }
    } catch (error) {
      console.error('Error converting registration:', error)
      toast.error('An error occurred while converting the registration')
    } finally {
      setShowConvertDialog(false)
      setRegistrationToConvert(null)
    }
  }, [registrationToConvert, session, userDeets])

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
                : `${registrations[0]?.clubs?.club_name}`
              }
              {showUniqueRMIS && <span className="text-cranberry ml-2">- Unique RMIS IDs</span>}
            </h2>
          </div>
        </div>
        
        <Button
          onClick={handleExportExcel}
          disabled={allFilteredRegistrations.length === 0}
          className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 cursor-pointer"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Excel ({allFilteredRegistrations.length} records)
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center mt-40">
          <img src="/load.svg" alt="" className="w-20" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <RegistrationStats 
            registrations={filteredRegistrations} 
            totalCount={showUniqueRMIS ? allFilteredRegistrations.length : totalCount}
            fullData={allFilteredRegistrations}
          />

          {/* Search and Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
            
            <Button
              variant="outline"
              onClick={() => setShowUniqueRMIS(!showUniqueRMIS)}
              className={`${
                showUniqueRMIS 
                  ? 'bg-cranberry hover:bg-cranberry/90 text-white border-cranberry' 
                  : 'bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white'
              } cursor-pointer transition-colors`}
            >
              <Filter className="w-4 h-4 mr-2" />
              {showUniqueRMIS ? 'Show All Records' : 'Show Unique RMIS IDs'}
            </Button>
          </div>

          {/* Registrations List */}
          <div className="bg-white/5 border border-white/20 rounded-lg overflow-hidden">
            {filteredRegistrations.length === 0 ? (
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
                          RI ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                          Club
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                          {filterType === 'club' ? 'Status' : 'Player Type'}
                        </th>
                        {filterType === 'club' && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                            Sport
                          </th>
                        )}
                        {isAdmin && filterType !== 'sport' && (
                          <th className="px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {filteredRegistrations.map((registration, index) => (
                        <tr 
                          key={`${registration.RMIS_ID}-${registration.sport_id}-${index}`} 
                          className={`hover:bg-white/5 ${registration.players?.converted ? 'bg-red-500/10 ' : ''}`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                            {registration.players?.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                            {registration.players?.RMIS_ID || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                            {registration.players?.RI_ID || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                            {registration.clubs?.club_name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {filterType === 'club' ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                                registration.players?.status === 1 
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                                  : registration.players?.status === 5
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                              }`}>
                                {registration.players?.status === 1 ? 'GENERAL' : 
                                 registration.players?.status === 5 ? 'PROSPECTIVE' : 
                                 'UNKNOWN'}
                              </span>
                            ) : (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                registration.main_player 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              }`}>
                                {registration.main_player ? 'MAIN' : 'RESERVE'}
                              </span>
                            )}
                          </td>
                          {filterType === 'club' && (
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-white/70">
                              {registration.sports?.sport_name || 'N/A'} ({registration.sports?.gender_type || ''})
                            </td>
                          )}
                          {isAdmin && filterType !== 'sport' && (
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!registration.players?.status === 1 || registration.players?.converted}
                                className={`bg-transparent border border-white/20 text-white/70 hover:bg-white/10 hover:text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                                onClick={() => handleConvertClick(registration)}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
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
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, showUniqueRMIS ? allFilteredRegistrations.length : totalCount)} of {showUniqueRMIS ? allFilteredRegistrations.length : totalCount} results
                  {showUniqueRMIS && <span className="ml-2 text-cranberry">(Unique RMIS IDs only)</span>}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Convert Confirmation Dialog */}
      <AlertDialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <AlertDialogContent className="bg-gray-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Convert Registration</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Are you sure you want to convert this player? This will change the status to 5 and mark it as converted.
            </AlertDialogDescription>
            {registrationToConvert && (
              <div className="mt-4 p-3 bg-white/5 rounded-lg">
                <div className="text-sm text-white/70">
                  <strong>Player:</strong> {registrationToConvert.players?.name}<br />
                  <strong>RMIS ID:</strong> {registrationToConvert.players?.RMIS_ID}<br />
                  <strong>Sport:</strong> {registrationToConvert.sports?.sport_name}
                </div>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/20 text-white/70 hover:bg-white/10 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConvertConfirm}
              className="bg-cranberry hover:bg-cranberry/90 text-white"
            >
              Convert
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
})

RegistrationsList.displayName = 'RegistrationsList'

export default RegistrationsList
