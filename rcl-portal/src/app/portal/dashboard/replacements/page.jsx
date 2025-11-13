'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAtom } from 'jotai'
import { toast } from 'sonner'
import {
  clubMembersAtom,
  userDeetsAtom,
} from '@/app/state/store'
import { APP_CONFIG } from '@/config/app.config'
import { getReplacementContext, submitReplacementRequest } from '@/services/replacementService'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  AlertCircle,
  Calendar,
  Clock,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'

const STATUS_META = {
  pending: { label: 'Pending', className: 'bg-yellow-500/20 text-yellow-200 border-yellow-500/40' },
  approved: { label: 'Approved', className: 'bg-green-500/20 text-green-200 border-green-500/40' },
  rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-200 border-red-500/40' },
}

const formatStatus = (value) => {
  if (value === true) return STATUS_META.approved
  if (value === false) return STATUS_META.rejected
  return STATUS_META.pending
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

const isGeneralStatus = (status) => status === 1 || status === 3

const buildConstraintSnapshot = (registrations = []) => {
  const track = {}
  const combined = {}

  registrations.forEach((entry) => {
    if (!entry?.sport_type || !entry?.sport_day) return

    if (entry.sport_type === 'trackIndividual') {
      track[entry.sport_day] = (track[entry.sport_day] || 0) + 1
    }

    if (entry.sport_type === 'team' || entry.sport_type === 'individual') {
      combined[entry.sport_day] = (combined[entry.sport_day] || 0) + 1
    }
  })

  return { track, combined }
}

const ReplacementRequestsPage = () => {
  const [userDeets] = useAtom(userDeetsAtom)
  const [clubMembers, setClubMembers] = useAtom(clubMembersAtom)
  const [context, setContext] = useState({
    sports: [],
    sportRegistrations: {},
    playerRegistrationMap: {},
    requests: [],
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [membersLoading, setMembersLoading] = useState(false)

  const [selectedSportId, setSelectedSportId] = useState('')
  const [selectedRegistrationId, setSelectedRegistrationId] = useState('')
  const [selectedReplacementId, setSelectedReplacementId] = useState('')
  const [reason, setReason] = useState('')
  const [riNumber, setRiNumber] = useState('')
  const [supportingLink, setSupportingLink] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replacementPopoverOpen, setReplacementPopoverOpen] = useState(false)

  const replacementCacheRef = useRef(null)

  const ensureClubMembers = useCallback(async () => {
    if (!userDeets?.club_id) return
    const hasMembersLoaded = Array.isArray(clubMembers) && clubMembers.length > 0
    if (hasMembersLoaded) return

    try {
      setMembersLoading(true)
      const response = await fetch(`/api/council?clubID=${userDeets.club_id}`)
      const data = await response.json()
      if (data.success && Array.isArray(data.members)) {
        setClubMembers(data.members)
      }
    } catch (error) {
      console.error('Failed to fetch club members for replacements:', error)
    } finally {
      setMembersLoading(false)
    }
  }, [clubMembers, setClubMembers, userDeets?.club_id])

  const loadContext = useCallback(
    async (force = false) => {
      if (!userDeets?.club_id) return

      try {
        if (force) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        const result = await getReplacementContext(userDeets.club_id)
        
        if (!result.success) {
          toast.error(result.error || 'Failed to load replacement data')
          return
        }

        console.log('Replacement context loaded:', result.data)

        setContext({
          sports: result.data?.sports || [],
          sportRegistrations: result.data?.sportRegistrations || {},
          playerRegistrationMap: result.data?.playerRegistrationMap || {},
          requests: result.data?.requests || [],
        })
      } catch (error) {
        console.error('Failed to load replacement dashboard:', error)
        toast.error('Failed to load replacement data')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [userDeets?.club_id]
  )

  useEffect(() => {
    ensureClubMembers()
  }, [ensureClubMembers])

  useEffect(() => {
    if (userDeets?.club_id) {
      loadContext()
    }
  }, [userDeets?.club_id, loadContext])

  const selectedSport = useMemo(() => {
    const numericId = Number(selectedSportId)
    if (!numericId) return null
    return context.sports.find((sport) => sport.sport_id === numericId) || null
  }, [context.sports, selectedSportId])

  const sportRegistrationsKey = selectedSport ? String(selectedSport.sport_id) : ''

  const registeredPlayers = useMemo(() => {
    if (!selectedSport || !sportRegistrationsKey) return []
    const registrationBlock = context.sportRegistrations?.[sportRegistrationsKey]
    return Array.isArray(registrationBlock) ? registrationBlock : []
  }, [context.sportRegistrations, selectedSport, sportRegistrationsKey])

  const selectedRegistration = useMemo(() => {
    const numericId = Number(selectedRegistrationId)
    if (!numericId) return null
    return registeredPlayers.find((player) => player.id === numericId) || null
  }, [registeredPlayers, selectedRegistrationId])

  const canMemberRegisterForSport = useCallback(
    (memberId, sport) => {
      if (!memberId || !sport) return false

      const registrationHistory = context.playerRegistrationMap?.[memberId] || []

      if (
        registrationHistory.some(
          (entry) => Number(entry?.sport_id) === Number(sport.sport_id)
        )
      ) {
        return false
      }

      const { track, combined } = buildConstraintSnapshot(registrationHistory)

      if (sport.sport_type === 'trackIndividual') {
        const dayCount = track[sport.sport_day] || 0
        return dayCount < 2
      }

      if (sport.sport_type === 'team' || sport.sport_type === 'individual') {
        const dayCount = combined[sport.sport_day] || 0
        return dayCount < 1
      }

      return true
    },
    [context.playerRegistrationMap]
  )

  const eligibleMembers = useMemo(() => {
    if (!selectedSport) return []

    const registeredIds = new Set(registeredPlayers.map((record) => record.RMIS_ID))
    const members = Array.isArray(clubMembers) ? clubMembers : []
    const sportGender = selectedSport.gender_type?.toLowerCase()

    return members
      .filter((member) => {
        if (!member?.membership_id) return false
        if (registeredIds.has(member.membership_id)) return false

        if (![1, 3, 5].includes(member.status)) {
          return false
        }

        if (sportGender === 'male' && member.gender !== 'M') {
          return false
        }

        if (sportGender === 'female' && member.gender !== 'F') {
          return false
        }

        return canMemberRegisterForSport(member.membership_id, selectedSport)
      })
      .sort((a, b) => (a.card_name || '').localeCompare(b.card_name || ''))
  }, [clubMembers, registeredPlayers, selectedSport, canMemberRegisterForSport])

  const selectedReplacementMember = useMemo(() => {
    if (!selectedReplacementId) return null
    return (
      eligibleMembers.find((member) => member.membership_id === selectedReplacementId) ||
      (Array.isArray(clubMembers)
        ? clubMembers.find((member) => member.membership_id === selectedReplacementId)
        : null)
    )
  }, [clubMembers, eligibleMembers, selectedReplacementId])

  const sportPlaceholder = useMemo(() => {
    if (!context.sports.length) return 'No registrations available yet'
    return 'Select a sport'
  }, [context.sports.length])

  const registeredPlayerPlaceholder = useMemo(() => {
    if (!selectedSport) return 'Select a sport first'
    if (!registeredPlayers.length) return 'No registered players for this sport'
    return 'Select a registered player'
  }, [registeredPlayers.length, selectedSport])

  const replacementButtonLabel = useMemo(() => {
    if (!selectedSport) return 'Select a sport first'
    if (!eligibleMembers.length) return 'No eligible replacements found'
    return 'Select a replacement player'
  }, [eligibleMembers.length, selectedSport])

  const requiresRiNumber = useMemo(() => {
    return selectedReplacementMember ? isGeneralStatus(selectedReplacementMember.status) : false
  }, [selectedReplacementMember])

  useEffect(() => {
    if (!selectedReplacementId) {
      replacementCacheRef.current = null
      setRiNumber('')
      return
    }

    if (replacementCacheRef.current === selectedReplacementId) {
      return
    }

    const member = Array.isArray(clubMembers)
      ? clubMembers.find((entry) => entry.membership_id === selectedReplacementId)
      : null

    setRiNumber(member?.ri_number || '')
    replacementCacheRef.current = selectedReplacementId
  }, [clubMembers, selectedReplacementId])

  const resetForm = useCallback(() => {
    setSelectedRegistrationId('')
    setSelectedReplacementId('')
    setReason('')
    setRiNumber('')
    setSupportingLink('')
  }, [])

  const handleSportChange = useCallback(
    (value) => {
      setSelectedSportId(value)
      resetForm()
    },
    [resetForm]
  )

  const handleReplacementSelect = useCallback((memberId) => {
    setSelectedReplacementId(memberId)
    setReplacementPopoverOpen(false)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!userDeets?.club_id || !selectedSport || !selectedRegistration || !selectedReplacementMember) {
      return
    }

    if (!reason.trim()) {
      toast.error('Please provide a reason for this replacement request')
      return
    }

    if (requiresRiNumber && !riNumber.trim()) {
      toast.error('RI number is required for general members')
      return
    }

    // Check if replacement player is already registered for another sport on the same day
    const replacementHistory = context.playerRegistrationMap?.[selectedReplacementMember.membership_id] || []
    const hasDayConflict = replacementHistory.some(
      (entry) => entry?.sport_day === selectedSport.sport_day
    )

    if (hasDayConflict) {
      toast.error('This player is already registered for another sport on the same day')
      return
    }

    const payload = {
      club_id: userDeets.club_id,
      sport_id: selectedSport.sport_id,
      registrations_id: selectedRegistration.id,
      replacement_member: {
        membership_id: selectedReplacementMember.membership_id,
        card_name: selectedReplacementMember.card_name,
        status: selectedReplacementMember.status,
        ri_number: selectedReplacementMember.ri_number,
        gender: selectedReplacementMember.gender,
        nic: selectedReplacementMember.nic || null,
        birthdate: selectedReplacementMember.birthdate || null,
      },
      reason: reason.trim(),
      supporting_link: supportingLink?.trim() || null,
      ri_number: riNumber?.trim() || null,
      requested_by: userDeets?.membership_id || null,
    }

    try {
      setSubmitting(true)
      const result = await submitReplacementRequest(payload)
      
      if (!result.success) {
        toast.error(result.error || 'Failed to submit replacement request')
        return
      }

      toast.success('Replacement request submitted')
      await loadContext(true)
      resetForm()
    } catch (error) {
      console.error('Failed to submit replacement request:', error)
      toast.error('Failed to submit replacement request')
    } finally {
      setSubmitting(false)
    }
  }, [
    context,
    loadContext,
    reason,
    resetForm,
    requiresRiNumber,
    riNumber,
    selectedReplacementMember,
    selectedRegistration,
    selectedSport,
    supportingLink,
    userDeets,
  ])

  const isFormValid = useMemo(() => {
    return (
      Boolean(selectedSport && selectedRegistration && selectedReplacementMember) &&
      Boolean(reason.trim()) &&
      (!requiresRiNumber || Boolean(riNumber.trim()))
    )
  }, [reason, requiresRiNumber, riNumber, selectedRegistration, selectedReplacementMember, selectedSport])

  const requests = useMemo(() => context.requests || [], [context.requests])

  const requestStats = useMemo(() => {
    const stats = { total: requests.length, pending: 0, approved: 0, rejected: 0 }
    requests.forEach((request) => {
      const meta = formatStatus(request.status)
      if (meta.label === 'Approved') {
        stats.approved += 1
      } else if (meta.label === 'Rejected') {
        stats.rejected += 1
      } else {
        stats.pending += 1
      }
    })
    return stats
  }, [requests])

  const selectedRegistrationSummary = useMemo(() => {
    if (!selectedRegistration) return null
    const player = selectedRegistration.player
    return {
      name: player?.name || selectedRegistration.RMIS_ID,
      id: selectedRegistration.RMIS_ID,
      role: selectedRegistration.main_player ? 'Main Player' : 'Reserve',
    }
  }, [selectedRegistration])

  const selectedReplacementSummary = useMemo(() => {
    if (!selectedReplacementMember) return null
    return {
      name: selectedReplacementMember.card_name,
      id: selectedReplacementMember.membership_id,
      status: isGeneralStatus(selectedReplacementMember.status) ? 'General Member' : 'Prospective Member',
    }
  }, [selectedReplacementMember])

  const loadingState = loading || membersLoading

  // Deadline checks
  const now = new Date()
  const replacementOpening = new Date(APP_CONFIG.REPLACEMENT_OPENING)
  const replacementDeadline = new Date(APP_CONFIG.REPLACEMENT_DEADLINE)
  const eventDay = new Date(APP_CONFIG.EVENT_DAY)

  const isBeforeRegistrationClose = now < replacementOpening
  const isAfterReplacementDeadline = now > replacementDeadline
  const isWithinReplacementWindow = !isBeforeRegistrationClose && !isAfterReplacementDeadline

  const formatDeadlineDate = (date) => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loadingState) {
    return (
      <div className="flex justify-center items-center mt-40">
        <img src="/load.svg" alt="Loading" className="w-20" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Player Replacements</h1>
          <p className="text-sm text-white/60 mt-1">Request player replacements for registered events.</p>
        </div>
        {/* <Button
          variant="outline"
          className="bg-white/10 border-white/20 text-white/80 hover:bg-white/15 cursor-pointer"
          onClick={() => loadContext(true)}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button> */}
      </div>

      {isBeforeRegistrationClose && (
        <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-900/20 via-amber-800/10 to-transparent p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -z-10" />
          <div className="flex flex-col items-center text-center gap-5">
            <div className="p-4 rounded-full bg-amber-500/20 border border-amber-500/30">
              <Clock className="w-8 h-8 text-amber-200" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">Registration Period Active</h2>
              <p className="text-white/70 max-w-2xl">
                Player replacement requests will be available after the registration period closes. 
                Continue registering your players until the deadline.
              </p>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-lg bg-amber-500/15 border border-amber-500/25">
              <Calendar className="w-5 h-5 text-amber-200" />
              <div className="text-left">
                <p className="text-xs text-amber-200/70 uppercase tracking-wide">Replacements open after</p>
                <p className="text-sm font-semibold text-amber-100">{formatDeadlineDate(replacementOpening)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAfterReplacementDeadline && (
        <div className="relative overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-br from-red-900/20 via-red-800/10 to-transparent p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl -z-10" />
          <div className="flex flex-col items-center text-center gap-5">
            <div className="p-4 rounded-full bg-red-500/20 border border-red-500/30">
              <AlertCircle className="w-8 h-8 text-red-200" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white">Replacement Window Closed</h2>
              <p className="text-white/70 max-w-2xl">
                The deadline for player replacement requests has passed. 
                All teams are now finalized for the upcoming event.
              </p>
            </div>
            <div className="flex items-center gap-3 px-6 py-3 rounded-lg bg-red-500/15 border border-red-500/25">
              <Calendar className="w-5 h-5 text-red-200" />
              <div className="text-left">
                <p className="text-xs text-red-200/70 uppercase tracking-wide">Event begins</p>
                <p className="text-sm font-semibold text-red-100">{formatDeadlineDate(eventDay)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {isWithinReplacementWindow && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                handleSubmit()
              }}
              className="bg-white/5 border border-white/15 rounded-xl p-6 space-y-6"
            >
              <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Info className="w-5 h-5 text-blue-200 flex-shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="text-blue-100 font-medium">Replacement window is active</p>
                  <p className="text-blue-200/80">
                    Submit requests before {formatDeadlineDate(replacementDeadline)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white/60">Sport</label>
                  <Select value={selectedSportId} onValueChange={handleSportChange}>
                    <SelectTrigger className="w-full bg-white/10 border-white/20 text-white/90">
                      <SelectValue placeholder={sportPlaceholder} />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border border-white/15 text-white">
                      {context.sports.length === 0 && (
                        <SelectItem disabled value="none">
                          No registrations available
                        </SelectItem>
                      )}
                      {context.sports.map((sport) => (
                        <SelectItem key={sport.sport_id} value={String(sport.sport_id)}>
                          {sport.sport_name} · {sport.gender_type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white/60">Registered player</label>
                  <Select
                    value={selectedRegistrationId}
                    onValueChange={setSelectedRegistrationId}
                    disabled={!selectedSport || !registeredPlayers.length}
                  >
                    <SelectTrigger className="w-full bg-white/10 border-white/20 text-white/90 disabled:opacity-50">
                      <SelectValue placeholder={registeredPlayerPlaceholder} />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border border-white/15 text-white max-h-72">
                      {registeredPlayers.map((player) => (
                        <SelectItem key={player.id} value={String(player.id)}>
                          {player.player?.name || player.RMIS_ID}
                          {player.main_player ? ' • Main' : ' • Reserve'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white/60">Replacement player</label>
                  <Popover open={replacementPopoverOpen} onOpenChange={setReplacementPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={!selectedSport || !eligibleMembers.length}
                        className="w-full justify-between bg-white/10 border-white/20 text-white/90 disabled:opacity-50"
                      >
                        {selectedReplacementMember ? (
                          <span>
                            {selectedReplacementMember.card_name}
                            <span className="text-white/40 ml-2 text-xs uppercase">
                              {isGeneralStatus(selectedReplacementMember.status) ? 'General' : 'Prospective'}
                            </span>
                          </span>
                        ) : (
                          <span>{replacementButtonLabel}</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="p-0 w-[360px] bg-black/90 border border-white/15">
                      <Command>
                        <CommandInput placeholder="Search members..." className="text-white" />
                        <CommandList>
                          <CommandEmpty>No eligible members found.</CommandEmpty>
                          <CommandGroup>
                            {eligibleMembers.map((member) => (
                              <CommandItem
                                key={member.membership_id}
                                value={member.card_name}
                                onSelect={() => handleReplacementSelect(member.membership_id)}
                                className="text-white"
                              >
                                <div className="flex flex-col">
                                  <span className="font-medium">{member.card_name}</span>
                                  <span className="text-xs text-white/50">{member.membership_id}</span>
                                </div>
                                <Badge
                                  className={`ml-auto ${
                                    isGeneralStatus(member.status)
                                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                                      : 'bg-blue-500/15 text-blue-200 border border-blue-500/30'
                                  }`}
                                >
                                  {isGeneralStatus(member.status) ? 'General' : 'Prospective'}
                                </Badge>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white/60">Reason</label>
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    className="w-full h-[140px] bg-white/10 border border-white/20 rounded-lg p-3 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-cranberry/40 resize-none"
                    placeholder="Explain why this replacement is needed"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-white/60">
                      Supporting link <span className="text-white/40">(optional)</span>
                    </label>
                    <Input
                      value={supportingLink}
                      onChange={(event) => setSupportingLink(event.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                  </div>
                  {selectedReplacementMember && requiresRiNumber && (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-white/60">
                        RI number <span className="text-cranberry">*</span>
                      </label>
                      <Input
                        value={riNumber}
                        onChange={(event) => setRiNumber(event.target.value)}
                        placeholder="Enter RI number"
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={!isFormValid || submitting}
                  className="bg-cranberry hover:bg-cranberry/90 text-white cursor-pointer disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Submit request
                </Button>
              </div>
            </form>

            <div className="rounded-xl border border-white/15 bg-white/5 p-5 lg:w-64 space-y-3">
              <h3 className="font-semibold">Overview</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/60">Total</span>
                  <span className="font-semibold">{requestStats.total}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-yellow-200/80">Pending</span>
                  <span className="font-semibold text-yellow-200">{requestStats.pending}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-green-200/80">Approved</span>
                  <span className="font-semibold text-green-200">{requestStats.approved}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-red-200/80">Rejected</span>
                  <span className="font-semibold text-red-200">{requestStats.rejected}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <section className="bg-white/5 border border-white/15 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">Submitted Requests</h2>
          <span className="text-sm text-white/50">{requests.length} total</span>
        </div>
        {requests.length === 0 ? (
          <div className="p-8 text-center text-white/60">
            No replacement requests have been submitted yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-white/10 text-white/70">
                <TableHead className="text-white/80">Sport</TableHead>
                <TableHead className="text-white/80">Original player</TableHead>
                <TableHead className="text-white/80">Replacement</TableHead>
                <TableHead className="text-white/80">Reason</TableHead>
                <TableHead className="text-white/80">Supporting docs</TableHead>
                <TableHead className="text-white/80">Submitted</TableHead>
                <TableHead className="text-white/80">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => {
                const meta = formatStatus(request.status)
                return (
                  <TableRow key={request.id} className="border-white/10">
                    <TableCell className="text-white/90">
                      <div className="flex flex-col">
                        <span className="font-semibold">{request.sport?.sport_name || '—'}</span>
                        <span className="text-xs text-white/50">{request.sport?.gender_type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/80">
                      <div className="flex flex-col">
                        <span className="font-medium">{request.original_player?.name || 'Unknown Player'}</span>
                        <span className="text-xs text-white/50">{request.original_player?.RMIS_ID || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/80">
                      <div className="flex flex-col">
                        <span className="font-medium">{request.replacement_player?.name || 'Unknown Player'}</span>
                        <span className="text-xs text-white/50">{request.replacement_player?.RMIS_ID || 'N/A'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-white/70 max-w-xs">
                      <span className="line-clamp-2">{request.reason}</span>
                    </TableCell>
                    <TableCell className="text-white/70">
                      {request.supporting_link ? (
                        <Link
                          href={request.supporting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-blue-200 hover:text-blue-100"
                        >
                          View <ExternalLink className="w-4 h-4" />
                        </Link>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-white/70 text-sm">{formatDateTime(request.created_at)}</TableCell>
                    <TableCell>
                      <Badge className={`uppercase tracking-wide ${meta.className}`}>{meta.label}</Badge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}

export default ReplacementRequestsPage
