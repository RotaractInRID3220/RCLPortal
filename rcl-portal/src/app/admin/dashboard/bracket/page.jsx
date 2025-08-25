"use client";
import React, { useState, useEffect } from "react";
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BracketXPage = () => {
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


  // Fetch bracket data when component mounts or sport changes
  useEffect(() => {
    let subscription;

    async function fetchBracketData() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch initial bracket data
        const bracketData = await BracketService.getBracketData(selectedSport);
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
          team1:teams!matches_team1_id_fkey (
            team_id,
            seed_number,
            club:clubs (
              club_id,
              club_name
            )
          ),
          team2:teams!matches_team2_id_fkey (
            team_id,
            seed_number,
            club:clubs (
              club_id,
              club_name
            )
          )
        `)
        .eq('sport_id', selectedSport);

      if (!matchesError && matchesData) {
        // Set up real-time subscription
        subscription = supabase
          .channel('matches-changes')
          .on('postgres_changes', 
            { 
              event: '*', 
              schema: 'public', 
              table: 'matches',
              filter: `sport_id=eq.${selectedSport}`
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
            team1:teams!matches_team1_id_fkey (
              team_id,
              seed_number,
              club:clubs (
                club_id,
                club_name
              )
            ),
            team2:teams!matches_team2_id_fkey (
              team_id,
              seed_number,
              club:clubs (
                club_id,
                club_name
              )
            )
          `)
          .eq('sport_id', selectedSport)
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
  }, [selectedSport, setRounds, setLoading, setError]);

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
        alert('Failed to update scores. Please try again.');
        return;
      }

      // Close dialog and reset state
      setIsScoreDialogOpen(false);
      setEditingMatch(null);
      setTempScores({ team1: 0, team2: 0 });

      // Note: Real-time subscription will automatically update the UI
    } catch (error) {
      console.error('Error saving scores:', error);
      alert('Failed to update scores. Please try again.');
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



  // Custom seed component with dark theme styling and edit functionality
  const CustomSeed = ({ seed, breakpoint, roundIndex, seedIndex }) => {
    return (
      <Seed mobileBreakpoint={breakpoint} style={{ fontSize: 12 }}>
        <SeedItem 
          style={{
            backgroundColor: seed.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.08)',
            border: seed.status === 'completed' ? '1px solid rgb(34, 197, 94)' : '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '8px',
            minHeight: '100px',
            maxWidth: '250px',
            minWidth: '200px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => handleMatchClick(seed)} // COMMENT OUT THIS LINE TO DISABLE CLICK EDITING
        >
          <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', marginBottom: '8px' }}>
            {seed.date} 
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
            <Button className="bg-cranberry/20 border border-cursor hover:bg-cranberry cursor-pointer text-white">Add Matches</Button>
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
            onClick={() => setSelectedSport(selectedSport)} // Trigger refresh
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
            Make sure there are matches created in the database for sport ID: {selectedSport}
          </div>
        </div>
      )}


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
