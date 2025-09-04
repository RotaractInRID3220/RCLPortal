'use client'
import React, { useState, useEffect} from 'react'
import { useParams } from 'next/navigation';
import { useAtom } from 'jotai';
import { clubMembersAtom, sportsDataAtom, userDeetsAtom } from '@/app/state/store';
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



const page = () => {
    const params = useParams();
    const router = useRouter();
    const [userDeets, setUserDeets] = useAtom(userDeetsAtom);
    const [selectedSport, setSelectedSport] = useState(0);
    const [sportsData, setSportsData] = useAtom(sportsDataAtom);
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


    useEffect(() => {
        const initializeData = async () => {
            if (!params.sportid) {
                router.push(`/portal/dashboard/registration`);
                return;
            }

            const sportId = parseInt(params.sportid);
            setSelectedSport(sportId);
            setLoading(true);

            // Check if we need to fetch sports data
            if (sportsData.length === 0) {
                try {
                    const result = await getAllEvents();
                    if (result.success) {
                        setSportsData(result.data);
                        // Find the selected sport from the newly loaded data
                        const foundSport = result.data.find(event => event.sport_id === sportId);
                        setSelectedSportData(foundSport);
                    }
                } catch (error) {
                    console.error('Failed to fetch sports:', error);
                }
            } else {
                // Use existing sports data
                const foundSport = sportsData.find(event => event.sport_id === sportId);
                setSelectedSportData(foundSport);
            }

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

    const fetchRegisteredPlayers = async () => {
        try {
            const response = await getRegistrations({ sport_id: params.sportid, club_id: userDeets.club_id });
            if (response.success) {
                setRegisteredPlayers(response.data);
            } else {
                console.error('Failed to fetch registered players:', response.error);
            }
        } catch (error) {
            console.error('Error fetching registered players:', error);
        }
    };

    // Handle player selection from combobox
    const handleSelectMember = (currentValue) => {
        
        // Safety check for clubMembers
        if (!Array.isArray(clubMembers)) {
            console.error('clubMembers is not an array:', clubMembers);
            setSelectedValue("");
            setOpen(false);
            return;
        }
        
        // Find the selected member from clubMembers (case-insensitive search)
        const member = clubMembers.find(member => 
            member && member.card_name && 
            member.card_name.trim() === currentValue.trim()
        );
        console.log('Found member:', member);
        
        if (!member) {

            // Try a more flexible search
            const fuzzyMember = clubMembers.find(member => 
                member && member.card_name && 
                member.card_name.toLowerCase().trim() === currentValue.toLowerCase().trim()
            );
            
            if (fuzzyMember) {
                // Use the fuzzy found member
                const isAlreadyRegistered = registeredPlayers.some(p => p.RMIS_ID === fuzzyMember.membership_id);
                
                if (!isAlreadyRegistered) {
                    setSelectedMember(fuzzyMember);
                    setSelectedValue(fuzzyMember.card_name);
                } else {
                    console.log('Member is already registered, cannot select');
                }
                setOpen(false);
                return;
            }
            
            setOpen(false);
            return;
        }
        
        // Check if member is already registered
        const isAlreadyRegistered = registeredPlayers.some(p => p.RMIS_ID === member.membership_id);
        console.log('Is already registered:', isAlreadyRegistered);
        
        if (!isAlreadyRegistered) {
            setSelectedMember(member);
            setSelectedValue(member.card_name);
        } else {
            console.log('Member is already registered, cannot select');
        }
        
        setOpen(false);
    }


    
    // Register the selected player
    const handleRegisterPlayer = async () => {
        const response = await registerPlayer(selectedMember, selectedSport, isMainPlayer, selectedSportData);
        
        if (response.success) {
            toast.success('Player registered successfully');
            fetchRegisteredPlayers();
            setSelectedMember(null);
            setSelectedValue(""); // Clear the selected value in the dropdown
            // Handle successful registration (e.g., update UI, show message)
        } else {
            // Display the error message from the response
            toast.error(response.error || 'Failed to register player');
            // console.error('Registration failed:', response);
        }
    }

    const registrationConstraints = () => {
        // Base validation - no member selected
        if (!selectedMember){
            return false;
        }

        // Maximum player count validation
        if (isMainPlayer) {
            // Check if the number of main players is less than the maximum allowed
            const mainPlayersCount = registeredPlayers.filter(p => p.main_player === true).length;
            if (mainPlayersCount >= selectedSportData?.max_count) {
                return false;
            }
        }
        
        if (!isMainPlayer) {
            // Check if the number of reserve players is less than the maximum allowed
            const reservePlayersCount = registeredPlayers.filter(p => p.main_player === false).length;
            if (reservePlayersCount >= selectedSportData?.reserve_count) {
                return false;
            }
        }

        // All constraints passed - the full complex constraints will be checked in registerPlayer
        return true;
    }
    
    // Open the delete dialog
    const confirmDeletePlayer = (player) => {
        setPlayerToDelete(player);
        setIsDeleteDialogOpen(true);
    };
    
    // Delete the selected player
    const handleDeletePlayer = () => {
        if (!playerToDelete) return;
        
        deleteRegistration(playerToDelete.RMIS_ID, playerToDelete.sport_id)
            .then(response => {
                toast.success('Player removed successfully');
                fetchRegisteredPlayers();
                setIsDeleteDialogOpen(false);
                setPlayerToDelete(null);
            })
            .catch(error => {
                toast.error('Error removing player: ' + error.message);
                setIsDeleteDialogOpen(false);
            });
    }
    
    // Handle checkbox changes with mutual exclusivity
    const handleMainPlayerChange = (checked) => {
        setIsMainPlayer(true);
    };
    
    const handleReservePlayerChange = (checked) => {
            setIsMainPlayer(false);
    };

    const fetchAllSports = async () => {
            try {
                setLoading(true);
                const result = await getAllEvents();
                if (result.success) {
                    setSportsData(result.data);
                    console.log('Sports data loaded:', result.data);
                    
                    // Find and set the selected sport data
                    const sportId = params.sportid;
                    const foundSport = result.data.find(sport => sport.sport_id === sportId);
                    if (foundSport) {
                        setSelectedSportData(foundSport);
                    } else {
                        toast.error("Sport not found");
                    }
                }
            } catch (error) {
                console.error('Failed to fetch sports:', error);
                // Error toast already handled by getAllEvents service
            } finally {
                setLoading(false);
            }
    };

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
                                            {Array.isArray(clubMembers) && clubMembers.length > 0 ? (
                                                clubMembers
                                                    .filter(member => {
                                                        // First, check if member is already registered
                                                        if (Array.isArray(registeredPlayers) && 
                                                            registeredPlayers.some(player => player.RMIS_ID === member.membership_id)) {
                                                            return false; // Skip already registered members
                                                        }
                                                        
                                                        // Then filter members based on gender matching sport gender type
                                                        if (!selectedSportData?.gender_type || !member?.gender) return true;
                                                        const sportGender = selectedSportData.gender_type.toLowerCase();
                                                        return (sportGender === 'boys' && member.gender === 'M') || 
                                                               (sportGender === 'girls' && member.gender === 'F');
                                                    })
                                                    .map((member) => (
                                                    <CommandItem
                                                        key={member.id || member.card_name}
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
                                                <CommandItem disabled>No club members available</CommandItem>
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
                    className="bg-cranberry/10 border border-cranberry hover:bg-cranberry cursor-pointer text-white w-full"
                    disabled={!registrationConstraints()}
                    onClick={() => handleRegisterPlayer()}
                >
                    Register Player
                </Button>
            </div>

            <div className="bg-white/5 rounded-lg p-8 mt-10">
                <div className='flex space-x-4 items-end mb-4'>
                    <h1 className="text-lg">Team Information</h1>
                    <p className='text-sm text-white/50'>[Main : {registeredPlayers.filter(p => p.main_player === true).length} {registeredPlayers.filter(p => p.main_player === true).length == selectedSportData?.max_count ? '✅' : null} | Reserve : {registeredPlayers.filter(p => p.main_player === false).length} {registeredPlayers.filter(p => p.main_player === false).length == selectedSportData?.reserve_count ? '✅' : null}]</p>
                </div>
                <div className="space-y-2">
                    {/* Main Players First */}
                    {registeredPlayers
                        .filter(player => player.main_player === true)
                        .map(player => {
                            const memberInfo = Array.isArray(clubMembers) ? 
                                clubMembers.find(member => member.membership_id === player.RMIS_ID) : null;
                            
                            return (
                                <div key={player.id} className="flex justify-between items-center p-3 bg-cranberry/20 rounded-md">
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
                                        <p className="text-xs font-semibold px-2 py-1 bg-cranberry/40 rounded-full">Main</p>
                                        <Button 
                                            size="sm"
                                            className="p-1 h-auto hover:bg-red-500 bg-transparent text-white/60 hover:text-white cursor-pointer"
                                            onClick={() => confirmDeletePlayer(player)}
                                            title="Remove player"
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    
                    {/* Reserve Players Next */}
                    {registeredPlayers
                        .filter(player => player.main_player === false)
                        .map(player => {
                            const memberInfo = Array.isArray(clubMembers) ? 
                                clubMembers.find(member => member.membership_id === player.RMIS_ID) : null;
                            
                            return (
                                <div key={player.id} className="flex justify-between items-center p-3 bg-white/5 rounded-md">
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
                                        <p className="text-xs font-semibold px-2 py-1 bg-white/20 rounded-full">Reserve</p>
                                        <Button 
                                            size="sm"
                                            className="p-1 h-auto hover:bg-red-500 bg-transparent text-white/60 hover:text-white cursor-pointer"
                                            onClick={() => confirmDeletePlayer(player)}
                                            title="Remove player"
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>
            
            {/* Delete Confirmation Dialog */}
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
        </div>
    )


}

export default page
