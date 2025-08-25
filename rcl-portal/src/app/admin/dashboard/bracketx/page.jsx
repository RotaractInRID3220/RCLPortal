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



  // Custom seed component with dark theme styling and edit functionality
  const CustomSeed = ({ seed, breakpoint, roundIndex, seedIndex }) => {
    const [isEditing, setIsEditing] = useState(false);
    return (
      <Seed mobileBreakpoint={breakpoint} style={{ fontSize: 14 }}>
        <SeedItem 
          style={{
            backgroundColor: seed.status === 'completed' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.08)',
            border: seed.status === 'completed' ? '1px solid rgb(34, 197, 94)' : '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '12px',
            minHeight: '100px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: isEditing ? 'default' : 'pointer',
          }}
          onClick={() => !isEditing && setIsEditing(true)}
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
                  fontSize: '14px',
                  flex: 1,
                }}
              >
                {seed.teams[0]?.name || 'TBD'}
                {seed.teams[0]?.seed && <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}> (#{seed.teams[0].seed})</span>}
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
                  fontSize: '14px',
                  flex: 1,
                }}
              >
                {seed.teams[1]?.name || 'TBD'}
                {seed.teams[1]?.seed && <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}> (#{seed.teams[1].seed})</span>}
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
            minWidth: '800px',
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


    </div>
  );
};

export default BracketXPage;
