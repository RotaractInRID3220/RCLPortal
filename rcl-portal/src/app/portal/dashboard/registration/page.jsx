'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createEvent, getAllEvents } from '@/services/sportServices';
import { toast } from 'sonner';
import { useAtom } from 'jotai';
import { sportsDataAtom, sportsLoadingAtom, lastFetchTimestampAtom, isCacheValid, userDeetsAtom } from '@/app/state/store';
import { getClubByClubId } from '@/services/clubServices';
import { APP_CONFIG } from '@/config/app.config';
import { Clock, Lock, Calendar } from "lucide-react";

// Memoized Event Card component
const EventCard = React.memo(({ event, onClick }) => {
    // Calculate days remaining until this sport's registration closes
    const daysRemaining = useMemo(() => {
        if (!event.registration_close) return null;
        const now = new Date();
        const closeDate = new Date(event.registration_close);
        const diffTime = closeDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }, [event.registration_close]);

    return (
        <div 
            className="bg-cranberry/85 rounded-lg py-3 px-5 hover:bg-cranberry cursor-pointer transition-colors duration-200"
            onClick={() => onClick(event.sport_id)}
        >
            <div className='justify-between flex'>
                <h1 className="text-lg">{event.sport_name}</h1>
                <p className="bg-white/5 border border-white/80 px-4 py-1 rounded-full text-sm text-white/80">
                    {event.gender_type}
                </p>
            </div>
            {daysRemaining !== null && (
                <p className="text-xs text-white/60 mt-2">
                    {daysRemaining > 0 
                        ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left to register`
                        : 'Closes today'
                    }
                </p>
            )}
        </div>
    );
});
EventCard.displayName = 'EventCard';

const PortalRegistrationPage = React.memo(() => {
    const router = useRouter();
    const [sportsData, setSportsData] = useAtom(sportsDataAtom);
    const [sportsLoading, setSportsLoading] = useAtom(sportsLoadingAtom);
    const [lastFetchTimestamp, setLastFetchTimestamp] = useAtom(lastFetchTimestampAtom);
    const [userDeets] = useAtom(userDeetsAtom);
    const [clubData, setClubData] = useState(null);
    const [clubLoading, setClubLoading] = useState(true);

    // Memoized navigation function
    const navigateToBracket = useCallback((eventId) => {
        router.push(`/portal/dashboard/registration/${eventId}`);
    }, [router]);

    // Check if registrations have opened (common opening date from config)
    const registrationOpeningDate = useMemo(() => {
        return new Date(APP_CONFIG.REGISTRATION_OPENING_DATE);
    }, []);

    const isRegistrationOpen = useMemo(() => {
        const currentDate = new Date();
        return currentDate >= registrationOpeningDate;
    }, [registrationOpeningDate]);

    // Calculate days until opening
    const daysUntilOpening = useMemo(() => {
        if (isRegistrationOpen) return 0;
        const currentDate = new Date();
        const diffTime = registrationOpeningDate - currentDate;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }, [isRegistrationOpen, registrationOpeningDate]);

    // Memoized filtered sports data - filter by club category AND registration still open
    const filteredSportsData = useMemo(() => {
        if (!clubData) return [];
        const currentDate = new Date();
        
        // First filter by club category
        const categoryFiltered = sportsData.filter(event => event.category === clubData.category);
        
        // Then filter to only show sports where registration is still open (registration_close is in the future)
        const openSports = categoryFiltered.filter(event => {
            if (!event.registration_close) return true; // If no close date, assume open
            const closeDate = new Date(event.registration_close);
            return closeDate > currentDate;
        });
        
        console.log('Filtering sports data:', {
            clubData,
            sportsData: sportsData.map(s => ({ name: s.sport_name, category: s.category, registration_close: s.registration_close })),
            categoryFilteredCount: categoryFiltered.length,
            openSportsCount: openSports.length,
            totalCount: sportsData.length
        });
        
        return openSports;
    }, [sportsData, clubData]);

    // Optimized fetch function with caching
    const fetchAllSports = useCallback(async () => {
        // Check cache validity first
        if (isCacheValid(lastFetchTimestamp.sports, 'sports')) {
            console.log('Using cached sports data for portal registration');
            return;
        }

        try {
            setSportsLoading(true);
            const result = await getAllEvents();
            if (result.success) {
                setSportsData(result.data);
                setLastFetchTimestamp(prev => ({ ...prev, sports: Date.now() }));
                console.log('Sports data loaded and cached:', result.data);
            } else {
                // If API fails, set empty data and cache to prevent infinite retries
                setSportsData([]);
                setLastFetchTimestamp(prev => ({ ...prev, sports: Date.now() }));
            }
        } catch (error) {
            console.error('Failed to fetch sports:', error);
            // Set empty data and cache on error to prevent infinite loop
            setSportsData([]);
            setLastFetchTimestamp(prev => ({ ...prev, sports: Date.now() }));
        } finally {
            setSportsLoading(false);
        }
    }, [setSportsData, setSportsLoading, setLastFetchTimestamp, lastFetchTimestamp.sports]);

    // Fetch club data
    const fetchClubData = useCallback(async () => {
        console.log('fetchClubData called with userDeets:', userDeets);
        if (!userDeets?.club_id) {
            console.log('No club_id in userDeets, setting clubLoading to false');
            setClubLoading(false);
            return;
        }

        try {
            setClubLoading(true);
            console.log('Fetching club data for club_id:', userDeets.club_id);
            const club = await getClubByClubId(userDeets.club_id);
            console.log('Club data fetched:', club);
            if (club) {
                setClubData(club);
            } else {
                // Default to community if club not found
                console.log('Club not found, defaulting to community');
                setClubData({ category: 'community' });
            }
        } catch (error) {
            console.error('Failed to fetch club data:', error);
            // Default to community on error
            setClubData({ category: 'community' });
        } finally {
            setClubLoading(false);
        }
    }, [userDeets?.club_id]);

    // Load club data when userDeets changes
    useEffect(() => {
        fetchClubData();
    }, [fetchClubData]);

    // Load sports data when component mounts
    useEffect(() => {
        fetchAllSports();
    }, [fetchAllSports]);

    return (
        <div>
            <div className="flex w-full justify-between items-center mb-8">
                <h1 className="text-2xl font-semibold tracking-wide">SELECT AN EVENT</h1>
            </div>

            <div>
                {sportsLoading || clubLoading ? (
                    <div className="flex justify-center items-center mt-40">
                        <img src="/load.svg" alt="" className="w-20" />
                    </div>
                ) : !isRegistrationOpen ? (
                    // Registrations haven't opened yet (based on common opening date)
                    <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16"></div>
                        <div className="relative z-10">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-blue-500/20 rounded-full">
                                    <Clock className="w-6 h-6 text-blue-400" />
                                </div>
                                <h1 className="text-xl font-semibold text-white">Registrations Not Yet Open</h1>
                            </div>
                            <p className="text-white/70 mb-4">
                                Player registrations will open on <span className="font-semibold text-blue-300">
                                    {registrationOpeningDate.toLocaleDateString('en-US', { 
                                        weekday: 'long', 
                                        year: 'numeric', 
                                        month: 'long', 
                                        day: 'numeric' 
                                    })}
                                </span>
                            </p>
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                <div className="flex items-center space-x-2">
                                    <Calendar className="w-4 h-4 text-blue-400" />
                                    <span className="text-sm text-blue-300">
                                        {daysUntilOpening} day{daysUntilOpening !== 1 ? 's' : ''} remaining until registrations open
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : sportsData.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-400">No events found. Create your first event!</p>
                    </div>
                ) : filteredSportsData.length === 0 ? (
                    // All sports for this category have closed registration
                    <div className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-lg p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full -mr-16 -mt-16"></div>
                        <div className="relative z-10">
                            <div className="flex items-center space-x-3 mb-4">
                                <div className="p-2 bg-red-500/20 rounded-full">
                                    <Lock className="w-6 h-6 text-red-400" />
                                </div>
                                <h1 className="text-xl font-semibold text-white">All Registrations Closed</h1>
                            </div>
                            <p className="text-white/70 mb-4">
                                The registration period for all events in your category has ended. No further registrations can be made.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-16">
                        {/* Filtered Events - only open sports */}
                        <div>
                            <div className="grid grid-cols-4 gap-4">
                                {filteredSportsData.map((event, index) => (
                                    <EventCard
                                        key={event.sport_id || index}
                                        event={event}
                                        onClick={navigateToBracket}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

PortalRegistrationPage.displayName = 'PortalRegistrationPage';

export default PortalRegistrationPage
