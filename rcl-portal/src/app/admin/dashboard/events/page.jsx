'use client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input';
import React, { useState, useEffect } from 'react'
import { Calendar1 } from "lucide-react"
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
import { createEvent, getAllEvents } from '@/services/sportServices';
import { toast } from 'sonner';
import { useAtom } from 'jotai';
import { sportsDataAtom, sportsLoadingAtom } from '@/app/state/store';
import PrivateRoute from '@/lib/PrivateRoute';

const page = () => {
    const[addEvent, setAddEvent] = useState(false);
    const [open, setOpen] = useState(false)

    // Sports data from global state
    const [sportsData, setSportsData] = useAtom(sportsDataAtom);
    const [sportsLoading, setSportsLoading] = useAtom(sportsLoadingAtom);

    const [eventName, setEventName] = useState('');
    const [eventDay, setEventDay] = useState('');
    const [eventType, setEventType] = useState('');
    const [gender, setGender] = useState('');
    const [minPlayerCount, setMinPlayerCount] = useState('');
    const [maxPlayerCount, setMaxPlayerCount] = useState('');
    const [reservePlayerCount, setReservePlayerCount] = useState('');
    const [regClose, setRegClose] = useState(undefined);
    const [eventCategory, setEventCategory] = useState('');

    // Fetch all sports data when component mounts
    const fetchAllSports = async () => {
        try {
            setSportsLoading(true);
            const result = await getAllEvents();
            if (result.success) {
                setSportsData(result.data);
                console.log('Sports data loaded:', result.data);
            }
        } catch (error) {
            console.error('Failed to fetch sports:', error);
            // Error toast already handled by getAllEvents service
        } finally {
            setSportsLoading(false);
        }
    };

    // Load sports data when component mounts
    useEffect(() => {
        fetchAllSports();
    }, []);

    // Validation logic
    const isFormValid = () => {
        // Check if max player count is >= min player count
        const minCount = parseInt(minPlayerCount);
        const maxCount = parseInt(maxPlayerCount);
        if (maxCount < minCount) {
            toast.error('Max player count must be equal or higher than min player count');
            return false;
        }

        // Check if registration close date is in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of today
        const selectedDate = new Date(regClose);
        selectedDate.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
            toast.error('Registration close date must be in the future');
            return false;
        }

                // Check if all required fields are filled
        if (!eventName || !eventDay || !eventType || !gender || 
            !minPlayerCount || !maxPlayerCount || !reservePlayerCount || 
            !regClose || !eventCategory) {
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
        
        // Reset form and refresh sports data after successful creation
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
            
            // Refresh sports data to show the new event
            await fetchAllSports();
        }
    };

    return (
        <PrivateRoute requiredPermission="admin"  accessType="admin">
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
                        <Input 
                            placeholder="Event Name" 
                            className="mr-4" 
                            value={eventName}
                            onChange={(e) => setEventName(e.target.value)} 
                        />
                        <div className="w-full">
                            <Select onValueChange={(value) => setEventDay(value)} value={eventDay}>
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
                            <Select onValueChange={(value) => setEventType(value)} value={eventType}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Event Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="individual">Individual</SelectItem>
                                    <SelectItem value="team">Team</SelectItem>
                                    <SelectItem value="trackIndividual">Track Individual</SelectItem>
                                    <SelectItem value="trackTeam">Track Team</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="w-full">
                            <Select onValueChange={(value) => setGender(value)} value={gender}>
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

                        <Input 
                            placeholder="Min Player Count" 
                            type="number" 
                            className="mr-4" 
                            value={minPlayerCount}
                            onChange={(e) => setMinPlayerCount(e.target.value)} 
                        />
                        <Input 
                            placeholder="Max Player Count" 
                            type="number" 
                            className="mr-4" 
                            value={maxPlayerCount}
                            onChange={(e) => setMaxPlayerCount(e.target.value)} 
                        />
                        <Input 
                            placeholder="Reserve Player Count" 
                            type="number" 
                            className="mr-4" 
                            value={reservePlayerCount}
                            onChange={(e) => setReservePlayerCount(e.target.value)} 
                        />

                        <div className='w-full'>
                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        id="regClose"
                                        className="w-full justify-between font-normal"
                                    >
                                        {regClose ? regClose.toLocaleDateString() : "Registrations closes"}
                                        <Calendar1 />
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
                            <Select onValueChange={(value) => setEventCategory(value)} value={eventCategory}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Event Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="community">Community Based</SelectItem>
                                    <SelectItem value="institute">Institute Based</SelectItem>
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
                    {sportsLoading ? (
                        <div className="text-center py-8">
                            <p className="text-gray-400">Loading events...</p>
                        </div>
                    ) : sportsData.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-400">No events found. Create your first event!</p>
                        </div>
                    ) : (
                        <div className="space-y-10">
                            {/* Institute Based Events */}
                            <div>
                                <h3 className="text-xl font-medium text-blue-400 mb-4 flex items-center">
                                    Institute Based Events
                                </h3>
                                {sportsData.filter(event => event.category === 'institute').length === 0 ? (
                                    <div className="text-center py-6 bg-white/5 rounded-lg">
                                        <p className="text-gray-400">No institute based events yet</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-4">
                                        {sportsData
                                            .filter(event => event.category === 'institute')
                                            .map((event, index) => (
                                                <div key={event.id || index} className="bg-white/5 rounded-lg py-5 px-5 hover:bg-white/10 cursor-pointer border-l-3 border-blue-500">
                                                    <div className='justify-between flex'>
                                                        <h1 className="text-xl">{event.sport_name}</h1>
                                                        <p className="bg-cranberry/10 border border-cranberry px-4 py-1 rounded-full text-sm text-cranberry">{event.sport_day}</p>
                                                    </div>
                                                    <hr className="my-4"/>
                                                    <div className="flex justify-between text-gray-400">
                                                        <p>Type : {event.sport_type}</p>
                                                        <p>Gender : {event.gender_type}</p>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>

                            {/* Community Based Events */}
                            <div>
                                <h3 className="text-xl font-medium text-green-400 mb-4 flex items-center">
                                    Community Based Events
                                </h3>
                                {sportsData.filter(event => event.category === 'community').length === 0 ? (
                                    <div className="text-center py-6 bg-white/5 rounded-lg">
                                        <p className="text-gray-400">No community based events yet</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-3 gap-4">
                                        {sportsData
                                            .filter(event => event.category === 'community')
                                            .map((event, index) => (
                                                <div key={event.id || index} className="bg-white/5 rounded-lg py-5 px-5 hover:bg-white/10 cursor-pointer border-l-3 border-green-500">
                                                    <div className='justify-between flex'>
                                                        <h1 className="text-xl">{event.sport_name}</h1>
                                                        <p className="bg-cranberry/10 border border-cranberry px-4 py-1 rounded-full text-sm text-cranberry">{event.sport_day}</p>
                                                    </div>
                                                    <hr className="my-4"/>
                                                    <div className="flex justify-between text-gray-400">
                                                        <p>Type : {event.sport_type}</p>
                                                        <p>Gender : {event.gender_type}</p>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
        </PrivateRoute>
    )
}

export default page
