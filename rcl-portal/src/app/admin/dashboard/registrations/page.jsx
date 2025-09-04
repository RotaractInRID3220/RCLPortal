'use client'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import RegistrationFilters from './components/RegistrationFilters'
import EventSelector from './components/EventSelector'
import RegistrationsByClub from './components/RegistrationsByClub'

const page = () => {
  const [filterMode, setFilterMode] = useState('sport') // 'sport' or 'club'

  return (
    <div>
      <div className="flex w-full justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold tracking-wide">REGISTRATIONS</h1>
        <RegistrationFilters 
          filterMode={filterMode} 
          setFilterMode={setFilterMode} 
        />
      </div>
      
      <div>
        {filterMode === 'sport' ? (
          <EventSelector />
        ) : (
          <RegistrationsByClub />
        )}
      </div>
    </div>
  )
}

export default page
