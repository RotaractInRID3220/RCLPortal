'use client'
import React from 'react'
import TeamSelector from './components/TeamSelector'
import AddTeamsButton from './components/AddTeamsButton'

const TeamsPage = () => {
  return (
    <div>
      <div className="flex w-full justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold tracking-wide">TEAMS</h1>
        <AddTeamsButton />
      </div>
      
      <div>
        <TeamSelector />
      </div>
    </div>
  )
}

export default TeamsPage