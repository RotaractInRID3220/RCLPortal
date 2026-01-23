'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { userDeetsAtom } from '@/app/state/store';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RefreshCw, UserMinus, ArrowLeftRight, Shield, ChevronsUpDown, Check, MoveRight, AlertCircle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import PrivateRoute from '@/lib/PrivateRoute';

export default function AdminPlayerChangesPage() {
    const [userDeets] = useAtom(userDeetsAtom);

    // Clubs data
    const [clubs, setClubs] = useState([]);
    const [selectedClub, setSelectedClub] = useState('');
    const [clubPopoverOpen, setClubPopoverOpen] = useState(false);
    const [loadingClubs, setLoadingClubs] = useState(true);

    // Context data for selected club
    const [contextData, setContextData] = useState(null);
    const [loadingContext, setLoadingContext] = useState(false);

    // Club members (from DBMID)
    const [clubMembers, setClubMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Replacement form state
    const [replacementSport, setReplacementSport] = useState('');
    const [replacementSportPopoverOpen, setReplacementSportPopoverOpen] = useState(false);
    const [playerToReplace, setPlayerToReplace] = useState('');
    const [playerToReplacePopoverOpen, setPlayerToReplacePopoverOpen] = useState(false);
    const [replacementMember, setReplacementMember] = useState('');
    const [replacementMemberPopoverOpen, setReplacementMemberPopoverOpen] = useState(false);
    const [replacementReason, setReplacementReason] = useState('');
    const [submittingReplacement, setSubmittingReplacement] = useState(false);

    // Swap form state
    const [swapType, setSwapType] = useState('swap'); // 'swap' or 'move'
    const [swapSport1, setSwapSport1] = useState('');
    const [swapSport1PopoverOpen, setSwapSport1PopoverOpen] = useState(false);
    const [swapPlayer1, setSwapPlayer1] = useState('');
    const [swapPlayer1PopoverOpen, setSwapPlayer1PopoverOpen] = useState(false);
    const [swapSport2, setSwapSport2] = useState('');
    const [swapSport2PopoverOpen, setSwapSport2PopoverOpen] = useState(false);
    const [swapPlayer2, setSwapPlayer2] = useState('');
    const [swapPlayer2PopoverOpen, setSwapPlayer2PopoverOpen] = useState(false);
    const [swapDestinationSport, setSwapDestinationSport] = useState('');
    const [swapDestinationPopoverOpen, setSwapDestinationPopoverOpen] = useState(false);
    const [swapReason, setSwapReason] = useState('');
    const [submittingSwap, setSubmittingSwap] = useState(false);

    // Fetch clubs on mount
    useEffect(() => {
        const fetchClubs = async () => {
            try {
                const response = await fetch('/api/clubs');
                const data = await response.json();
                // API returns { clubs: [...] }
                setClubs(data.clubs || []);
            } catch (error) {
                console.error('Error fetching clubs:', error);
                toast.error('Failed to load clubs');
            } finally {
                setLoadingClubs(false);
            }
        };
        fetchClubs();
    }, []);

    // Fetch context when club changes
    const fetchContext = useCallback(async (clubId) => {
        if (!clubId) {
            setContextData(null);
            return;
        }

        setLoadingContext(true);
        try {
            const response = await fetch(`/api/admin/player-changes?club_id=${clubId}`);
            const data = await response.json();
            if (data.success) {
                setContextData(data.data);
            } else {
                toast.error(data.error || 'Failed to load club data');
            }
        } catch (error) {
            console.error('Error fetching context:', error);
            toast.error('Failed to load club data');
        } finally {
            setLoadingContext(false);
        }
    }, []);

    // Fetch club members from DBMID
    const fetchClubMembers = useCallback(async (clubId) => {
        if (!clubId) {
            setClubMembers([]);
            return;
        }

        setLoadingMembers(true);
        try {
            const response = await fetch(`/api/council?clubID=${clubId}`);
            const data = await response.json();
            if (data.success) {
                // API returns { success: true, members: [...] }
                setClubMembers(data.members || []);
            }
        } catch (error) {
            console.error('Error fetching club members:', error);
        } finally {
            setLoadingMembers(false);
        }
    }, []);

    // Handle club selection
    const handleClubChange = (clubId) => {
        setSelectedClub(clubId);
        setClubPopoverOpen(false);
        // Reset all form states
        setReplacementSport('');
        setPlayerToReplace('');
        setReplacementMember('');
        setSwapSport1('');
        setSwapPlayer1('');
        setSwapSport2('');
        setSwapPlayer2('');
        setSwapDestinationSport('');

        fetchContext(clubId);
        fetchClubMembers(clubId);
    };

    // Get players for a specific sport from the context
    const getPlayersForSport = (sportId) => {
        if (!contextData?.sportRegistrations) return [];
        const registrations = contextData.sportRegistrations[sportId] || [];
        return registrations.map(reg => ({
            registration_id: reg.id,
            rmis_id: reg.RMIS_ID,
            name: reg.player?.name || reg.RMIS_ID,
            gender: reg.player?.gender,
            main_player: reg.main_player
        }));
    };

    // Get all sports that the club has registrations for
    const getAvailableSports = () => {
        if (!contextData?.sports) return [];
        return contextData.sports.map(s => {
            // Format gender type for display
            const genderLabel = s.gender_type 
                ? s.gender_type.charAt(0).toUpperCase() + s.gender_type.slice(1).toLowerCase()
                : '';
            return {
                sport_id: s.sport_id,
                sport_name: s.sport_name,
                gender_type: s.gender_type,
                display_name: genderLabel ? `${s.sport_name} (${genderLabel})` : s.sport_name
            };
        });
    };

    // Return all club members for replacement selection
    // Backend will validate same-day registration conflicts
    const getAvailableReplacementMembers = () => {
        if (!clubMembers.length) return [];
        return clubMembers;
    };

    // Handle replacement submission
    const handleReplacementSubmit = async () => {
        if (!replacementSport || !playerToReplace || !replacementMember || !replacementReason.trim()) {
            toast.error('Please fill all fields including reason');
            return;
        }

        // Get the registration ID from the selected player
        const players = getPlayersForSport(replacementSport);
        const selectedPlayer = players.find(p => p.rmis_id === playerToReplace);
        if (!selectedPlayer?.registration_id) {
            toast.error('Could not find registration for selected player');
            return;
        }

        setSubmittingReplacement(true);
        try {
            const selectedMember = clubMembers.find(m => m.membership_id === replacementMember);
            const response = await fetch('/api/admin/player-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'replacement',
                    club_id: parseInt(selectedClub),
                    sport_id: parseInt(replacementSport),
                    registrations_id: selectedPlayer.registration_id,
                    replacement_member: {
                        membership_id: replacementMember,
                        card_name: selectedMember?.card_name || '',
                        name: selectedMember?.card_name || '',
                        email: selectedMember?.email || '',
                        nic: selectedMember?.nic || '',
                        gender: selectedMember?.gender || '',
                        status: selectedMember?.status || ''
                    },
                    reason: replacementReason.trim(),
                    admin_id: userDeets?.membership_id,
                    admin_name: userDeets?.card_name || userDeets?.m_name
                })
            });

            const data = await response.json();
            if (data.success) {
                toast.success('Player replaced successfully');
                // Reset form
                setPlayerToReplace('');
                setReplacementMember('');
                setReplacementReason('');
                // Refresh context
                fetchContext(selectedClub);
            } else {
                toast.error(data.error || 'Failed to replace player');
            }
        } catch (error) {
            console.error('Error submitting replacement:', error);
            toast.error('Failed to replace player');
        } finally {
            setSubmittingReplacement(false);
        }
    };

    // Handle swap/move submission
    const handleSwapSubmit = async () => {
        if (swapType === 'swap') {
            if (!swapSport1 || !swapPlayer1 || !swapSport2 || !swapPlayer2 || !swapReason.trim()) {
                toast.error('Please fill all fields including reason for swap');
                return;
            }
        } else {
            if (!swapSport1 || !swapPlayer1 || !swapDestinationSport || !swapReason.trim()) {
                toast.error('Please fill all fields including reason for move');
                return;
            }
        }

        // Get registration IDs from selected players
        const players1 = getPlayersForSport(swapSport1);
        const selectedPlayer1 = players1.find(p => p.rmis_id === swapPlayer1);
        if (!selectedPlayer1?.registration_id) {
            toast.error('Could not find registration for player 1');
            return;
        }

        if (swapType === 'swap') {
            const players2 = getPlayersForSport(swapSport2);
            const selectedPlayer2 = players2.find(p => p.rmis_id === swapPlayer2);
            if (!selectedPlayer2?.registration_id) {
                toast.error('Could not find registration for player 2');
                return;
            }
        }

        setSubmittingSwap(true);
        try {
            const players2 = swapType === 'swap' ? getPlayersForSport(swapSport2) : [];
            const selectedPlayer2 = swapType === 'swap' ? players2.find(p => p.rmis_id === swapPlayer2) : null;

            const payload = swapType === 'swap' ? {
                action: 'swap',
                club_id: parseInt(selectedClub),
                player1_registrations_id: selectedPlayer1.registration_id,
                player2_registrations_id: selectedPlayer2.registration_id,
                reason: swapReason.trim(),
                admin_id: userDeets?.membership_id,
                admin_name: userDeets?.card_name || userDeets?.m_name
            } : {
                action: 'move',
                club_id: parseInt(selectedClub),
                player1_registrations_id: selectedPlayer1.registration_id,
                sport2_id: parseInt(swapDestinationSport),
                reason: swapReason.trim(),
                admin_id: userDeets?.membership_id,
                admin_name: userDeets?.card_name || userDeets?.m_name
            };

            const response = await fetch('/api/admin/player-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (data.success) {
                toast.success(swapType === 'swap' ? 'Players swapped successfully' : 'Player moved successfully');
                // Reset form
                setSwapPlayer1('');
                setSwapPlayer2('');
                setSwapDestinationSport('');
                setSwapReason('');
                // Refresh context
                fetchContext(selectedClub);
            } else {
                toast.error(data.error || `Failed to ${swapType} player(s)`);
            }
        } catch (error) {
            console.error(`Error submitting ${swapType}:`, error);
            toast.error(`Failed to ${swapType} player(s)`);
        } finally {
            setSubmittingSwap(false);
        }
    };

    const selectedClubName = clubs.find(c => c.club_id?.toString() === selectedClub)?.club_name || '';
    const availableSports = getAvailableSports();
    const playersForReplacementSport = getPlayersForSport(replacementSport);
    const availableReplacementMembers = getAvailableReplacementMembers();
    const playersForSwapSport1 = getPlayersForSport(swapSport1);
    const playersForSwapSport2 = getPlayersForSport(swapSport2);

    // For move: get sports that don't have max players already
    const getAvailableDestinationSports = () => {
        if (!contextData?.sports || !swapSport1) return [];
        return availableSports.filter(sport => sport.sport_id !== parseInt(swapSport1));
    };

    if (loadingClubs) {
        return (
            <div className="flex justify-center items-center h-screen">
                <img src="/load.svg" alt="Loading..." className="w-20" />
            </div>
        );
    }

    return (
        <PrivateRoute requiredPermission="administrator" accessType="admin">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex w-full justify-between items-center">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-cranberry/20 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-cranberry" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-semibold tracking-tight">Admin Player Changes</h1>
                                <p className="text-sm text-white/60 mt-1">Direct replacement and swap operations (auto-approved)</p>
                            </div>
                        </div>
                    </div>
                    {selectedClub && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                fetchContext(selectedClub);
                                fetchClubMembers(selectedClub);
                            }}
                            disabled={loadingContext || loadingMembers}
                            className="cursor-pointer bg-white/5 border-white/20 hover:bg-white/10"
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${(loadingContext || loadingMembers) ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    )}
                </div>

                {/* Club Selection */}
                <Card className="bg-white/5 border-white/15">
                    <CardHeader>
                        <CardTitle className="text-white/90">Select Club</CardTitle>
                        <CardDescription className="text-white/50">Choose a club to manage player changes</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Popover open={clubPopoverOpen} onOpenChange={setClubPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={clubPopoverOpen}
                                    className="w-full md:w-[400px] justify-between bg-white/10 border-white/20 text-white hover:bg-white/15"
                                >
                                    {selectedClub
                                        ? selectedClubName
                                        : "Search and select a club..."
                                    }
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full md:w-[400px] p-0">
                                <Command>
                                    <CommandInput placeholder="Search clubs..." />
                                    <CommandList>
                                        <CommandEmpty>No club found.</CommandEmpty>
                                        <CommandGroup>
                                            {clubs.map((club) => (
                                                <CommandItem
                                                    key={club.club_id}
                                                    value={club.club_name}
                                                    onSelect={() => handleClubChange(club.club_id?.toString())}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            selectedClub === club.club_id?.toString() ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {club.club_name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </CardContent>
                </Card>

                {/* Loading State */}
                {selectedClub && loadingContext && (
                    <div className="flex justify-center py-8">
                        <img src="/load.svg" alt="Loading..." className="w-12" />
                    </div>
                )}

                {/* Operations Tabs */}
                {selectedClub && contextData && !loadingContext && (
                    <Card className="bg-white/5 border-white/15">
                        <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Users className="w-5 h-5 text-white/70" />
                                    <CardTitle className="text-white/90">{selectedClubName}</CardTitle>
                                    <Badge variant="outline" className="border-white/30 text-white/60">
                                        {availableSports.length} sports registered
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="replacement" className="w-full">
                                <TabsList className="grid w-full grid-cols-2 bg-white/5">
                                    <TabsTrigger value="replacement" className="flex items-center gap-2 data-[state=active]:bg-cranberry/20 data-[state=active]:text-white">
                                        <UserMinus className="h-4 w-4" />
                                        Replacement
                                    </TabsTrigger>
                                    <TabsTrigger value="swap" className="flex items-center gap-2 data-[state=active]:bg-cranberry/20 data-[state=active]:text-white">
                                        <ArrowLeftRight className="h-4 w-4" />
                                        Swap / Move
                                    </TabsTrigger>
                                </TabsList>

                                {/* Replacement Tab */}
                                <TabsContent value="replacement" className="mt-6">
                                    {availableSports.length === 0 ? (
                                        <div className="text-center py-12">
                                            <AlertCircle className="w-12 h-12 mx-auto text-white/30 mb-3" />
                                            <p className="text-white/60">No registrations found for this club</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {/* Sport Selection */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-white/80">Select Sport</label>
                                                <Popover open={replacementSportPopoverOpen} onOpenChange={setReplacementSportPopoverOpen}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            aria-expanded={replacementSportPopoverOpen}
                                                            className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/15"
                                                        >
                                                            {replacementSport
                                                                ? availableSports.find(s => s.sport_id.toString() === replacementSport)?.display_name
                                                                : "Search and select a sport..."
                                                            }
                                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-full p-0">
                                                        <Command>
                                                            <CommandInput placeholder="Search sports..." />
                                                            <CommandList>
                                                                <CommandEmpty>No sport found.</CommandEmpty>
                                                                <CommandGroup>
                                                                    {availableSports.map((sport) => (
                                                                        <CommandItem
                                                                            key={sport.sport_id}
                                                                            value={sport.display_name}
                                                                            onSelect={() => {
                                                                                setReplacementSport(sport.sport_id.toString());
                                                                                setPlayerToReplace('');
                                                                                setReplacementMember('');
                                                                                setReplacementSportPopoverOpen(false);
                                                                            }}
                                                                        >
                                                                            <Check
                                                                                className={cn(
                                                                                    "mr-2 h-4 w-4",
                                                                                    replacementSport === sport.sport_id.toString() ? "opacity-100" : "opacity-0"
                                                                                )}
                                                                            />
                                                                            {sport.display_name}
                                                                        </CommandItem>
                                                                    ))}
                                                                </CommandGroup>
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>

                                            {/* Player to Replace */}
                                            {replacementSport && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-white/80">Player to Replace</label>
                                                    <Popover open={playerToReplacePopoverOpen} onOpenChange={setPlayerToReplacePopoverOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={playerToReplacePopoverOpen}
                                                                className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/15"
                                                            >
                                                                {playerToReplace
                                                                    ? playersForReplacementSport.find(p => p.rmis_id === playerToReplace)?.name
                                                                    : "Search and select a player..."
                                                                }
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-full p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Search players..." />
                                                                <CommandList>
                                                                    <CommandEmpty>No player found.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {playersForReplacementSport.map((player) => (
                                                                            <CommandItem
                                                                                key={player.rmis_id}
                                                                                value={`${player.name} ${player.rmis_id}`}
                                                                                onSelect={() => {
                                                                                    setPlayerToReplace(player.rmis_id);
                                                                                    setReplacementMember('');
                                                                                    setPlayerToReplacePopoverOpen(false);
                                                                                }}
                                                                            >
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-4 w-4",
                                                                                        playerToReplace === player.rmis_id ? "opacity-100" : "opacity-0"
                                                                                    )}
                                                                                />
                                                                                <div className="flex items-center gap-2">
                                                                                    {player.name}
                                                                                    <Badge variant="outline" className="text-xs">
                                                                                        {player.rmis_id}
                                                                                    </Badge>
                                                                                    {player.main_player && (
                                                                                        <Badge className="bg-cranberry/20 text-cranberry border-cranberry/40 text-xs">
                                                                                            Main
                                                                                        </Badge>
                                                                                    )}
                                                                                </div>
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                            )}

                                            {/* Replacement Member */}
                                            {playerToReplace && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-white/80">Replacement Member</label>
                                                    <Popover open={replacementMemberPopoverOpen} onOpenChange={setReplacementMemberPopoverOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={replacementMemberPopoverOpen}
                                                                className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/15"
                                                                disabled={loadingMembers}
                                                            >
                                                                {loadingMembers
                                                                    ? "Loading members..."
                                                                    : replacementMember
                                                                        ? clubMembers.find(m => m.membership_id === replacementMember)?.card_name
                                                                        : "Search and select a member..."
                                                                }
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-full p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Search members..." />
                                                                <CommandList>
                                                                    <CommandEmpty>No available member found.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {availableReplacementMembers.map((member) => (
                                                                            <CommandItem
                                                                                key={member.membership_id}
                                                                                value={`${member.card_name} ${member.membership_id}`}
                                                                                onSelect={() => {
                                                                                    setReplacementMember(member.membership_id);
                                                                                    setReplacementMemberPopoverOpen(false);
                                                                                }}
                                                                            >
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-4 w-4",
                                                                                        replacementMember === member.membership_id ? "opacity-100" : "opacity-0"
                                                                                    )}
                                                                                />
                                                                                <div className="flex items-center gap-2">
                                                                                    {member.card_name}
                                                                                    <Badge variant="outline" className="text-xs">
                                                                                        {member.membership_id}
                                                                                    </Badge>
                                                                                </div>
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                            )}

                                            {/* Reason */}
                                            {replacementMember && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-white/80">Reason for Replacement</label>
                                                    <input
                                                        type="text"
                                                        value={replacementReason}
                                                        onChange={(e) => setReplacementReason(e.target.value)}
                                                        placeholder="Enter reason for replacement..."
                                                        className="w-full px-3 py-2 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cranberry"
                                                    />
                                                </div>
                                            )}

                                            {/* Submit Button */}
                                            {replacementMember && replacementReason.trim() && (
                                                <Button
                                                    onClick={handleReplacementSubmit}
                                                    disabled={submittingReplacement}
                                                    className="w-full bg-cranberry hover:bg-cranberry/80"
                                                >
                                                    {submittingReplacement ? (
                                                        <>
                                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                            Processing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UserMinus className="h-4 w-4 mr-2" />
                                                            Execute Replacement
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </TabsContent>

                                {/* Swap / Move Tab */}
                                <TabsContent value="swap" className="mt-6">
                                    {availableSports.length === 0 ? (
                                        <div className="text-center py-12">
                                            <AlertCircle className="w-12 h-12 mx-auto text-white/30 mb-3" />
                                            <p className="text-white/60">No registrations found for this club</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {/* Swap Type Toggle */}
                                            <div className="flex gap-2">
                                                <Button
                                                    variant={swapType === 'swap' ? 'default' : 'outline'}
                                                    onClick={() => {
                                                        setSwapType('swap');
                                                        setSwapDestinationSport('');
                                                    }}
                                                    className={cn(
                                                        "flex-1 cursor-pointer",
                                                        swapType === 'swap' 
                                                            ? "bg-cranberry hover:bg-cranberry/80" 
                                                            : "bg-white/5 border-white/20 hover:bg-white/10"
                                                    )}
                                                >
                                                    <ArrowLeftRight className="h-4 w-4 mr-2" />
                                                    Swap Players
                                                </Button>
                                                <Button
                                                    variant={swapType === 'move' ? 'default' : 'outline'}
                                                    onClick={() => {
                                                        setSwapType('move');
                                                        setSwapSport2('');
                                                        setSwapPlayer2('');
                                                    }}
                                                    className={cn(
                                                        "flex-1 cursor-pointer",
                                                        swapType === 'move' 
                                                            ? "bg-cranberry hover:bg-cranberry/80" 
                                                            : "bg-white/5 border-white/20 hover:bg-white/10"
                                                    )}
                                                >
                                                    <MoveRight className="h-4 w-4 mr-2" />
                                                    Move Player
                                                </Button>
                                            </div>

                                            {/* First Player Selection */}
                                            <div className="p-4 border border-white/15 rounded-lg bg-white/5 space-y-4">
                                                <h4 className="font-medium text-white/90">
                                                    {swapType === 'swap' ? 'First Player' : 'Player to Move'}
                                                </h4>

                                                {/* Sport 1 */}
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-white/80">Sport</label>
                                                    <Popover open={swapSport1PopoverOpen} onOpenChange={setSwapSport1PopoverOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={swapSport1PopoverOpen}
                                                                className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/15"
                                                            >
                                                                {swapSport1
                                                                    ? availableSports.find(s => s.sport_id.toString() === swapSport1)?.display_name
                                                                    : "Search and select a sport..."
                                                                }
                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-full p-0">
                                                            <Command>
                                                                <CommandInput placeholder="Search sports..." />
                                                                <CommandList>
                                                                    <CommandEmpty>No sport found.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {availableSports.map((sport) => (
                                                                            <CommandItem
                                                                                key={sport.sport_id}
                                                                                value={sport.display_name}
                                                                                onSelect={() => {
                                                                                    setSwapSport1(sport.sport_id.toString());
                                                                                    setSwapPlayer1('');
                                                                                    setSwapSport1PopoverOpen(false);
                                                                                }}
                                                                            >
                                                                                <Check
                                                                                    className={cn(
                                                                                        "mr-2 h-4 w-4",
                                                                                        swapSport1 === sport.sport_id.toString() ? "opacity-100" : "opacity-0"
                                                                                    )}
                                                                                />
                                                                                {sport.display_name}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>

                                                {/* Player 1 */}
                                                {swapSport1 && (
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium text-white/80">Player</label>
                                                        <Popover open={swapPlayer1PopoverOpen} onOpenChange={setSwapPlayer1PopoverOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    aria-expanded={swapPlayer1PopoverOpen}
                                                                    className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/15"
                                                                >
                                                                    {swapPlayer1
                                                                        ? playersForSwapSport1.find(p => p.rmis_id === swapPlayer1)?.name
                                                                        : "Search and select a player..."
                                                                    }
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-full p-0">
                                                                <Command>
                                                                    <CommandInput placeholder="Search players..." />
                                                                    <CommandList>
                                                                        <CommandEmpty>No player found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {playersForSwapSport1.map((player) => (
                                                                                <CommandItem
                                                                                    key={player.rmis_id}
                                                                                    value={`${player.name} ${player.rmis_id}`}
                                                                                    onSelect={() => {
                                                                                        setSwapPlayer1(player.rmis_id);
                                                                                        setSwapPlayer1PopoverOpen(false);
                                                                                    }}
                                                                                >
                                                                                    <Check
                                                                                        className={cn(
                                                                                            "mr-2 h-4 w-4",
                                                                                            swapPlayer1 === player.rmis_id ? "opacity-100" : "opacity-0"
                                                                                        )}
                                                                                    />
                                                                                    <div className="flex items-center gap-2">
                                                                                        {player.name}
                                                                                        <Badge variant="outline" className="text-xs">
                                                                                            {player.rmis_id}
                                                                                        </Badge>
                                                                                    </div>
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Second Player Selection (Swap only) */}
                                            {swapType === 'swap' && swapPlayer1 && (
                                                <div className="p-4 border border-white/15 rounded-lg bg-white/5 space-y-4">
                                                    <h4 className="font-medium text-white/90">Second Player</h4>

                                                    {/* Sport 2 */}
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium text-white/80">Sport</label>
                                                        <Popover open={swapSport2PopoverOpen} onOpenChange={setSwapSport2PopoverOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    aria-expanded={swapSport2PopoverOpen}
                                                                    className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/15"
                                                                >
                                                                    {swapSport2
                                                                        ? availableSports.find(s => s.sport_id.toString() === swapSport2)?.display_name
                                                                        : "Search and select a sport..."
                                                                    }
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-full p-0">
                                                                <Command>
                                                                    <CommandInput placeholder="Search sports..." />
                                                                    <CommandList>
                                                                        <CommandEmpty>No sport found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {availableSports
                                                                                .filter(sport => sport.sport_id !== parseInt(swapSport1))
                                                                                .map((sport) => (
                                                                                    <CommandItem
                                                                                        key={sport.sport_id}
                                                                                        value={sport.display_name}
                                                                                        onSelect={() => {
                                                                                            setSwapSport2(sport.sport_id.toString());
                                                                                            setSwapPlayer2('');
                                                                                            setSwapSport2PopoverOpen(false);
                                                                                        }}
                                                                                    >
                                                                                        <Check
                                                                                            className={cn(
                                                                                                "mr-2 h-4 w-4",
                                                                                                swapSport2 === sport.sport_id.toString() ? "opacity-100" : "opacity-0"
                                                                                            )}
                                                                                        />
                                                                                        {sport.display_name}
                                                                                    </CommandItem>
                                                                                ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>

                                                    {/* Player 2 */}
                                                    {swapSport2 && (
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-medium text-white/80">Player</label>
                                                            <Popover open={swapPlayer2PopoverOpen} onOpenChange={setSwapPlayer2PopoverOpen}>
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        variant="outline"
                                                                        role="combobox"
                                                                        aria-expanded={swapPlayer2PopoverOpen}
                                                                        className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/15"
                                                                    >
                                                                        {swapPlayer2
                                                                            ? playersForSwapSport2.find(p => p.rmis_id === swapPlayer2)?.name
                                                                            : "Search and select a player..."
                                                                        }
                                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                    </Button>
                                                                </PopoverTrigger>
                                                                <PopoverContent className="w-full p-0">
                                                                    <Command>
                                                                        <CommandInput placeholder="Search players..." />
                                                                        <CommandList>
                                                                            <CommandEmpty>No player found.</CommandEmpty>
                                                                            <CommandGroup>
                                                                                {playersForSwapSport2
                                                                                    .filter(p => p.rmis_id !== swapPlayer1)
                                                                                    .map((player) => (
                                                                                        <CommandItem
                                                                                            key={player.rmis_id}
                                                                                            value={`${player.name} ${player.rmis_id}`}
                                                                                            onSelect={() => {
                                                                                                setSwapPlayer2(player.rmis_id);
                                                                                                setSwapPlayer2PopoverOpen(false);
                                                                                            }}
                                                                                        >
                                                                                            <Check
                                                                                                className={cn(
                                                                                                    "mr-2 h-4 w-4",
                                                                                                    swapPlayer2 === player.rmis_id ? "opacity-100" : "opacity-0"
                                                                                                )}
                                                                                            />
                                                                                            <div className="flex items-center gap-2">
                                                                                                {player.name}
                                                                                                <Badge variant="outline" className="text-xs">
                                                                                                    {player.rmis_id}
                                                                                                </Badge>
                                                                                            </div>
                                                                                        </CommandItem>
                                                                                    ))}
                                                                            </CommandGroup>
                                                                        </CommandList>
                                                                    </Command>
                                                                </PopoverContent>
                                                            </Popover>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Destination Sport (Move only) */}
                                            {swapType === 'move' && swapPlayer1 && (
                                                <div className="p-4 border border-white/15 rounded-lg bg-white/5 space-y-4">
                                                    <h4 className="font-medium text-white/90">Destination</h4>

                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium text-white/80">Move to Sport</label>
                                                        <Popover open={swapDestinationPopoverOpen} onOpenChange={setSwapDestinationPopoverOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    aria-expanded={swapDestinationPopoverOpen}
                                                                    className="w-full justify-between bg-white/10 border-white/20 text-white hover:bg-white/15"
                                                                >
                                                                    {swapDestinationSport
                                                                        ? getAvailableDestinationSports().find(s => s.sport_id.toString() === swapDestinationSport)?.display_name
                                                                        : "Search and select destination sport..."
                                                                    }
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-full p-0">
                                                                <Command>
                                                                    <CommandInput placeholder="Search sports..." />
                                                                    <CommandList>
                                                                        <CommandEmpty>No sport found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {getAvailableDestinationSports().map((sport) => (
                                                                                <CommandItem
                                                                                    key={sport.sport_id}
                                                                                    value={sport.display_name}
                                                                                    onSelect={() => {
                                                                                        setSwapDestinationSport(sport.sport_id.toString());
                                                                                        setSwapDestinationPopoverOpen(false);
                                                                                    }}
                                                                                >
                                                                                    <Check
                                                                                        className={cn(
                                                                                            "mr-2 h-4 w-4",
                                                                                            swapDestinationSport === sport.sport_id.toString() ? "opacity-100" : "opacity-0"
                                                                                        )}
                                                                                    />
                                                                                    {sport.display_name}
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Reason */}
                                            {((swapType === 'swap' && swapPlayer2) || (swapType === 'move' && swapDestinationSport)) && (
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium text-white/80">
                                                        Reason for {swapType === 'swap' ? 'Swap' : 'Move'}
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={swapReason}
                                                        onChange={(e) => setSwapReason(e.target.value)}
                                                        placeholder={`Enter reason for ${swapType}...`}
                                                        className="w-full px-3 py-2 rounded-md bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cranberry"
                                                    />
                                                </div>
                                            )}

                                            {/* Submit Button */}
                                            {((swapType === 'swap' && swapPlayer2 && swapReason.trim()) || (swapType === 'move' && swapDestinationSport && swapReason.trim())) && (
                                                <Button
                                                    onClick={handleSwapSubmit}
                                                    disabled={submittingSwap}
                                                    className="w-full bg-cranberry hover:bg-cranberry/80"
                                                >
                                                    {submittingSwap ? (
                                                        <>
                                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                            Processing...
                                                        </>
                                                    ) : swapType === 'swap' ? (
                                                        <>
                                                            <ArrowLeftRight className="h-4 w-4 mr-2" />
                                                            Execute Swap
                                                        </>
                                                    ) : (
                                                        <>
                                                            <MoveRight className="h-4 w-4 mr-2" />
                                                            Execute Move
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                )}
            </div>
        </PrivateRoute>
    );
}
