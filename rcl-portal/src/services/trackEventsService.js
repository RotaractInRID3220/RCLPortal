import { toast } from 'sonner'

// Fetch track-type sports (trackIndividual + trackTeam)
export const fetchTrackSports = async () => {
  try {
    const response = await fetch('/api/events?type=trackIndividual,trackTeam')
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch track events')
    }
    return result.data
  } catch (error) {
    console.error('Error fetching track sports:', error)
    toast.error('Failed to load track events')
    throw error
  }
}

// Syncs track events participants for all or a specific sport
export const syncTrackEvents = async (sportId = null) => {
  try {
    const response = await fetch('/api/track-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sport_id: sportId }),
    })
    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to sync track events')
    }
    return result
  } catch (error) {
    console.error('Error syncing track events:', error)
    toast.error('Sync failed')
    throw error
  }
}

// Fetches track event entries for a sport
export const getTrackEntries = async (sportId) => {
  if (!sportId) throw new Error('sportId is required')
  try {
    const response = await fetch(`/api/track-events?sport_id=${sportId}`)
    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to fetch track entries')
    }
    return result.data
  } catch (error) {
    console.error('Error fetching track entries:', error)
    toast.error('Failed to load entries')
    throw error
  }
}

// Updates score/place for a track event entry
export const updateTrackEntry = async ({ id, score, place }) => {
  try {
    const response = await fetch('/api/track-events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, score, place }),
    })
    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to update entry')
    }
    return result.data
  } catch (error) {
    console.error('Error updating track entry:', error)
    toast.error('Failed to update entry')
    throw error
  }
}

// Awards points to clubs for a track sport
export const awardTrackPoints = async (sportId) => {
  try {
    const response = await fetch('/api/track-events/award', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sport_id: sportId }),
    })
    const result = await response.json()
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to award points')
    }
    return result
  } catch (error) {
    console.error('Error awarding track points:', error)
    toast.error('Failed to award points')
    throw error
  }
}
