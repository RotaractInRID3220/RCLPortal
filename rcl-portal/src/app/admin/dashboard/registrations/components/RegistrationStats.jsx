'use client'
import React from 'react'

const RegistrationStats = ({ registrations }) => {
  const totalRegistrations = registrations.length
  const mainPlayers = registrations.filter(reg => reg.main_player === true).length
  const reservePlayers = registrations.filter(reg => reg.main_player === false).length

  return (
    <div className="bg-white/5 border border-white/20 rounded-lg p-6 mb-6">
      <h3 className=" text-white font-light text-center uppercase tracking-wide mb-4">Registration Statistics</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center">
          <div className="text-7xl font-bold text-cranberry">{totalRegistrations}</div>
          <div className="text-sm text-white/70 mt-1">Total Registrations</div>
        </div>
        
        <div className="text-center">
          <div className="text-7xl font-bold text-green-400">{mainPlayers}</div>
          <div className="text-sm text-white/70 mt-1">Main Players</div>
        </div>
        
        <div className="text-center">
          <div className="text-7xl font-bold text-blue-400">{reservePlayers}</div>
          <div className="text-sm text-white/70 mt-1">Reserve Players</div>
        </div>
      </div>
    </div>
  )
}

export default RegistrationStats
