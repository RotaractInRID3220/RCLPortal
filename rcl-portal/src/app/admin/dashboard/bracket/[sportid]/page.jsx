"use client";
import React, { useState, useEffect } from "react";
import { useParams } from 'next/navigation';
import { useAtom } from 'jotai';
import { createClient } from '@supabase/supabase-js';
import { Bracket, Seed, SeedItem, SeedTeam } from 'react-brackets';
import BracketService from '@/services/bracketServices';
import { 
  bracketDataAtom, 
  bracketLoadingAtom, 
  bracketErrorAtom, 
  selectedSportAtom 
} from '@/app/state/store';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BracketXPage = () => {
  const params = useParams();
  const [rounds, setRounds] = useAtom(bracketDataAtom);
  const [loading, setLoading] = useAtom(bracketLoadingAtom);
  const [error, setError] = useAtom(bracketErrorAtom);
  const [selectedSport, setSelectedSport] = useAtom(selectedSportAtom);
  const [tournamentStats, setTournamentStats] = useState({
    totalTeams: 0,
    matchesPlayed: 0,
    totalMatches: 0,
    currentRound: 'Loading...'
  });

  // Score editing dialog state - COMMENT OUT THIS SECTION TO DISABLE SCORE EDITING
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [tempScores, setTempScores] = useState({ team1: 0, team2: 0 });
  const [isSaving, setIsSaving] = useState(false);

  // Add Match dialog state
  const [isAddMatchDialogOpen, setIsAddMatchDialogOpen] = useState(false);
  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [team1Open, setTeam1Open] = useState(false);
  const [team2Open, setTeam2Open] = useState(false);
  const [newMatch, setNewMatch] = useState({
    team1_id: '',
    team2_id: '',
    round_id: '',
    match_order: '',
    parent_match1_id: null,
    parent_match2_id: null,
    start_time: '',
    sport_id: selectedSport
  });
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);

  // Edit Match dialog state
  const [isEditMatchDialogOpen, setIsEditMatchDialogOpen] = useState(false);
  const [editingMatchData, setEditingMatchData] = useState(null);
  const [editTeam1Open, setEditTeam1Open] = useState(false);
  const [editTeam2Open, setEditTeam2Open] = useState(false);
  const [isUpdatingMatch, setIsUpdatingMatch] = useState(false);

  // Delete Match confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingMatch, setDeletingMatch] = useState(null);
  const [isDeletingMatch, setIsDeletingMatch] = useState(false);

  // Set selectedSport from URL params when component mounts
  useEffect(() => {
    if (params.sportid) {
      setSelectedSport(parseInt(params.sportid));
      // Update newMatch sport_id when selectedSport changes
      setNewMatch(prev => ({ ...prev, sport_id: parseInt(params.sportid) }));
    }
  }, [params.sportid, setSelectedSport]);


  // Fetch bracket data when component mounts or sport changes
  useEffect(() => {
    if (!params.sportid) return; // Don't run if no sportid in URL
    
    const currentSportId = parseInt(params.sportid);
    let subscription;

    async function fetchBracketData() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch initial bracket data using URL params directly
        const bracketData = await BracketService.getBracketData(currentSportId);
        setRounds(bracketData);
        
        // Calculate tournament statistics
        const stats = BracketService.calculateTournamentStats(bracketData);
        setTournamentStats(stats);
      } catch (error) {
        console.error('Error fetching bracket data:', error);
        setError(error.message);
        setRounds([]);
      } finally {
        setLoading(false);
      }
    }

    async function setupRealTimeSubscription() {
      // Fetch matches data first to get the current structure
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          match_id,
          team1_id,
          team2_id,
          team1_score,
          team2_score,
          round_id,
          match_order,
          parent_match1_id,
          parent_match2_id,
          sport_id,
          start_time,
          team1:teams!matches_team1_id_fkey (
            team_id,
            club:clubs (
              club_id,
              club_name
            )
          ),
          team2:teams!matches_team2_id_fkey (
            team_id,
            club:clubs (
              club_id,
              club_name
            )
          )
        `)
        .eq('sport_id', currentSportId);

      if (!matchesError && matchesData) {
        // Set up real-time subscription
        subscription = supabase
          .channel('matches-changes')
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'matches',
              filter: `sport_id=eq.${currentSportId}`
            },
            (payload) => {
              console.log('Real-time match update:', payload);
              
              // Re-fetch and transform the data when matches change
              fetchUpdatedBracketData();
            }
          )
          .subscribe();
      }
    }

    async function fetchUpdatedBracketData() {
      try {
        // Fetch updated matches data
        const { data: updatedMatchesData, error: updatedMatchesError } = await supabase
          .from('matches')
          .select(`
            match_id,
            team1_id,
            team2_id,
            team1_score,
            team2_score,
            round_id,
            match_order,
            parent_match1_id,
            parent_match2_id,
            sport_id,
            start_time,
            team1:teams!matches_team1_id_fkey (
              team_id,
              club:clubs (
                club_id,
                club_name
              )
            ),
            team2:teams!matches_team2_id_fkey (
              team_id,
              club:clubs (
                club_id,
                club_name
              )
            )
          `)
          .eq('sport_id', currentSportId)
          .order('round_id', { ascending: false })
          .order('match_order', { ascending: true });

        if (!updatedMatchesError && updatedMatchesData) {
          // Transform the updated data
          const transformedData = BracketService.transformToBracketFormat(updatedMatchesData);
          setRounds(transformedData);
          
          // Update tournament statistics
          const stats = BracketService.calculateTournamentStats(transformedData);
          setTournamentStats(stats);
        }
      } catch (error) {
        console.error('Error fetching updated bracket data:', error);
      }
    }

    // Initialize data and subscription
    fetchBracketData();
    setupRealTimeSubscription();

    // Cleanup subscription on unmount or sport change
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [params.sportid, setRounds, setLoading, setError]);

  // SCORE EDITING FUNCTIONS - COMMENT OUT THIS ENTIRE SECTION TO DISABLE SCORE EDITING
  const handleMatchClick = (seed) => {
    // Only allow editing if match has both teams
    if (!seed.teams[0]?.name || !seed.teams[1]?.name || seed.teams[0]?.name === 'TBD' || seed.teams[1]?.name === 'TBD') {
      return;
    }

    setEditingMatch(seed);
    setTempScores({
      team1: seed.score?.[0] || 0,
      team2: seed.score?.[1] || 0
    });
    setIsScoreDialogOpen(true);
  };

  const handleSaveScores = async () => {
    if (!editingMatch || !editingMatch.id) return;

    setIsSaving(true);
    try {
      // Update scores in database
      const { error } = await supabase
        .from('matches')
        .update({
          team1_score: tempScores.team1,
          team2_score: tempScores.team2
        })
        .eq('match_id', editingMatch.id);

      if (error) {
        console.error('Error updating scores:', error);
        toast.error('Failed to update scores. Please try again.');
        return;
      }

      // Check if match is completed and advance winner to parent matches
      const team1Score = tempScores.team1;
      const team2Score = tempScores.team2;
      
      if (team1Score > 0 && team2Score > 0 && team1Score !== team2Score) {
        const winnerId = team1Score > team2Score ? editingMatch.teams[0]?.id : editingMatch.teams[1]?.id;
        const winnerName = team1Score > team2Score ? editingMatch.teams[0]?.name : editingMatch.teams[1]?.name;
        
        if (winnerId && winnerName !== 'TBD') {
          try {
            // Find parent matches that reference this match
            const { data: parentMatches, error: parentError } = await supabase
              .from('matches')
              .select('match_id, parent_match1_id, parent_match2_id, team1_id, team2_id')
              .or(`parent_match1_id.eq.${editingMatch.id},parent_match2_id.eq.${editingMatch.id}`)
              .eq('sport_id', parseInt(params.sportid));

            if (!parentError && parentMatches) {
              for (const parentMatch of parentMatches) {
                let updateData = {};
                
                if (parentMatch.parent_match1_id === editingMatch.id) {
                  // This match feeds into team1 position of parent match
                  updateData.team1_id = winnerId;
                } else if (parentMatch.parent_match2_id === editingMatch.id) {
                  // This match feeds into team2 position of parent match
                  updateData.team2_id = winnerId;
                }

                if (Object.keys(updateData).length > 0) {
                  const { error: updateError } = await supabase
                    .from('matches')
                    .update(updateData)
                    .eq('match_id', parentMatch.match_id);

                  if (updateError) {
                    console.error('Error advancing winner to parent match:', updateError);
                  } else {
                    console.log(`Advanced winner (Team ID: ${winnerId}) to parent match ${parentMatch.match_id}`);
                  }
                }
              }
            }
          } catch (advanceError) {
            console.error('Error in winner advancement logic:', advanceError);
            // Don't show error toast for advancement failures to avoid confusing users
          }
        }
      }

      toast.success('Scores updated successfully!');

      // Close dialog and reset state
      setIsScoreDialogOpen(false);
      setEditingMatch(null);
      setTempScores({ team1: 0, team2: 0 });

      // Note: Real-time subscription will automatically update the UI
    } catch (error) {
      console.error('Error saving scores:', error);
      toast.error('Failed to update scores. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleScoreChange = (team, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setTempScores(prev => ({
      ...prev,
      [team]: numValue
    }));
  };
  // END OF SCORE EDITING FUNCTIONS

  // ADD MATCH FUNCTIONS
  const fetchTeams = async () => {
    if (!params.sportid) return;
    
    const currentSportId = parseInt(params.sportid);
    setLoadingTeams(true);
    try {
      const response = await fetch(`/api/teams?sport_id=${currentSportId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }
      const data = await response.json();
      setTeams(data.teams || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams. Please try again.');
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleAddMatchClick = () => {
    const currentSportId = parseInt(params.sportid);
    setNewMatch({
      team1_id: '',
      team2_id: '',
      round_id: '',
      match_order: '',
      parent_match1_id: null,
      parent_match2_id: null,
      start_time: '',
      sport_id: currentSportId
    });
    fetchTeams();
    setIsAddMatchDialogOpen(true);
  };

  const handleCreateMatch = async () => {
    // Validate required fields
    if (newMatch.team1_id === '' || newMatch.team2_id === '' || !newMatch.round_id || !newMatch.match_order) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Allow both teams to be TBD (null)
    if (newMatch.team1_id === newMatch.team2_id && newMatch.team1_id !== null) {
      toast.error('Please select different teams');
      return;
    }

    setIsCreatingMatch(true);
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newMatch,
          team1_score: 0,
          team2_score: 0,
          start_time: newMatch.start_time || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create match');
      }

      toast.success('Match created successfully!');

      // Close dialog and reset
      setIsAddMatchDialogOpen(false);
      setNewMatch({
        team1_id: '',
        team2_id: '',
        round_id: '',
        match_order: '',
        parent_match1_id: null,
        parent_match2_id: null,
        start_time: '',
        sport_id: parseInt(params.sportid)
      });

      // Refresh bracket data
      const currentSportId = parseInt(params.sportid);
      const bracketData = await BracketService.getBracketData(currentSportId);
      setRounds(bracketData);
      
      // Update tournament statistics
      const stats = BracketService.calculateTournamentStats(bracketData);
      setTournamentStats(stats);

    } catch (error) {
      console.error('Error creating match:', error);
      toast.error('Failed to create match. Please try again.');
    } finally {
      setIsCreatingMatch(false);
    }
  };

  const isFormValid = () => {
    return (newMatch.team1_id !== '' && newMatch.team1_id !== undefined) && 
           (newMatch.team2_id !== '' && newMatch.team2_id !== undefined) && 
           newMatch.round_id && 
           newMatch.match_order;
  };
  // END OF ADD MATCH FUNCTIONS

  // EDIT MATCH FUNCTIONS
  const handleEditMatchClick = (seed) => {
    setEditingMatchData({
      match_id: seed.id,
      team1_id: seed.teams[0]?.id || null,
      team2_id: seed.teams[1]?.id || null,
      round_id: seed.round_id,
      match_order: seed.match_order,
      parent_match1_id: seed.parent_match1_id || null,
      parent_match2_id: seed.parent_match2_id || null,
      start_time: seed.date !== 'TBD' ? seed.date : '',
      sport_id: parseInt(params.sportid)
    });
    fetchTeams();
    setIsEditMatchDialogOpen(true);
  };

  const handleUpdateMatch = async () => {
    if (!editingMatchData) return;

    // Validate required fields
    if (editingMatchData.team1_id === '' || editingMatchData.team2_id === '') {
      toast.error('Please fill in all required fields');
      return;
    }

    if (editingMatchData.team1_id === editingMatchData.team2_id) {
      toast.error('Please select different teams');
      return;
    }

    setIsUpdatingMatch(true);
    try {
      const response = await fetch('/api/games', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingMatchData),
      });

      if (!response.ok) {
        throw new Error('Failed to update match');
      }

      toast.success('Match updated successfully!');

      // Close dialog and reset
      setIsEditMatchDialogOpen(false);
      setEditingMatchData(null);

      // Refresh bracket data
      const currentSportId = parseInt(params.sportid);
      const bracketData = await BracketService.getBracketData(currentSportId);
      setRounds(bracketData);
      
      // Update tournament statistics
      const stats = BracketService.calculateTournamentStats(bracketData);
      setTournamentStats(stats);

    } catch (error) {
      console.error('Error updating match:', error);
      toast.error('Failed to update match. Please try again.');
    } finally {
      setIsUpdatingMatch(false);
    }
  };

  // DELETE MATCH FUNCTIONS
  const handleDeleteMatchClick = (seed) => {
    setDeletingMatch(seed);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingMatch) return;

    setIsDeletingMatch(true);
    try {
      const response = await fetch(`/api/games?match_id=${deletingMatch.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete match');
      }

      toast.success('Match deleted successfully!');

      // Close dialog and reset
      setIsDeleteDialogOpen(false);
      setDeletingMatch(null);

      // Refresh bracket data
      const currentSportId = parseInt(params.sportid);
      const bracketData = await BracketService.getBracketData(currentSportId);
      setRounds(bracketData);
      
      // Update tournament statistics
      const stats = BracketService.calculateTournamentStats(bracketData);
      setTournamentStats(stats);

    } catch (error) {
      console.error('Error deleting match:', error);
      toast.error('Failed to delete match. Please try again.');
    } finally {
      setIsDeletingMatch(false);
    }
  };

  // Custom seed component with dark theme styling and edit functionality
  const CustomSeed = ({ seed, breakpoint, roundIndex, seedIndex }) => {
    const handleEditClick = (e) => {
      e.stopPropagation();
      handleEditMatchClick(seed);
    };

    const handleDeleteClick = (e) => {
      e.stopPropagation();
      handleDeleteMatchClick(seed);
    };

    return (
      <Seed mobileBreakpoint={breakpoint} style={{ fontSize: 12 }}>
        <SeedItem 
          style={{
            backgroundColor: seed.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.08)',
            border: seed.status === 'completed' ? '1px solid rgb(34, 197, 94)' : '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '8px',
            paddingTop: '32px', // Add top padding for buttons
            minHeight: '100px',
            maxWidth: '250px',
            minWidth: '200px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
            position: 'relative',
          }}
          onClick={() => handleMatchClick(seed)} // COMMENT OUT THIS LINE TO DISABLE CLICK EDITING
        >
          {/* Action buttons */}
          <div style={{ 
            position: 'absolute', 
            top: '4px', 
            right: '4px', 
            display: 'flex', 
            gap: '4px',
            opacity: 0.7,
            zIndex: 10
          }}>
            <button
              onClick={handleEditClick}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px',
                cursor: 'pointer',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
            >
              <Edit size={12} />
            </button>
            <button
              onClick={handleDeleteClick}
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px',
                cursor: 'pointer',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
            >
              <Trash2 size={12} />
            </button>
          </div>

          <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{seed.matchId ? `#${seed.matchId}` : 'Match'}</span>
            <span style={{ fontSize: '10px' }}>{seed.date}</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SeedTeam 
                style={{ 
                  color: '#ffffff', 
                  fontWeight: '500',
                  fontSize: '12px',
                  flex: 1,
                }}
              >
                {seed.teams[0]?.name || 'TBD'}
                {/* {seed.teams[0]?.seed && <span style={{ color: 'rgba(255, 255, 255, 0.5)' }} className="text-sm font-light"> ({seed.teams[0].seed})</span>} */}
              </SeedTeam>

                <div style={{ 
                  color: '#ffffff', 
                  fontWeight: 'bold',
                  backgroundColor: 
                    (seed.score[0] === 0 && seed.score[1] === 0) ? 'rgba(255, 255, 255, 0.1)' :
                    (seed.score[0] > seed.score[1]) ? 'rgb(34, 197, 94)' :
                    (seed.score[0] < seed.score[1]) ? 'rgb(239, 68, 68)' :
                    'rgba(255, 255, 255, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  minWidth: '24px',
                  textAlign: 'center'
                }}>
                  {seed.score?.[0] || 0}
                </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <SeedTeam 
                style={{ 
                  color: '#ffffff', 
                  fontWeight: '500',
                  fontSize: '12px',
                  flex: 1,
                }}
              >
                {seed.teams[1]?.name || 'TBD'}
                {/* {seed.teams[1]?.seed && <span style={{ color: 'rgba(255, 255, 255, 0.5)' }} className="text-sm font-light"> ({seed.teams[1].seed})</span>} */}
              </SeedTeam>

                <div style={{ 
                  color: '#ffffff', 
                  fontWeight: 'bold',
                  backgroundColor: 
                    (seed.score[0] === 0 && seed.score[1] === 0) ? 'rgba(255, 255, 255, 0.1)' :
                    (seed.score[1] > seed.score[0]) ? 'rgb(34, 197, 94)' :
                    (seed.score[1] < seed.score[0]) ? 'rgb(239, 68, 68)' :
                    'rgba(255, 255, 255, 0.1)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  minWidth: '24px',
                  textAlign: 'center'
                }}>
                  {seed.score?.[1] || 0}
                </div>

            </div>
    
          </div>
        </SeedItem>
      </Seed>
    );
  };

  // Custom round title component with dark theme
  const CustomRoundTitle = (title, roundIndex) => {
    return (
      <div style={{ 
        textAlign: 'center', 
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: '600',
        marginBottom: '12px',
        padding: '6px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '6px',
        maxWidth: '160px',
        margin: '0 auto 12px auto',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {title}
      </div>
    );
  };

  return (
    <div className="min-h-screen">
        <div className="flex w-full justify-between items-center mb-8">
            <h1 className="text-3xl font-semibold tracking-wide">Event Brackets</h1>
            <Button 
              onClick={handleAddMatchClick}
              className="bg-cranberry/20 border border-cursor hover:bg-cranberry cursor-pointer text-white"
            >
              Add Matches
            </Button>
        </div>


      
      {/* Loading State */}
      {loading && (
        <div className="bg-white/5 rounded-lg p-8 text-center">
          <div className="text-white text-lg">Loading tournament bracket...</div>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
          <div className="text-red-400 font-semibold">Error loading bracket data:</div>
          <div className="text-red-300 mt-1">{error}</div>
          <button
            onClick={() => window.location.reload()} // Trigger page refresh
            className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Bracket Display */}
      {!loading && !error && rounds.length > 0 && (
        <div className="bg-white/5 rounded-lg p-8 overflow-x-auto bracket-scroll">

          
          <div style={{ 
            minWidth: '600px',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '12px',
            padding: '20px',
          }}>
            <Bracket 
              rounds={rounds}
              renderSeedComponent={CustomSeed}
              roundTitleComponent={CustomRoundTitle}
              mobileBreakpoint={768}
              bracketClassName="custom-bracket"
            //   roundClassName="custom-round"
            />
          </div>
        </div>
      )}

      {/* No Data State */}
      {!loading && !error && rounds.length === 0 && (
        <div className="bg-white/5 rounded-lg p-8 text-center">
          <div className="text-gray-400 text-lg">No bracket data found for this sport</div>
          <div className="text-gray-500 mt-2">
            Make sure there are matches created in the database for sport ID: {params.sportid}
          </div>
        </div>
      )}

      {/* ADD MATCH DIALOG */}
      <Dialog open={isAddMatchDialogOpen} onOpenChange={setIsAddMatchDialogOpen}>
        <DialogContent className="bg-black/80 border-cranberry/40 backdrop-blur text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Add New Match</DialogTitle>
            <DialogDescription className="text-gray-300">
              Create a new match for this tournament
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Team 1 Selection */}
            <div className="space-y-2">
              <Label className="text-white font-medium">Team 1</Label>
              <Popover open={team1Open} onOpenChange={setTeam1Open}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={team1Open}
                    className="w-full justify-between bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                    disabled={loadingTeams}
                  >
                    {newMatch.team1_id !== ''
                      ? newMatch.team1_id === null 
                        ? "TBD"
                        : teams.find((team) => team.team_id.toString() === newMatch.team1_id)?.clubs?.club_name
                      : "Select team..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 bg-gray-800 border-gray-600">
                  <Command className="bg-gray-800">
                    <CommandInput 
                      placeholder="Search teams..." 
                      className="text-white"
                    />
                    <CommandEmpty className="text-gray-400">No team found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      <CommandItem
                        key="tbd-team1"
                        value="TBD"
                        onSelect={() => {
                          setNewMatch(prev => ({ ...prev, team1_id: null }));
                          setTeam1Open(false);
                        }}
                        className="text-white hover:bg-gray-700 cursor-pointer"
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            newMatch.team1_id === null ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        TBD
                      </CommandItem>
                      {teams.map((team) => (
                        <CommandItem
                          key={team.team_id}
                          value={team.clubs?.club_name}
                          onSelect={() => {
                            setNewMatch(prev => ({ ...prev, team1_id: team.team_id.toString() }));
                            setTeam1Open(false);
                          }}
                          className="text-white hover:bg-gray-700 cursor-pointer"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              newMatch.team1_id === team.team_id.toString() ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {team.clubs?.club_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Team 2 Selection */}
            <div className="space-y-2">
              <Label className="text-white font-medium">Team 2</Label>
              <Popover open={team2Open} onOpenChange={setTeam2Open}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={team2Open}
                    className="w-full justify-between bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                    disabled={loadingTeams}
                  >
                    {newMatch.team2_id !== ''
                      ? newMatch.team2_id === null 
                        ? "TBD"
                        : teams.find((team) => team.team_id.toString() === newMatch.team2_id)?.clubs?.club_name
                      : "Select team..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 bg-gray-800 border-gray-600">
                  <Command className="bg-gray-800">
                    <CommandInput 
                      placeholder="Search teams..." 
                      className="text-white"
                    />
                    <CommandEmpty className="text-gray-400">No team found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      <CommandItem
                        key="tbd-team2"
                        value="TBD"
                        onSelect={() => {
                          setNewMatch(prev => ({ ...prev, team2_id: null }));
                          setTeam2Open(false);
                        }}
                        className="text-white hover:bg-gray-700 cursor-pointer"
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            newMatch.team2_id === null ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        TBD
                      </CommandItem>
                      {teams.map((team) => (
                        <CommandItem
                          key={team.team_id}
                          value={team.clubs?.club_name}
                          onSelect={() => {
                            setNewMatch(prev => ({ ...prev, team2_id: team.team_id.toString() }));
                            setTeam2Open(false);
                          }}
                          className="text-white hover:bg-gray-700 cursor-pointer"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              newMatch.team2_id === team.team_id.toString() ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {team.clubs?.club_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Round Selection */}
            <div className="space-y-2">
              <Label className="text-white font-medium">Round</Label>
              <Select 
                value={newMatch.round_id} 
                onValueChange={(value) => setNewMatch(prev => ({ ...prev, round_id: value }))}
              >
                <SelectTrigger className="bg-gray-800 border-gray-600 text-white focus:border-cranberry focus:ring-cranberry">
                  <SelectValue placeholder="Select round" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  <SelectItem value="0" className="text-white hover:bg-gray-700">1st Round</SelectItem>
                  <SelectItem value="1" className="text-white hover:bg-gray-700">2nd Round</SelectItem>
                  <SelectItem value="2" className="text-white hover:bg-gray-700">Quarter Finals</SelectItem>
                  <SelectItem value="3" className="text-white hover:bg-gray-700">Semi Finals</SelectItem>
                  <SelectItem value="4" className="text-white hover:bg-gray-700">Consolation Finals</SelectItem>
                  <SelectItem value="5" className="text-white hover:bg-gray-700">Finals</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Match Order */}
            <div className="space-y-2">
              <Label className="text-white font-medium">Match Order</Label>
              <Input
                type="number"
                min="1"
                value={newMatch.match_order}
                onChange={(e) => setNewMatch(prev => ({ ...prev, match_order: e.target.value }))}
                className="bg-gray-800 border-gray-600 text-white focus:border-cranberry focus:ring-cranberry"
                placeholder="Enter match order (1, 2, 3...)"
              />
            </div>

            {/* Start Time */}
            <div className="space-y-2">
              <Label className="text-white font-medium">Start Time (Optional)</Label>
              <Input
                type="datetime-local"
                value={newMatch.start_time}
                onChange={(e) => setNewMatch(prev => ({ ...prev, start_time: e.target.value }))}
                className="bg-gray-800 border-gray-600 text-white focus:border-cranberry focus:ring-cranberry [color-scheme:dark]"
                placeholder="Select match start time"
              />
              <div className="text-xs text-gray-400">
                Leave empty if time is not yet determined
              </div>
            </div>

            {/* Parent Match IDs (Optional) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white font-medium text-sm">Parent Match 1 ID</Label>
                <Input
                  type="number"
                  value={newMatch.parent_match1_id || ''}
                  onChange={(e) => setNewMatch(prev => ({ 
                    ...prev, 
                    parent_match1_id: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                  className="bg-gray-800 border-gray-600 text-white focus:border-cranberry focus:ring-cranberry text-sm"
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white font-medium text-sm">Parent Match 2 ID</Label>
                <Input
                  type="number"
                  value={newMatch.parent_match2_id || ''}
                  onChange={(e) => setNewMatch(prev => ({ 
                    ...prev, 
                    parent_match2_id: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                  className="bg-gray-800 border-gray-600 text-white focus:border-cranberry focus:ring-cranberry text-sm"
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Validation Messages */}
            {newMatch.team1_id !== '' && newMatch.team2_id !== '' && newMatch.team1_id === newMatch.team2_id && newMatch.team1_id !== null && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="text-red-400 text-sm">Please select different teams for Team 1 and Team 2</div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAddMatchDialogOpen(false)}
              className="border-gray-600 text-white hover:bg-gray-800 cursor-pointer"
              disabled={isCreatingMatch}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateMatch}
              disabled={!isFormValid() || isCreatingMatch}
              className="bg-cranberry/20 hover:bg-cranberry border cursor-pointer border-cranberry text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingMatch ? 'Creating...' : 'Create Match'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT MATCH DIALOG */}
      <Dialog open={isEditMatchDialogOpen} onOpenChange={setIsEditMatchDialogOpen}>
        <DialogContent className="bg-black/80 border-cranberry/40 backdrop-blur text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Match</DialogTitle>
            <DialogDescription className="text-gray-300">
              Update match details and teams
            </DialogDescription>
          </DialogHeader>
          
          {editingMatchData && (
            <div className="space-y-6 py-4">
              {/* Team 1 Selection */}
              <div className="space-y-2">
                <Label className="text-white font-medium">Team 1</Label>
                <Popover open={editTeam1Open} onOpenChange={setEditTeam1Open}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={editTeam1Open}
                      className="w-full justify-between bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                      disabled={loadingTeams}
                    >
                      {editingMatchData.team1_id
                        ? editingMatchData.team1_id === null 
                          ? "TBD"
                          : teams.find((team) => team.team_id.toString() === editingMatchData.team1_id)?.clubs?.club_name
                        : "Select team..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-gray-800 border-gray-600">
                    <Command className="bg-gray-800">
                      <CommandInput 
                        placeholder="Search teams..." 
                        className="text-white"
                      />
                      <CommandEmpty className="text-gray-400">No team found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        <CommandItem
                          key="edit-tbd-team1"
                          value="TBD"
                          onSelect={() => {
                            setEditingMatchData(prev => ({ ...prev, team1_id: null }));
                            setEditTeam1Open(false);
                          }}
                          className="text-white hover:bg-gray-700 cursor-pointer"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              editingMatchData.team1_id === null ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          TBD
                        </CommandItem>
                        {teams.map((team) => (
                          <CommandItem
                            key={team.team_id}
                            value={team.clubs?.club_name}
                            onSelect={() => {
                              setEditingMatchData(prev => ({ ...prev, team1_id: team.team_id.toString() }));
                              setEditTeam1Open(false);
                            }}
                            className="text-white hover:bg-gray-700 cursor-pointer"
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                editingMatchData.team1_id === team.team_id.toString() ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {team.clubs?.club_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Team 2 Selection */}
              <div className="space-y-2">
                <Label className="text-white font-medium">Team 2</Label>
                <Popover open={editTeam2Open} onOpenChange={setEditTeam2Open}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={editTeam2Open}
                      className="w-full justify-between bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
                      disabled={loadingTeams}
                    >
                      {editingMatchData.team2_id
                        ? editingMatchData.team2_id === null 
                          ? "TBD"
                          : teams.find((team) => team.team_id.toString() === editingMatchData.team2_id)?.clubs?.club_name
                        : "Select team..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 bg-gray-800 border-gray-600">
                    <Command className="bg-gray-800">
                      <CommandInput 
                        placeholder="Search teams..." 
                        className="text-white"
                      />
                      <CommandEmpty className="text-gray-400">No team found.</CommandEmpty>
                      <CommandGroup className="max-h-64 overflow-auto">
                        <CommandItem
                          key="edit-tbd-team2"
                          value="TBD"
                          onSelect={() => {
                            setEditingMatchData(prev => ({ ...prev, team2_id: null }));
                            setEditTeam2Open(false);
                          }}
                          className="text-white hover:bg-gray-700 cursor-pointer"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              editingMatchData.team2_id === null ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          TBD
                        </CommandItem>
                        {teams.map((team) => (
                          <CommandItem
                            key={team.team_id}
                            value={team.clubs?.club_name}
                            onSelect={() => {
                              setEditingMatchData(prev => ({ ...prev, team2_id: team.team_id.toString() }));
                              setEditTeam2Open(false);
                            }}
                            className="text-white hover:bg-gray-700 cursor-pointer"
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                editingMatchData.team2_id === team.team_id.toString() ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {team.clubs?.club_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Round Selection */}
              <div className="space-y-2">
                <Label className="text-white font-medium">Round</Label>
                <Select 
                  value={editingMatchData.round_id?.toString()} 
                  onValueChange={(value) => setEditingMatchData(prev => ({ ...prev, round_id: value }))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-600 text-white focus:border-cranberry focus:ring-cranberry">
                    <SelectValue placeholder="Select round" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="0" className="text-white hover:bg-gray-700">1st Round</SelectItem>
                    <SelectItem value="1" className="text-white hover:bg-gray-700">2nd Round</SelectItem>
                    <SelectItem value="2" className="text-white hover:bg-gray-700">Quarter Finals</SelectItem>
                    <SelectItem value="3" className="text-white hover:bg-gray-700">Semi Finals</SelectItem>
                    <SelectItem value="4" className="text-white hover:bg-gray-700">Consolation Finals</SelectItem>
                    <SelectItem value="5" className="text-white hover:bg-gray-700">Finals</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Match Order */}
              <div className="space-y-2">
                <Label className="text-white font-medium">Match Order</Label>
                <Input
                  type="number"
                  min="1"
                  value={editingMatchData.match_order}
                  onChange={(e) => setEditingMatchData(prev => ({ ...prev, match_order: parseInt(e.target.value) || '' }))}
                  className="bg-gray-800 border-gray-600 text-white focus:border-cranberry focus:ring-cranberry"
                  placeholder="Enter match order (1, 2, 3...)"
                />
              </div>

              {/* Start Time */}
              <div className="space-y-2">
                <Label className="text-white font-medium">Start Time (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={editingMatchData.start_time}
                  onChange={(e) => setEditingMatchData(prev => ({ ...prev, start_time: e.target.value }))}
                  className="bg-gray-800 border-gray-600 text-white focus:border-cranberry focus:ring-cranberry [color-scheme:dark]"
                  placeholder="Select match start time"
                />
                <div className="text-xs text-gray-400">
                  Leave empty if time is not yet determined
                </div>
              </div>

              {/* Validation Messages */}
              {editingMatchData.team1_id !== '' && editingMatchData.team2_id !== '' && editingMatchData.team1_id === editingMatchData.team2_id && editingMatchData.team1_id !== null && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  <div className="text-red-400 text-sm">Please select different teams for Team 1 and Team 2</div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditMatchDialogOpen(false)}
              className="border-gray-600 text-white hover:bg-gray-800 cursor-pointer"
              disabled={isUpdatingMatch}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateMatch}
              disabled={isUpdatingMatch || !editingMatchData || editingMatchData.team1_id === '' || editingMatchData.team2_id === ''}
              className="bg-cranberry/20 hover:bg-cranberry border cursor-pointer border-cranberry text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpdatingMatch ? 'Updating...' : 'Update Match'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE MATCH CONFIRMATION DIALOG */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="bg-black/80 border-red-500/40 backdrop-blur text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Match</DialogTitle>
            <DialogDescription className="text-gray-300">
              Are you sure you want to delete this match? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {deletingMatch && (
            <div className="py-4">
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="text-sm text-gray-300">
                  <div className="font-medium mb-2">Match #{deletingMatch.id}</div>
                  <div className="space-y-1">
                    <div>Team 1: {deletingMatch.teams[0]?.name || 'TBD'}</div>
                    <div>Team 2: {deletingMatch.teams[1]?.name || 'TBD'}</div>
                    <div>Round: {deletingMatch.roundTitle || 'Unknown'}</div>
                    {deletingMatch.date && deletingMatch.date !== 'TBD' && (
                      <div>Date: {deletingMatch.date}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="border-gray-600 text-white hover:bg-gray-800 cursor-pointer"
              disabled={isDeletingMatch}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDelete}
              disabled={isDeletingMatch}
              className="bg-red-600/20 hover:bg-red-600 border cursor-pointer border-red-600 text-red-400 hover:text-white"
            >
              {isDeletingMatch ? 'Deleting...' : 'Delete Match'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SCORE EDITING DIALOG - COMMENT OUT THIS ENTIRE SECTION TO DISABLE SCORE EDITING */}
      <Dialog open={isScoreDialogOpen} onOpenChange={setIsScoreDialogOpen}>
        <DialogContent className="bg-black/80 border-cranberry/40 backdrop-blur text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Update Match Scores</DialogTitle>
            <DialogDescription className="text-gray-300">
              {editingMatch?.date && (
                <span className="text-sm text-gray-400">Match Date: {editingMatch.date}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {editingMatch && (
            <div className="space-y-6 py-4">
              {/* Team 1 Score */}
              <div className="space-y-2">
                <Label className="text-white font-medium">
                  {editingMatch.teams[0]?.name || 'Team 1'}
                </Label>
                <Input
                  min="0"
                  value={tempScores.team1}
                  onChange={(e) => handleScoreChange('team1', e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white focus:border-cranberry focus:ring-cranberry"
                  placeholder="Enter score"
                />
              </div>

              {/* Team 2 Score */}
              <div className="space-y-2">
                <Label className="text-white font-medium">
                  {editingMatch.teams[1]?.name || 'Team 2'}
                </Label>
                <Input
                  min="0"
                  value={tempScores.team2}
                  onChange={(e) => handleScoreChange('team2', e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white focus:border-cranberry focus:ring-cranberry"
                  placeholder="Enter score"
                />
              </div>

              {/* Score Preview */}
              <div className="bg-white/10 rounded-lg p-4 border border-gray-700">
                <div className="text-center text-gray-300 text-sm mb-2">Score Preview</div>
                <div className="flex justify-between items-center">
                  <span className="text-white">{editingMatch.teams[0]?.name}</span>
                  <span className="text-2xl font-bold text-white">
                    {tempScores.team1} - {tempScores.team2}
                  </span>
                  <span className="text-white">{editingMatch.teams[1]?.name}</span>
                </div>
                {tempScores.team1 !== tempScores.team2 && tempScores.team1 > 0 && tempScores.team2 > 0 && (
                  <div className="text-center mt-2 text-sm">
                    {tempScores.team1 > tempScores.team2 ? (
                      <span className="text-green-400">🏆 {editingMatch.teams[0]?.name} Wins</span>
                    ) : (
                      <span className="text-green-400">🏆 {editingMatch.teams[1]?.name} Wins</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsScoreDialogOpen(false)}
              className="border-gray-600 text-white hover:bg-gray-800 cursor-pointer"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveScores}
              disabled={isSaving}
              className="bg-cranberry/20 hover:bg-cranberry border cursor-pointer border-cranberry text-white"
            >
              {isSaving ? 'Saving...' : 'Save Scores'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* END OF SCORE EDITING DIALOG */}


    </div>
  );
};

export default BracketXPage;
