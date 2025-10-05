'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { createEvent, getAllEvents } from '@/services/sportServices';
import { toast } from 'sonner';
import { useAtom } from 'jotai';
import { sportsDataAtom, sportsLoadingAtom } from '@/app/state/store';
import { ArrowLeft } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const page = () => {

    const router = useRouter();
    const [sportsData, setSportsData] = useAtom(sportsDataAtom);
    const [sportsLoading, setSportsLoading] = useAtom(sportsLoadingAtom);
    const [searchTerm, setSearchTerm] = useState('');

    // Navigation function
    const navigateToMobileMatches = (eventId) => {
        router.push(`/admin/dashboard/bracket/mob/${eventId}`);
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
        <div className="min-h-screen p-4">
            <div className="flex w-full justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <Button
                        onClick={() => router.back()}
                        variant="outline"
                        size="icon"
                        className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-9 w-9"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <h1 className="text-2xl font-semibold tracking-wide">SELECT EVENT</h1>
                </div>
            </div>

            {/* Search Bar */}
            {!sportsLoading && sportsData.length > 0 && (
                <div className="mb-6">
                    <Input
                        type="text"
                        placeholder="Search events..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:border-cranberry focus:ring-cranberry"
                    />
                </div>
            )}

            <div>
                {sportsLoading ? (
                    <div className="flex justify-center items-center mt-20">
                        <img src="/load.svg" alt="" className="w-16" />
                    </div>
                ) : sportsData.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-400">No events found. Create your first event!</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Filter sports based on search term */}
                        {(() => {
                            const filteredSports = sportsData.filter(event =>
                                event.sport_name.toLowerCase().includes(searchTerm.toLowerCase())
                            );

                            return (
                                <>
                                    {/* Institute Based Events */}
                                    <div>
                                        <div className='flex items-center w-full mb-4'>
                                            <h3 className="text-lg font-light text-white/50 flex items-center">
                                                Institute Based Events
                                            </h3>
                                            <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10"></div>
                                        </div>
                                        {filteredSports.filter(event => event.category === 'institute').length === 0 ? (
                                            <div className="text-center py-6 bg-white/5 rounded-lg">
                                                <p className="text-gray-400">
                                                    {searchTerm ? 'No institute events match your search' : 'No institute based events yet'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {filteredSports
                                                    .filter(event => event.category === 'institute')
                                                    .map((event, index) => (
                                                        <div
                                                            key={event.id || index}
                                                            className="bg-cranberry/85 rounded-lg p-4 hover:bg-cranberry cursor-pointer transition-colors"
                                                            onClick={() => navigateToMobileMatches(event.sport_id)}
                                                        >
                                                            <div className='flex justify-between items-center'>
                                                                <div>
                                                                    <h1 className="text-lg font-medium">{event.sport_name}</h1>
                                                                    <p className="text-sm text-white/70 mt-1">Tap to view matches</p>
                                                                </div>
                                                                <p className="bg-white/10 border border-white/60 px-3 py-1 rounded-full text-sm text-white/80">
                                                                    {event.gender_type}
                                                                </p>
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
                                        {filteredSports.filter(event => event.category === 'community').length === 0 ? (
                                            <div className="text-center py-6 bg-white/5 rounded-lg">
                                                <p className="text-gray-400">
                                                    {searchTerm ? 'No community events match your search' : 'No community based events yet'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {filteredSports
                                                    .filter(event => event.category === 'community')
                                                    .map((event, index) => (
                                                        <div
                                                            key={event.id || index}
                                                            className="bg-cranberry/85 rounded-lg p-4 hover:bg-cranberry cursor-pointer transition-colors"
                                                            onClick={() => navigateToMobileMatches(event.sport_id)}
                                                        >
                                                            <div className='flex justify-between items-center'>
                                                                <div>
                                                                    <h1 className="text-lg font-medium">{event.sport_name}</h1>
                                                                    <p className="text-sm text-white/70 mt-1">Tap to view matches</p>
                                                                </div>
                                                                <p className="bg-white/10 border border-white/60 px-3 py-1 rounded-full text-sm text-white/80">
                                                                    {event.gender_type}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        )}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    )
}

export default page