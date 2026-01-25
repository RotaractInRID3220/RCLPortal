'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { fetchDayRegistrationsByEvent } from '@/services/dayRegistrationService'
import { SPORT_DAYS } from '@/config/app.config'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RefreshCw, Users, CalendarCheck, ChevronDown, ChevronUp } from 'lucide-react'

const DayRegistrationsPage = () => {
  const [data, setData] = useState({ events: [], summary: null })
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState('all')
  const [expandedEvents, setExpandedEvents] = useState({})

  const sportDayOptions = useMemo(() => [
    { value: 'all', label: 'All Days' },
    ...Object.values(SPORT_DAYS).map(day => ({
      value: day.value,
      label: day.label
    }))
  ], [])

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const sportDay = selectedDay === 'all' ? null : selectedDay
      const result = await fetchDayRegistrationsByEvent(sportDay)
      setData(result)
      
      // Auto-expand events with registrations
      const expanded = {}
      result.events.forEach(event => {
        if (event.registrationCount > 0) {
          expanded[event.sport_id] = true
        }
      })
      setExpandedEvents(expanded)
    } catch (error) {
      toast.error('Failed to fetch day registrations')
    } finally {
      setLoading(false)
    }
  }, [selectedDay])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    fetchData()
  }

  const toggleEventExpansion = (sportId) => {
    setExpandedEvents(prev => ({
      ...prev,
      [sportId]: !prev[sportId]
    }))
  }

  const formatDateTime = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const { instituteSports, communitySports } = useMemo(() => {
    const instituteSports = data.events.filter(event => event.category === 'institute')
    const communitySports = data.events.filter(event => event.category === 'community')
    return { instituteSports, communitySports }
  }, [data.events])

  const renderEventCard = (event) => {
    const isExpanded = expandedEvents[event.sport_id]
    const hasRegistrations = event.registrationCount > 0

    return (
      <div
        key={event.sport_id}
        className="bg-white/5 border border-white/10 rounded-lg overflow-hidden"
      >
        <button
          onClick={() => toggleEventExpansion(event.sport_id)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div>
              <p className="text-left font-semibold">{event.sport_name}</p>
              <p className="text-left text-white/60 text-sm capitalize">
                {event.sport_type} • {event.gender_type} • {event.sport_day}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              hasRegistrations 
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/10 text-white/50'
            }`}>
              {event.registrationCount} checked in
            </span>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-white/60" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/60" />
            )}
          </div>
        </button>

        {isExpanded && hasRegistrations && (
          <div className="border-t border-white/10">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/70">#</TableHead>
                  <TableHead className="text-white/70">RMIS ID</TableHead>
                  <TableHead className="text-white/70">Name</TableHead>
                  <TableHead className="text-white/70">Club</TableHead>
                  <TableHead className="text-white/70">Type</TableHead>
                  <TableHead className="text-white/70">Checked In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {event.registrations.map((reg, index) => (
                  <TableRow key={reg.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-white/80">{index + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{reg.RMIS_ID}</TableCell>
                    <TableCell>{reg.name}</TableCell>
                    <TableCell className="text-white/80">{reg.club_name}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        reg.main_player 
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {reg.main_player ? 'Main' : 'Reserve'}
                      </span>
                    </TableCell>
                    <TableCell className="text-white/60 text-sm">
                      {formatDateTime(reg.checked_in_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {isExpanded && !hasRegistrations && (
          <div className="border-t border-white/10 py-6 text-center text-white/50">
            No check-ins for this event yet
          </div>
        )}
      </div>
    )
  }

  const renderEventSection = (title, events) => {
    if (events.length === 0) return null

    const totalRegistrations = events.reduce((sum, e) => sum + e.registrationCount, 0)

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-light text-white/60">{title}</h3>
            <div className="h-px flex-1 bg-gradient-to-r from-white/30 to-transparent w-20" />
          </div>
          <span className="text-sm text-white/50">
            {totalRegistrations} total check-ins
          </span>
        </div>
        <div className="space-y-3">
          {events.map(renderEventCard)}
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-wide">DAY REGISTRATIONS</h1>
          <p className="text-gray-400 text-sm mt-1">Event-wise check-in overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedDay} onValueChange={setSelectedDay}>
            <SelectTrigger className="w-40 bg-white/5 border-white/20">
              <SelectValue placeholder="Select Day" />
            </SelectTrigger>
            <SelectContent>
              {sportDayOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleRefresh}
            disabled={loading}
            variant="outline"
            size="icon"
            className="shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {data.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <CalendarCheck className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.totalRegistrations}</p>
                <p className="text-sm text-white/60">Total Check-ins</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Users className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.summary.uniquePlayers}</p>
                <p className="text-sm text-white/60">Unique Players</p>
              </div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.summary.byDay).map(([day, count]) => (
                <span
                  key={day}
                  className="px-3 py-1 bg-cranberry/20 border border-cranberry/30 rounded-full text-sm"
                >
                  {day}: {count}
                </span>
              ))}
              {Object.keys(data.summary.byDay).length === 0 && (
                <span className="text-white/50 text-sm">No registrations yet</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <img src="/load.svg" alt="Loading" className="w-16" />
        </div>
      ) : data.events.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400">No events found for the selected day.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {renderEventSection('Institute Based', instituteSports)}
          {renderEventSection('Community Based', communitySports)}
        </div>
      )}
    </div>
  )
}

export default DayRegistrationsPage
