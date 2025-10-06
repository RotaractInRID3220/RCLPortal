'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { createEvent, getAllEvents } from '@/services/sportServices';
import { toast } from 'sonner';
import { useAtom } from 'jotai';
import { sportsDataAtom, sportsLoadingAtom } from '@/app/state/store';

const page = () => {

    const router = useRouter();
    const [sportsData, setSportsData] = useAtom(sportsDataAtom);
    const [sportsLoading, setSportsLoading] = useAtom(sportsLoadingAtom);

    // Navigation function
    const navigateToBracket = (eventId) => {
        router.push(`/portal/dashboard/bracket/${eventId}`);
    };


    // Fetch all sports data when component mounts
    const fetchAllSports = async () => {
        try {
            setSportsLoading(true);
            const result = await getAllEvents({type: ["team", "individual"]});
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


    return (
        <div>
            <div className="flex w-full justify-between items-center mb-8">
                <h1 className="text-3xl font-semibold tracking-wide">SELECT EVENT</h1>
            </div>



                <div>
                    {sportsLoading ? (
                      <div className="flex justify-center items-center mt-40">
                          <img src="/load.svg" alt="" className="w-20" />
                      </div>
                    ) : sportsData.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-gray-400">No events found. Create your first event!</p>
                        </div>
                    ) : (
                        <div className="space-y-16">
                            {/* Institute Based Events */}
                            <div>
                                <div className='flex items-center w-full mb-4'>
                                    <h3 className="text-lg font-light text-white/50 flex items-center">
                                        Institute Based Events
                                    </h3>
                                    <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10"></div>
                                </div>
                                {sportsData.filter(event => event.category === 'institute').length === 0 ? (
                                    <div className="text-center py-6 bg-white/5 rounded-lg">
                                        <p className="text-gray-400">No institute based events yet</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-4">
                                        {sportsData
                                            .filter(event => event.category === 'institute')
                                            .map((event, index) => (
                                                <div
                                                    key={event.id || index}
                                                    className="bg-cranberry/85 rounded-lg py-3 px-5 hover:bg-cranberry cursor-pointer"
                                                    onClick={() => navigateToBracket(event.sport_id)}
                                                >
                                                    <div className='justify-between flex'>
                                                        <h1 className="text-lg">{event.sport_name}</h1>
                                                        <p className="bg-white/5 border border-white/80 px-4 py-1 rounded-full text-sm text-white/80">{event.gender_type}</p>
                                                    </div>
                                                </div>
                                            ))
                                        }
                                    </div>
                                )}
                            </div>

                            {/* Community Based Events */}
                            <div>
                                <div className='flex items-center w-full mb-4'>
                                    <h3 className="text-lg font-light text-white/50 flex items-center">
                                        Community Based Events
                                    </h3>
                                    <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10"></div>
                                </div>
                                {sportsData.filter(event => event.category === 'community').length === 0 ? (
                                    <div className="text-center py-6 bg-white/5 rounded-lg">
                                        <p className="text-gray-400">No community based events yet</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-4 gap-4">
                                        {sportsData
                                            .filter(event => event.category === 'community')
                                            .map((event, index) => (
                                                <div
                                                    key={event.id || index}
                                                    className="bg-cranberry/85 rounded-lg py-3 px-5 hover:bg-cranberry cursor-pointer"
                                                    onClick={() => navigateToBracket(event.sport_id)}
                                                >
                                                    <div className='justify-between flex'>
                                                        <h1 className="text-lg">{event.sport_name}</h1>
                                                        <p className="bg-white/5 border border-white/80 px-4 py-1 rounded-full text-sm text-white/80">{event.gender_type}</p>
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
        </div>
    )
}

export default page