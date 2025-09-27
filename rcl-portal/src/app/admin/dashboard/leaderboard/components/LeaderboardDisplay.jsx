'use client'
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

const LeaderboardDisplay = ({ sport, refreshKey, onPointDeleted }) => {
  const [clubPoints, setClubPoints] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchClubPoints = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/club-points?sport_id=${sport.sport_id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch club points')
      }

      const result = await response.json()
      
      if (result.success) {
        setClubPoints(result.data || [])
      }
    } catch (error) {
      console.error('Error fetching club points:', error)
      toast.error('Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sport) {
      fetchClubPoints()
    }
  }, [sport, refreshKey])

  const handleDelete = async () => {
    if (!deleteId) return

    try {
      setDeleting(true)
      
      const response = await fetch(`/api/club-points?point_id=${deleteId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete entry')
      }

      const result = await response.json()
      
      if (result.success) {
        toast.success('Entry deleted successfully!')
        
        // Refresh the data
        fetchClubPoints()
        
        // Notify parent component
        if (onPointDeleted) {
          onPointDeleted()
        }
      }
    } catch (error) {
      console.error('Error deleting entry:', error)
      toast.error(error.message || 'Failed to delete entry')
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white/5 rounded-lg p-6">
        <h3 className="text-xl font-medium mb-4">Leaderboard</h3>
        <div className="flex justify-center py-8">
          <img src="/load.svg" alt="" className="w-8" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white/5 rounded-lg p-6">
        <h3 className="text-xl font-medium mb-4">Leaderboard</h3>
        
        {clubPoints.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400">No points entries yet for this sport.</p>
            <p className="text-gray-500 text-sm mt-2">Add some points above to see the leaderboard.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="grid grid-cols-4 gap-4 py-3 px-4 bg-white/10 rounded-lg font-medium">
              <div>Club Name</div>
              <div className="text-center">Place</div>
              <div className="text-center">Points</div>
              <div className="text-center">Actions</div>
            </div>
            
            {/* Entries */}
            {clubPoints.map((entry, index) => (
              <div 
                key={entry.point_id} 
                className="grid grid-cols-4 gap-4 py-3 px-4 bg-white/5 rounded-lg hover:bg-white/8 transition-colors"
              >
                <div className="font-medium">
                  {entry.clubs?.club_name || 'Unknown Club'}
                </div>
                <div className="text-center">
                  {entry.place}
                </div>
                <div className="text-center font-semibold text-green-400">
                  {entry.points}
                </div>
                <div className="text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(entry.point_id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {/* Total Count */}
            <div className="pt-4 border-t border-white/20">
              <p className="text-sm text-gray-400 text-center">
                Total entries: {clubPoints.length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Points Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this points entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <div className="flex items-center">
                  <img src="/load.svg" alt="" className="w-4 mr-2" />
                  Deleting...
                </div>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default LeaderboardDisplay