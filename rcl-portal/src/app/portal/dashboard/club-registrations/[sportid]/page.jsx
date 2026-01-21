'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAtom } from 'jotai'
import { sportsDataAtom, userDeetsAtom, clubMembersAtom, lastFetchTimestampAtom, isCacheValid } from '@/app/state/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Search, Users, Download, RefreshCw } from 'lucide-react'
import { getRegistrations } from '@/services/registrationService'
import { getAllEvents } from '@/services/sportServices'
import { toast } from 'sonner'
import { useDebounce } from '@/hooks/useDebounce'
import * as XLSX from 'xlsx'

// Memoized Player Card component
const PlayerCard = React.memo(({ registration, clubMembers }) => {
    const memberInfo = Array.isArray(clubMembers) ? 
        clubMembers.find(member => member.membership_id === registration.RMIS_ID) : null;
    
    const playerName = memberInfo?.card_name || registration.RMIS_ID;
    const isMain = registration.main_player;
    const memberStatus = memberInfo?.status;
    
    return (
        <div 
            className={`flex justify-between items-center p-4 rounded-lg ${isMain ? 'bg-cranberry/20 border border-cranberry/30' : 'bg-white/5 border border-white/10'}`}
        >
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <p className="font-medium text-white">{playerName}</p>
                    <Badge variant="outline" className={`text-xs ${isMain ? 'bg-cranberry/40 border-cranberry/60' : 'bg-white/10 border-white/20'}`}>
                        {isMain ? 'Main' : 'Reserve'}
                    </Badge>
                </div>
                <p className="text-xs text-white/50">{registration.RMIS_ID}</p>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs bg-white/5 border-white/20">
                    {memberStatus === 1 ? 'General' : memberStatus === 5 ? 'Prospective' : 'Unknown'}
                </Badge>
                {memberInfo?.gender && (
                    <Badge variant="outline" className="text-xs bg-white/5 border-white/20">
                        {memberInfo.gender === 'M' ? 'Male' : 'Female'}
                    </Badge>
                )}
            </div>
        </div>
    );
});
PlayerCard.displayName = 'PlayerCard';

// Stats Card component
const StatsCard = React.memo(({ label, value, icon: Icon, color = 'cranberry' }) => (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-white/60 text-xs uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-semibold text-white mt-1">{value}</p>
            </div>
            <div className={`p-3 rounded-full bg-${color}/20`}>
                <Icon className={`w-5 h-5 text-${color === 'cranberry' ? 'cranberry' : 'white/70'}`} />
            </div>
        </div>
    </div>
));
StatsCard.displayName = 'StatsCard';

const SportRegistrationsPage = React.memo(() => {
    const params = useParams();
    const router = useRouter();
    const sportId = params.sportid;
    
    const [userDeets] = useAtom(userDeetsAtom);
    const [sportsData, setSportsData] = useAtom(sportsDataAtom);
    const [clubMembers] = useAtom(clubMembersAtom);
    const [lastFetchTimestamp, setLastFetchTimestamp] = useAtom(lastFetchTimestampAtom);
    
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Get current sport data
    const sportData = useMemo(() => {
        return sportsData.find(s => s.sport_id === parseInt(sportId));
    }, [sportsData, sportId]);

    // Filter registrations based on search
    const filteredRegistrations = useMemo(() => {
        if (!debouncedSearchTerm.trim()) return registrations;
        
        const searchLower = debouncedSearchTerm.toLowerCase().trim();
        return registrations.filter(reg => {
            const memberInfo = Array.isArray(clubMembers) ? 
                clubMembers.find(member => member.membership_id === reg.RMIS_ID) : null;
            const playerName = memberInfo?.card_name?.toLowerCase() || '';
            const rmisId = reg.RMIS_ID?.toLowerCase() || '';
            
            return playerName.includes(searchLower) || rmisId.includes(searchLower);
        });
    }, [registrations, debouncedSearchTerm, clubMembers]);

    // Calculate player counts
    const playerCounts = useMemo(() => {
        const main = registrations.filter(r => r.main_player === true).length;
        const reserve = registrations.filter(r => r.main_player === false).length;
        return { main, reserve, total: registrations.length };
    }, [registrations]);

    // Fetch sports data if not available
    const fetchSportsData = useCallback(async () => {
        if (isCacheValid(lastFetchTimestamp.sports, 'sports') && sportsData.length > 0) {
            return;
        }

        try {
            const result = await getAllEvents();
            if (result.success) {
                setSportsData(result.data);
                setLastFetchTimestamp(prev => ({ ...prev, sports: Date.now() }));
            }
        } catch (error) {
            console.error('Failed to fetch sports:', error);
        }
    }, [sportsData.length, lastFetchTimestamp.sports, setSportsData, setLastFetchTimestamp]);

    // Fetch registrations for this sport and club
    const fetchRegistrations = useCallback(async (showToast = false) => {
        if (!userDeets?.club_id || !sportId) {
            setLoading(false);
            return;
        }

        try {
            if (showToast) setRefreshing(true);
            else setLoading(true);
            
            const result = await getRegistrations({ 
                club_id: userDeets.club_id, 
                sport_id: parseInt(sportId) 
            });
            
            if (result.success) {
                setRegistrations(result.data || []);
                if (showToast) toast.success('Registrations refreshed');
            } else {
                toast.error('Failed to fetch registrations');
                setRegistrations([]);
            }
        } catch (error) {
            console.error('Error fetching registrations:', error);
            toast.error('Error loading registrations');
            setRegistrations([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userDeets?.club_id, sportId]);

    // Effect to fetch data
    useEffect(() => {
        fetchSportsData();
    }, [fetchSportsData]);

    useEffect(() => {
        if (userDeets?.club_id && sportId) {
            fetchRegistrations();
        }
    }, [userDeets?.club_id, sportId, fetchRegistrations]);

    // Handle back navigation
    const handleBack = useCallback(() => {
        router.push('/portal/dashboard/club-registrations');
    }, [router]);

    // Handle refresh
    const handleRefresh = useCallback(() => {
        fetchRegistrations(true);
    }, [fetchRegistrations]);

    // Handle export to Excel
    const handleExportExcel = useCallback(() => {
        try {
            if (registrations.length === 0) {
                toast.error('No registrations to export');
                return;
            }

            const excelData = registrations.map(reg => {
                const memberInfo = Array.isArray(clubMembers) ? 
                    clubMembers.find(member => member.membership_id === reg.RMIS_ID) : null;
                
                return {
                    'RMIS ID': reg.RMIS_ID || '',
                    'Player Name': memberInfo?.card_name || 'Unknown',
                    'Player Type': reg.main_player ? 'Main Player' : 'Reserve Player',
                    'Gender': memberInfo?.gender === 'M' ? 'Male' : memberInfo?.gender === 'F' ? 'Female' : 'Unknown',
                    'Member Status': memberInfo?.status === 1 ? 'General' : memberInfo?.status === 5 ? 'Prospective' : 'Unknown',
                    'Registration Date': reg.created_at ? new Date(reg.created_at).toLocaleDateString() : '',
                };
            });

            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Registrations');

            const filename = `${sportData?.sport_name || 'Sport'}_${sportData?.gender_type || ''}_Registrations_${new Date().toISOString().split('T')[0]}.xlsx`;
            
            XLSX.writeFile(workbook, filename);
            toast.success('Excel file downloaded successfully');
        } catch (error) {
            console.error('Error exporting Excel:', error);
            toast.error('Failed to export Excel file');
        }
    }, [registrations, clubMembers, sportData]);

    if (loading) {
        return (
            <div className="flex justify-center items-center mt-40">
                <img src="/load.svg" alt="Loading..." className="w-20" />
            </div>
        );
    }

    return (
        <div className="py-0 lg:py-0 pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBack}
                        className="bg-transparent border border-white/20 cursor-pointer text-white/70 hover:bg-white/10 hover:text-white"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-semibold tracking-wide">
                            {sportData?.sport_name || 'Sport'} 
                            <span className="text-white/50 ml-2">({sportData?.gender_type || 'Unknown'})</span>
                        </h1>
                        <p className="text-white/60 text-sm mt-1">
                            Registered players from your club
                        </p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="bg-transparent border border-white/20 cursor-pointer text-white/70 hover:bg-white/10 hover:text-white"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button
                        onClick={handleExportExcel}
                        disabled={registrations.length === 0}
                        className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 cursor-pointer"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <StatsCard 
                    label="Total Players" 
                    value={playerCounts.total} 
                    icon={Users}
                />
                <StatsCard 
                    label="Main Players" 
                    value={playerCounts.main} 
                    icon={Users}
                    color="cranberry"
                />
                <StatsCard 
                    label="Reserve Players" 
                    value={playerCounts.reserve} 
                    icon={Users}
                    color="white"
                />
            </div>

            {/* Search */}
            <div className="mb-6">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
                    <Input
                        type="text"
                        placeholder="Search by name or RMIS ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                </div>
            </div>

            {/* Registrations List */}
            {filteredRegistrations.length === 0 ? (
                <div className="text-center py-12 bg-white/5 border border-white/10 rounded-lg">
                    <Users className="w-12 h-12 mx-auto text-white/30 mb-4" />
                    <p className="text-white/60">
                        {searchTerm.trim() 
                            ? 'No players found matching your search' 
                            : 'No players registered for this sport yet'
                        }
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Main Players Section */}
                    {playerCounts.main > 0 && (
                        <div className="mb-6">
                            <div className='flex items-center w-full mb-3'>
                                <h3 className="text-sm font-medium text-white/70 flex items-center">
                                    Main Players ({filteredRegistrations.filter(r => r.main_player).length})
                                </h3>
                                <div className="flex-1 ml-4 h-px bg-gradient-to-r from-cranberry/50 to-transparent"></div>
                            </div>
                            <div className="space-y-2">
                                {filteredRegistrations
                                    .filter(r => r.main_player)
                                    .map((reg, index) => (
                                        <PlayerCard
                                            key={`${reg.RMIS_ID}-${reg.sport_id}-${index}`}
                                            registration={reg}
                                            clubMembers={clubMembers}
                                        />
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    {/* Reserve Players Section */}
                    {playerCounts.reserve > 0 && (
                        <div>
                            <div className='flex items-center w-full mb-3'>
                                <h3 className="text-sm font-medium text-white/70 flex items-center">
                                    Reserve Players ({filteredRegistrations.filter(r => !r.main_player).length})
                                </h3>
                                <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/30 to-transparent"></div>
                            </div>
                            <div className="space-y-2">
                                {filteredRegistrations
                                    .filter(r => !r.main_player)
                                    .map((reg, index) => (
                                        <PlayerCard
                                            key={`${reg.RMIS_ID}-${reg.sport_id}-${index}`}
                                            registration={reg}
                                            clubMembers={clubMembers}
                                        />
                                    ))
                                }
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Sport Info Footer */}
            {sportData && (
                <div className="mt-8 p-4 bg-white/5 border border-white/10 rounded-lg">
                    <h3 className="text-sm font-medium text-white/70 mb-2">Sport Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <p className="text-white/50">Max Players</p>
                            <p className="text-white font-medium">{sportData.max_count || '-'}</p>
                        </div>
                        <div>
                            <p className="text-white/50">Reserve Slots</p>
                            <p className="text-white font-medium">{sportData.reserve_count || '-'}</p>
                        </div>
                        <div>
                            <p className="text-white/50">Event Day</p>
                            <p className="text-white font-medium">{sportData.sport_day || 'TBD'}</p>
                        </div>
                        <div>
                            <p className="text-white/50">Category</p>
                            <p className="text-white font-medium capitalize">{sportData.category || '-'}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

SportRegistrationsPage.displayName = 'SportRegistrationsPage';

export default SportRegistrationsPage;
