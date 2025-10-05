'use client'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation';
import { useAtom } from 'jotai';
import { clubMembersAtom, sportsDataAtom, userDeetsAtom, lastFetchTimestampAtom, isCacheValid } from '@/app/state/store';
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import { CheckIcon, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getRegistrations, registerPlayer, deleteRegistration } from '@/services/registrationService';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getAllEvents } from '@/services/sportServices';
import { APP_CONFIG } from '@/config/app.config';

// Memoized PlayerRow component moved outside to avoid conditional hook usage
const PlayerRow = React.memo(({ player, isMain, clubMembers, onDeletePlayer, isRegistrationAllowed }) => {
    const memberInfo = Array.isArray(clubMembers) ? 
        clubMembers.find(member => member.membership_id === player.RMIS_ID) : null;
    
    return (
        <div 
            className={`flex justify-between items-center p-3 rounded-md ${isMain ? 'bg-cranberry/20' : 'bg-white/5'}`}
        >
            <div className="flex space-x-4 items-center">
                <div className='flex space-x-4 items-center'>
                    <p className="font-bold">{memberInfo?.card_name || 'Unknown'}</p>
                    <p className="text-xs text-white/50">{player.RMIS_ID}</p>
                </div>
            </div>
            <div className="flex space-x-4 items-center">
                <p className="text-xs px-2 py-1 bg-white/10 rounded-full">
                    {memberInfo?.status === 1 ? 'Active' : memberInfo?.status === 5 ? 'Prospective' : 'Unknown'}
                </p>
                <p className={`text-xs font-semibold px-2 py-1 rounded-full ${isMain ? 'bg-cranberry/40' : 'bg-white/20'}`}>
                    {isMain ? 'Main' : 'Reserve'}
                </p>
                {isRegistrationAllowed && (
                    <Button 
                        size="sm"
                        className="p-1 h-auto hover:bg-red-500 bg-transparent text-white/60 hover:text-white cursor-pointer"
                        onClick={() => onDeletePlayer(player)}
                        title="Remove player"
                    >
                        <Trash2 size={16} />
                    </Button>
                )}
            </div>
        </div>
    );
});
PlayerRow.displayName = 'PlayerRow';

const SportRegistrationPage = React.memo(() => {
    const params = useParams();
    const router = useRouter();
    const [userDeets, setUserDeets] = useAtom(userDeetsAtom);
    const [selectedSport, setSelectedSport] = useState(0);
    const [sportsData, setSportsData] = useAtom(sportsDataAtom);
    const [lastFetchTimestamp, setLastFetchTimestamp] = useAtom(lastFetchTimestampAtom);
    const [selectedSportData, setSelectedSportData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [clubMembers, setClubMembers] = useAtom(clubMembersAtom);
    
    // ComboBox states
    const [open, setOpen] = useState(false);
    const [selectedValue, setSelectedValue] = useState("");
    const [selectedMember, setSelectedMember] = useState(null);
    const [registeredPlayers, setRegisteredPlayers] = useState([]);
    const [isMainPlayer, setIsMainPlayer] = useState(true);
    
    // Alert Dialog states
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [playerToDelete, setPlayerToDelete] = useState(null);


    // Memoized filtered club members based on sport gender and registration status
    const availableClubMembers = useMemo(() => {
        if (!Array.isArray(clubMembers) || !selectedSportData?.gender_type) {
            return [];
        }

        return clubMembers.filter(member => {
            // Check if member is already registered
            if (Array.isArray(registeredPlayers) && 
                registeredPlayers.some(player => player.RMIS_ID === member.membership_id)) {
                return false;
            }
            
            // Filter by gender matching sport requirements
            const sportGender = selectedSportData.gender_type.toLowerCase();
            return (sportGender === 'boys' && member.gender === 'M') || 
                   (sportGender === 'girls' && member.gender === 'F') ||
                   sportGender === 'mixed'; // Allow both for mixed sports
        });
    }, [clubMembers, selectedSportData?.gender_type, registeredPlayers]);

    // Memoized player counts for validation and display
    const playerCounts = useMemo(() => {
        const mainPlayers = registeredPlayers.filter(p => p.main_player === true).length;
        const reservePlayers = registeredPlayers.filter(p => p.main_player === false).length;
        
        return { 
            mainPlayers, 
            reservePlayers,
            maxMain: selectedSportData?.max_count || 0,
            maxReserve: selectedSportData?.reserve_count || 0
        };
    }, [registeredPlayers, selectedSportData?.max_count, selectedSportData?.reserve_count]);

    // Check if registration/deletion is allowed based on deadline
    const isRegistrationAllowed = useMemo(() => {
        const currentDate = new Date();
        const deadlineDate = new Date(APP_CONFIG.REGISTRATION_DEADLINE);
        return currentDate <= deadlineDate;
    }, []);

    // Optimized fetch functions with caching
    const fetchAllSports = useCallback(async () => {
        // Check cache validity first
        if (sportsData.length > 0 && isCacheValid(lastFetchTimestamp.sports)) {
            console.log('Using cached sports data for sport registration');
            return sportsData;
        }

        try {
            const result = await getAllEvents();
            if (result.success) {
                setSportsData(result.data);
                setLastFetchTimestamp(prev => ({ ...prev, sports: Date.now() }));
                return result.data;
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch sports:', error);
            return [];
        }
    }, [sportsData.length, lastFetchTimestamp.sports, setSportsData, setLastFetchTimestamp]);

    const fetchRegisteredPlayers = useCallback(async () => {
        try {
            const response = await getRegistrations({ 
                sport_id: params.sportid, 
                club_id: userDeets.club_id 
            });
            if (response.success) {
                setRegisteredPlayers(response.data);
            } else {
                console.error('Failed to fetch registered players:', response.error);
                setRegisteredPlayers([]);
            }
        } catch (error) {
            console.error('Error fetching registered players:', error);
            setRegisteredPlayers([]);
        }
    }, [params.sportid, userDeets.club_id]);

    useEffect(() => {
        const initializeData = async () => {
            if (!params.sportid) {
                router.push(`/portal/dashboard/registration`);
                return;
            }

            const sportId = parseInt(params.sportid);
            setSelectedSport(sportId);
            setLoading(true);

            // Get sports data (cached or fresh)
            const currentSportsData = await fetchAllSports();
            
            // Find the selected sport
            const foundSport = currentSportsData.find(event => event.sport_id === sportId);
            setSelectedSportData(foundSport);

            // Fetch registered players
            await fetchRegisteredPlayers();
            setLoading(false);
        };

        initializeData();
    }, []);


    
    // Log club members when available (debug)
    useEffect(() => {
        console.log('clubMembers state:', clubMembers);
        if (Array.isArray(clubMembers)) {
            console.log('Club members available:', clubMembers.length);
            
            // Debug filtered members by gender
            if (selectedSportData?.gender_type) {
                const sportGender = selectedSportData.gender_type.toLowerCase();
                const filteredMembers = clubMembers.filter(member => 
                    (sportGender === 'boys' && member.gender === 'M') || 
                    (sportGender === 'girls' && member.gender === 'F')
                );
                console.log(`Filtered ${filteredMembers.length} ${sportGender} members from ${clubMembers.length} total`);
            }
        } else {
            // Initialize club members if it's not an array
            setClubMembers([]);
            console.log('Initialized clubMembers as empty array');
        }
    }, [clubMembers, setClubMembers, selectedSportData]);

    // Optimized member selection handler
    const handleSelectMember = useCallback((currentValue) => {
        if (!Array.isArray(availableClubMembers)) {
            console.error('availableClubMembers is not available');
            setSelectedValue("");
            setOpen(false);
            return;
        }
        
        // Find member from available members (already filtered)
        const member = availableClubMembers.find(member => 
            member && member.card_name && 
            member.card_name.trim().toLowerCase() === currentValue.trim().toLowerCase()
        );
        
        if (member) {
            setSelectedMember(member);
            setSelectedValue(member.card_name);
        }
        
        setOpen(false);
    }, [availableClubMembers]);


    
    // Optimized registration handler
    const handleRegisterPlayer = useCallback(async () => {
        if (!selectedMember) return;
        
        setLoading(true);
        try {
            const response = await registerPlayer(selectedMember, selectedSport, isMainPlayer, selectedSportData);
            
            if (response.success) {
                toast.success('Player registered successfully');
                await fetchRegisteredPlayers();
                setSelectedMember(null);
                setSelectedValue("");
            } else {
                toast.error(response.error || 'Failed to register player');
            }
        } catch (error) {
            toast.error('Error registering player');
            console.error('Registration error:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedMember, selectedSport, isMainPlayer, selectedSportData, fetchRegisteredPlayers]);

    // Memoized registration validation
    const canRegisterPlayer = useMemo(() => {
        if (!selectedMember) return false;

        if (isMainPlayer) {
            return playerCounts.mainPlayers < playerCounts.maxMain;
        } else {
            return playerCounts.reservePlayers < playerCounts.maxReserve;
        }
    }, [selectedMember, isMainPlayer, playerCounts]);
    
    // Optimized delete handlers
    const confirmDeletePlayer = useCallback((player) => {
        setPlayerToDelete(player);
        setIsDeleteDialogOpen(true);
    }, []);
    
    const handleDeletePlayer = useCallback(async () => {
        if (!playerToDelete) return;
        
        try {
            await deleteRegistration(playerToDelete.RMIS_ID, playerToDelete.sport_id);
            toast.success('Player removed successfully');
            await fetchRegisteredPlayers();
            setIsDeleteDialogOpen(false);
            setPlayerToDelete(null);
        } catch (error) {
            toast.error('Error removing player: ' + error.message);
            setIsDeleteDialogOpen(false);
        }
    }, [playerToDelete, fetchRegisteredPlayers]);
    
    // Optimized checkbox handlers
    const handleMainPlayerChange = useCallback(() => {
        setIsMainPlayer(true);
    }, []);
    
    const handleReservePlayerChange = useCallback(() => {
        setIsMainPlayer(false);
    }, []);

    // Memoized player lists to avoid conditional hook usage
    const { mainPlayers, reservePlayers } = useMemo(() => {
        const main = registeredPlayers.filter(player => player.main_player === true);
        const reserve = registeredPlayers.filter(player => player.main_player === false);
        return { mainPlayers: main, reservePlayers: reserve };
    }, [registeredPlayers]);

    if (loading){
        return (
            <div className="flex justify-center items-center mt-40">
                <img src="/load.svg" alt="" className="w-20" />
            </div>
        )
    }
    
    return (
        <div>
            <div className="flex w-full space-x-5 items-center mb-8">
                <h1 className="text-2xl font-semibold tracking-wide uppercase">{selectedSportData?.sport_name}</h1>
                <p className="bg-white/5 border border-white/80 px-4 py-1 rounded-full text-xs text-white/80">{selectedSportData?.gender_type}</p>
            </div>

            {isRegistrationAllowed && (
                <div className="bg-white/5 rounded-lg p-8 ">
                    <h1 className="text-lg mb-6">Register Players</h1>
                    
                    <div className='flex w-full space-x-5'>
                        <div className="mb-6 w-3/4">
                            <Popover open={open} onOpenChange={setOpen} className="w-full">
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={open}
                                        className="w-full justify-between bg-white/5 border-white/20 hover:bg-white/10 hover:text-white text-white"
                                    >
                                        {selectedValue
                                            ? selectedValue
                                            : "Select a player..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0 bg-black/50 border-white/20" align="start" sideOffset={5} style={{ width: 'var(--radix-popover-trigger-width)' }}>
                                    <Command className="w-full">
                                        <CommandInput placeholder="Search members..." className="w-full" />
                                        <CommandList className="w-full">
                                            <CommandEmpty className="py-6 text-center text-sm text-white/70">No members found.</CommandEmpty>
                                            <CommandGroup className="max-h-64 overflow-auto">
                                                {availableClubMembers.length > 0 ? (
                                                    availableClubMembers.map((member) => (
                                                        <CommandItem
                                                            key={member.id || member.membership_id}
                                                            value={member.card_name}
                                                            onSelect={handleSelectMember}
                                                            className="hover:bg-white/10 cursor-pointer"
                                                        >
                                                            <CheckIcon
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedValue === member.card_name
                                                                        ? "opacity-100"
                                                                        : "opacity-0"
                                                                )}
                                                            />
                                                            {member.card_name}
                                                        </CommandItem>
                                                    ))
                                                ) : (
                                                    <CommandItem disabled>
                                                        {clubMembers.length === 0 ? 'No club members available' : 'All eligible members already registered'}
                                                    </CommandItem>
                                                )}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <Input
                            type="text"
                            placeholder="RI number"
                            value={selectedMember?.ri_number || ""}
                            onChange={(e) => setSelectedMember({ ...selectedMember, ri_number: e.target.value })}
                            className="border border-white/20 bg-transparent w-1/4 text-white placeholder:text-white/50"
                        />
                    </div>
                    <div className="flex items-center space-x-6 mb-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="mainPlayer" 
                                checked={isMainPlayer} 
                                onCheckedChange={handleMainPlayerChange}
                                className="border-white/50 data-[state=checked]:bg-cranberry data-[state=checked]:border-cranberry"
                            />
                            <label htmlFor="mainPlayer" className="text-sm text-white/80 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Main Player
                            </label>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="reservePlayer" 
                                checked={!isMainPlayer} 
                                onCheckedChange={handleReservePlayerChange}
                                className="border-white/50 data-[state=checked]:bg-cranberry data-[state=checked]:border-cranberry"
                            />
                            <label htmlFor="reservePlayer" className="text-sm text-white/80 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Reserve Player
                            </label>
                        </div>
                    </div>
                    
                    {/* Player type selection */}
                    {selectedMember && (
                        <div className="mb-6 p-4 border border-white/20 rounded-md bg-black/15 grid grid-cols-2">
                            <h3 className="text-sm text-white/80 mb-3">Selected Player: <span className="font-semibold">{selectedMember.card_name}</span></h3>
                            <h3 className="text-sm text-white/80 mb-3">RMIS Id: <span className="font-semibold">{selectedMember.membership_id}</span></h3>
                            <h3 className="text-sm text-white/80 mb-3">Membership status: <span className="font-semibold">{selectedMember.status == 1 ? 'General Member' : 'Prospective Member'}</span></h3>
                            <h3 className="text-sm text-white/80 mb-3">NIC: <span className="font-semibold">{selectedMember.nic_pp}</span></h3>

                        </div>
                    )}
                    
                    <Button 
                        className="bg-cranberry/10 border border-cranberry hover:bg-cranberry cursor-pointer text-white w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!canRegisterPlayer || loading}
                        onClick={handleRegisterPlayer}
                    >
                        {loading ? 'Registering...' : 'Register Player'}
                    </Button>
                </div>
            )}

            {!isRegistrationAllowed && (
                <div className="bg-white/5 rounded-lg p-8">
                    <h1 className="text-lg mb-6">Registration Closed</h1>
                    <p className="text-white/70">The registration deadline has passed. You can no longer register new players or remove existing ones.</p>
                </div>
            )}

            <div className="bg-white/5 rounded-lg p-8 mt-10">
                <div className='flex space-x-4 items-end mb-4'>
                    <h1 className="text-lg">Team Information</h1>
                    <p className='text-sm text-white/50'>
                        [Main : {playerCounts.mainPlayers}/{playerCounts.maxMain} {playerCounts.mainPlayers === playerCounts.maxMain ? '✅' : ''} | 
                        Reserve : {playerCounts.reservePlayers}/{playerCounts.maxReserve} {playerCounts.reservePlayers === playerCounts.maxReserve ? '✅' : ''}]
                    </p>
                </div>
                <div className="space-y-2">
                    {/* Main Players */}
                    {mainPlayers.map(player => (
                        <PlayerRow 
                            key={`main-${player.RMIS_ID}`} 
                            player={player} 
                            isMain={true}
                            clubMembers={clubMembers}
                            onDeletePlayer={confirmDeletePlayer}
                            isRegistrationAllowed={isRegistrationAllowed}
                        />
                    ))}
                    
                    {/* Reserve Players */}
                    {reservePlayers.map(player => (
                        <PlayerRow 
                            key={`reserve-${player.RMIS_ID}`} 
                            player={player} 
                            isMain={false}
                            clubMembers={clubMembers}
                            onDeletePlayer={confirmDeletePlayer}
                            isRegistrationAllowed={isRegistrationAllowed}
                        />
                    ))}
                </div>
            </div>
            
            {/* Delete Confirmation Dialog */}
            {isRegistrationAllowed && (
                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                    <AlertDialogContent className="bg-black/80 border-white/20 text-white">
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirm Removal</AlertDialogTitle>
                            <AlertDialogDescription className="text-white/70">
                                Are you sure you want to remove this player from the team?
                            </AlertDialogDescription>
                            {playerToDelete && 
                                <div className="mt-2 p-2 bg-white/10 rounded-md">
                                    <div className="font-medium">{clubMembers?.find(m => m.membership_id === playerToDelete.RMIS_ID)?.card_name || 'Unknown player'}</div>
                                    <div className="text-sm text-white/50">{playerToDelete.RMIS_ID}</div>
                                </div>
                            }
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="bg-transparent border-white/20 text-white hover:bg-white/10 cursor-pointer">Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={handleDeletePlayer}
                                className="bg-cranberry hover:bg-cranberry/80 text-white cursor-pointer"
                            >
                                Remove
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
});

SportRegistrationPage.displayName = 'SportRegistrationPage';

export default SportRegistrationPage
