'use client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input';
import React, { use, useState } from 'react'
import { Calendar1, ChevronDownIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { createEvent } from '@/services/sportServices';
import { toast } from 'sonner';

const page = () => {
    const[addEvent, setAddEvent] = useState(true);
    const [open, setOpen] = useState(false)

    const [eventName, setEventName] = useState('');
    const [eventDay, setEventDay] = useState('');
    const [eventType, setEventType] = useState('');
    const [gender, setGender] = useState('');
    const [minPlayerCount, setMinPlayerCount] = useState('');
    const [maxPlayerCount, setMaxPlayerCount] = useState('');
    const [reservePlayerCount, setReservePlayerCount] = useState('');
    const [regClose, setRegClose] = useState(undefined);
    const [eventCategory, setEventCategory] = useState('');

    // Validation logic
    const isFormValid = () => {
        // Check if all required fields are filled
        if (!eventName || !eventDay || !eventType || !gender || 
            !minPlayerCount || !maxPlayerCount || !reservePlayerCount || 
            !regClose || !eventCategory) {
            return false;
        }

        // Check if max player count is >= min player count
        const minCount = parseInt(minPlayerCount);
        const maxCount = parseInt(maxPlayerCount);
        if (maxCount < minCount) {
            return false;
        }

        // Check if registration close date is in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of today
        const selectedDate = new Date(regClose);
        selectedDate.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
            return false;
        }

        return true;
    };

    // Validation error messages
    const getValidationErrors = () => {
        const errors = [];
        
        if (!eventName || !eventDay || !eventType || !gender || 
            !minPlayerCount || !maxPlayerCount || !reservePlayerCount || 
            !regClose || !eventCategory) {
            errors.push('All fields are required');
        }

        const minCount = parseInt(minPlayerCount);
        const maxCount = parseInt(maxPlayerCount);
        if (minPlayerCount && maxPlayerCount && maxCount < minCount) {
            errors.push('Max player count must be equal or higher than min player count');
        }

        if (regClose) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDate = new Date(regClose);
            selectedDate.setHours(0, 0, 0, 0);
            if (selectedDate <= today) {
                errors.push('Registration close date must be in the future');
            }
        }

        return errors;
    };

  const handleEventRegister = async () => {
    // Validate form before submission
    const validationErrors = getValidationErrors();
    if (validationErrors.length > 0) {
        validationErrors.forEach(error => toast.error(error));
        return;
    }

    const eventData = {
      name: eventName,
      day: eventDay,
      type: eventType,
      gender: gender,
      minPlayers: parseInt(minPlayerCount),
      maxPlayers: parseInt(maxPlayerCount),
      reservePlayers: parseInt(reservePlayerCount),
      regClose: regClose,
      category: eventCategory,
    };
    
    console.log('Event data:', eventData);
    const result = await createEvent(eventData);
    console.log('Event created:', result);
    
    // Reset form after successful creation
    if (result?.success) {
        setEventName('');
        setEventDay('');
        setEventType('');
        setGender('');
        setMinPlayerCount('');
        setMaxPlayerCount('');
        setReservePlayerCount('');
        setRegClose(undefined);
        setEventCategory('');
    }
  }
    const result = await createEvent(eventData);
    console.log('Event created:', result);
  }

  return (
    <div>
      <div className="flex w-full justify-between items-center mb-8">
        <h1 className="text-3xl font-semibold tracking-wide">EVENTS</h1>
        {addEvent?
            <Button className="bg-red-500/20 border border-cursor hover:bg-red-500 cursor-pointer text-white" onClick={()=>setAddEvent(false)}>x</Button>
        :
            <Button className="bg-cranberry/20 border border-cursor hover:bg-cranberry cursor-pointer text-white" onClick={()=>setAddEvent(true)}>Add Event</Button>
        }

      </div>

      {/*🌟 Add event component */}
      {addEvent && (
        <div className="bg-white/5 rounded-lg p-8">
          <h2 className="text-xl font-medium uppercase">Add a new Event</h2>
          <div className="w-full grid grid-cols-2 gap-5 mt-5">
            <Input placeholder="Event Name" className="mr-4" onChange={(e) => setEventName(e.target.value)} />
            <div className="w-full">
                <Select onValueChange={(value) => setEventDay(value)}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Event Day" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="D-00">E-Sport</SelectItem>
                        <SelectItem value="D-01">Day 01</SelectItem>
                        <SelectItem value="D-02">Day 02</SelectItem>
                        <SelectItem value="D-03">Day 03</SelectItem>
                    </SelectContent>
                </Select>
            </div>
          </div>
          <div className="w-full grid grid-cols-2 gap-5 mt-5">
            <div className="w-full">
                <Select onValueChange={(value) => setEventType(value)}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Event Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="individual">individual</SelectItem>
                        <SelectItem value="team">team</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="w-full">
                <Select onValueChange={(value) => setGender(value)}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Gender" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="boys">Boys</SelectItem>
                        <SelectItem value="girls">Girls</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Input placeholder="Min Player Count" type="number"  className="mr-4" onChange={(e) => setMinPlayerCount(e.target.value)} />
            <Input placeholder="Max Player Count" type="number"  className="mr-4" onChange={(e) => setMaxPlayerCount(e.target.value)} />
            <Input placeholder="Reserve Player Count" type="number"  className="mr-4" onChange={(e) => setReservePlayerCount(e.target.value)} />

            <div className='w-full'>
                <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        id="regClose"
                        className="w-full justify-between font-normal"
                    >
                        {regClose ? regClose.toLocaleDateString() : "Registrations closes"}
                        <Calendar1
                        />
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={regClose}
                        captionLayout="dropdown"
                        onSelect={(regClose) => {
                        setRegClose(regClose)
                        setOpen(false)
                        }}
                    />
                    </PopoverContent>
                </Popover>
            </div>
              <div className="w-full">
                <Select onValueChange={(value) => setEventCategory(value)}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Event Category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="comBased">Community Based</SelectItem>
                        <SelectItem value="inBased">Institute Based</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                </Select>
              </div>
            </div>
          <Button 
            className={`mt-8 w-1/4 ${isFormValid() 
              ? 'bg-cranberry/80 hover:bg-cranberry border border-cranberry hover:shadow hover:shadow-cranberry text-white cursor-pointer' 
              : 'bg-gray-500/50 border border-gray-500 text-gray-300 cursor-not-allowed'}`}
            onClick={handleEventRegister}
            disabled={!isFormValid()}
          >
            Add Event
          </Button>
        </div>
      )}

      {/*🌟 Event list component */}
      {!addEvent && (
        <div>
          <h2>Event List</h2>
        </div>
      )}
    </div>
  )
}

export default page
