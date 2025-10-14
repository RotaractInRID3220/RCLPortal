'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createEvent, getAllEvents } from '@/services/sportServices';
import { toast } from 'sonner';
import { useAtom } from 'jotai';
import { sportsDataAtom, sportsLoadingAtom, lastFetchTimestampAtom, isCacheValid, userDeetsAtom } from '@/app/state/store';
import { getClubByClubId } from '@/services/clubServices';

// Memoized Event Card component
const EventCard = React.memo(({ event, onClick }) => {
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

    // Memoized filtered sports data
    const filteredSportsData = useMemo(() => {
        if (!clubData) return [];
        const filtered = sportsData.filter(event => event.category === clubData.category);
        console.log('Filtering sports data:', {
            clubData,
            sportsData: sportsData.map(s => ({ name: s.sport_name, category: s.category })),
            filteredCount: filtered.length,
            totalCount: sportsData.length
        });
        return filtered;
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
                ) : sportsData.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-400">No events found. Create your first event!</p>
                    </div>
                ) : (
                    <div className="space-y-16">
                        {/* Filtered Events */}
                        <div>
                            {filteredSportsData.length === 0 ? (
                                <div className="text-center py-6 bg-white/5 rounded-lg">
                                    <p className="text-gray-400">No events available for your club category yet</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-4 gap-4">
                                    {filteredSportsData.map((event, index) => (
                                        <EventCard
                                            key={event.sport_id || index}
                                            event={event}
                                            onClick={navigateToBracket}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

PortalRegistrationPage.displayName = 'PortalRegistrationPage';

export default PortalRegistrationPage
