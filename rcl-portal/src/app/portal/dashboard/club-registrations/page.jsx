'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getAllEvents } from '@/services/sportServices';
import { useAtom } from 'jotai';
import { sportsDataAtom, sportsLoadingAtom, lastFetchTimestampAtom, isCacheValid, userDeetsAtom } from '@/app/state/store';
import { getClubByClubId } from '@/services/clubServices';
import { Users, Calendar } from "lucide-react";

// Memoized Event Card component
const EventCard = React.memo(({ event, onClick, registrationCount }) => {
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
            <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1 text-xs text-white/60">
                    <Users className="w-3 h-3" />
                    <span>{registrationCount !== undefined ? `${registrationCount} registered` : 'View registrations'}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-white/60">
                    <Calendar className="w-3 h-3" />
                    <span>{event.sport_day || 'TBD'}</span>
                </div>
            </div>
        </div>
    );
});
EventCard.displayName = 'EventCard';

const ClubRegistrationsPage = React.memo(() => {
    const router = useRouter();
    const [sportsData, setSportsData] = useAtom(sportsDataAtom);
    const [sportsLoading, setSportsLoading] = useAtom(sportsLoadingAtom);
    const [lastFetchTimestamp, setLastFetchTimestamp] = useAtom(lastFetchTimestampAtom);
    const [userDeets] = useAtom(userDeetsAtom);
    const [clubData, setClubData] = useState(null);
    const [clubLoading, setClubLoading] = useState(true);
    const [registrationCounts, setRegistrationCounts] = useState({});

    // Memoized navigation function
    const navigateToSportRegistrations = useCallback((sportId) => {
        router.push(`/portal/dashboard/club-registrations/${sportId}`);
    }, [router]);

    // Memoized filtered sports data - filter by club category
    const filteredSportsData = useMemo(() => {
        if (!clubData) return [];
        
        // Filter by club category
        const categoryFiltered = sportsData.filter(event => event.category === clubData.category);
        
        console.log('Filtering sports data:', {
            clubData,
            sportsData: sportsData.map(s => ({ name: s.sport_name, category: s.category })),
            categoryFilteredCount: categoryFiltered.length,
            totalCount: sportsData.length
        });
        
        return categoryFiltered;
    }, [sportsData, clubData]);

    // Group sports by category
    const { instituteEvents, communityEvents } = useMemo(() => {
        const institute = filteredSportsData.filter(event => event.category === 'institute');
        const community = filteredSportsData.filter(event => event.category === 'community');
        return { instituteEvents: institute, communityEvents: community };
    }, [filteredSportsData]);

    // Optimized fetch function with caching
    const fetchAllSports = useCallback(async () => {
        // Check cache validity first
        if (isCacheValid(lastFetchTimestamp.sports, 'sports')) {
            console.log('Using cached sports data for club registrations');
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
            setClubData(club);
        } catch (error) {
            console.error('Failed to fetch club data:', error);
        } finally {
            setClubLoading(false);
        }
    }, [userDeets?.club_id]);

    // Fetch registration counts for all sports
    const fetchRegistrationCounts = useCallback(async () => {
        if (!userDeets?.club_id || filteredSportsData.length === 0) return;

        try {
            const response = await fetch(`/api/registrations?filter=${JSON.stringify({ club_id: userDeets.club_id })}`);
            const data = await response.json();
            
            if (data.success && data.data) {
                // Group registrations by sport_id
                const counts = {};
                data.data.forEach(reg => {
                    counts[reg.sport_id] = (counts[reg.sport_id] || 0) + 1;
                });
                setRegistrationCounts(counts);
            }
        } catch (error) {
            console.error('Failed to fetch registration counts:', error);
        }
    }, [userDeets?.club_id, filteredSportsData.length]);

    // Effect to fetch club data when userDeets changes
    useEffect(() => {
        console.log('useEffect triggered with userDeets:', userDeets);
        if (userDeets?.club_id) {
            fetchClubData();
        }
    }, [userDeets?.club_id, fetchClubData]);

    // Effect to fetch sports data
    useEffect(() => {
        fetchAllSports();
    }, [fetchAllSports]);

    // Effect to fetch registration counts when sports data is available
    useEffect(() => {
        if (filteredSportsData.length > 0 && userDeets?.club_id) {
            fetchRegistrationCounts();
        }
    }, [filteredSportsData.length, userDeets?.club_id, fetchRegistrationCounts]);

    const isLoading = sportsLoading || clubLoading;

    return (
        <div className="py-0 lg:py-0 pb-10">
            <div className="flex w-full justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-semibold tracking-wide">CLUB REGISTRATIONS</h1>
                    <p className="text-white/60 text-sm mt-1">
                        View all players registered from your club for each sport
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center mt-40">
                    <img src="/load.svg" alt="" className="w-20" />
                </div>
            ) : !clubData ? (
                <div className="text-center py-8">
                    <p className="text-gray-400">Unable to load club data. Please try again later.</p>
                </div>
            ) : filteredSportsData.length === 0 ? (
                <div className="text-center py-8">
                    <p className="text-gray-400">No events found for your club category.</p>
                </div>
            ) : (
                <div className="space-y-12">
                    {/* Show events based on club category */}
                    {clubData.category === 'institute' && instituteEvents.length > 0 && (
                        <div>
                            {/* <div className='flex items-center w-full mb-4'>
                                <h3 className="text-lg font-light text-white/50 flex items-center">
                                    Institute Based Events
                                </h3>
                                <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10"></div>
                            </div> */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {instituteEvents.map((event, index) => (
                                    <EventCard
                                        key={event.sport_id || index}
                                        event={event}
                                        onClick={navigateToSportRegistrations}
                                        registrationCount={registrationCounts[event.sport_id]}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {clubData.category === 'community' && communityEvents.length > 0 && (
                        <div>
                            {/* <div className='flex items-center w-full mb-4'>
                                <h3 className="text-lg font-light text-white/50 flex items-center">
                                    Community Based Events
                                </h3>
                                <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10"></div>
                            </div> */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {communityEvents.map((event, index) => (
                                    <EventCard
                                        key={event.sport_id || index}
                                        event={event}
                                        onClick={navigateToSportRegistrations}
                                        registrationCount={registrationCounts[event.sport_id]}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

ClubRegistrationsPage.displayName = 'ClubRegistrationsPage';

export default ClubRegistrationsPage;
