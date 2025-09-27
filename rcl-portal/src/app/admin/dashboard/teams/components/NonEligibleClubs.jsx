'use client'
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, Users, Eye } from 'lucide-react'

const NonEligibleClubs = ({ sportId, sportName }) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [nonEligibleClubs, setNonEligibleClubs] = useState([])
  const [loading, setLoading] = useState(false)
  const [minCount, setMinCount] = useState(0)

  const fetchNonEligibleClubs = async () => {
    if (!sportId) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/teams/non-eligible?sport_id=${sportId}`)
      const result = await response.json()
      
      if (result.success) {
        setNonEligibleClubs(result.non_eligible_clubs || [])
        setMinCount(result.min_count || 0)
      }
    } catch (error) {
      console.error('Error fetching non-eligible clubs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isDialogOpen && sportId) {
      fetchNonEligibleClubs()
    }
  }, [isDialogOpen, sportId])

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm"
          className="bg-orange-600/5 border border-orange-600/10 text-orange-400 hover:bg-orange-600/20 cursor-pointer"
        >
          <Eye className="w-4 h-4" />
          View Non-Eligible Clubs
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-black/70 backdrop-blur-sm border-cranberry/40 p-8">        
      <DialogHeader>
          <DialogTitle className="text-white flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-orange-400" />
            Non-Eligible Clubs for {sportName}
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Clubs with registrations but not enough players to meet the minimum requirement ({minCount} players).
          </DialogDescription>
        </DialogHeader>
        
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <img src="/load.svg" alt="Loading" className="w-12" />
            </div>
          ) : nonEligibleClubs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-white/70 mb-2">No non-eligible clubs found</div>
              <div className="text-white/50 text-sm">
                All clubs with registrations meet the minimum requirements.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {nonEligibleClubs.map((club) => (
                <Card key={club.club_id} className="bg-slate-900/50 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Users className="w-4 h-4 text-orange-400" />
                        <div>
                          <h4 className="text-white font-medium">{club.club_name}</h4>
                          <p className="text-slate-400 text-sm">Category: {club.category}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge 
                          variant="secondary" 
                          className="bg-orange-500/20 text-orange-300"
                        >
                          {club.registration_count} / {minCount} players
                        </Badge>
                        <div className="text-xs text-slate-500">
                          Need {minCount - club.registration_count} more
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-700">
          {/* <Button 
            variant="outline" 
            onClick={() => setIsDialogOpen(false)}
            className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600"
          >
            Close
          </Button> */}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default NonEligibleClubs