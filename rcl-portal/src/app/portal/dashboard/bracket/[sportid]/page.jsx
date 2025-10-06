"use client";
import React, { useEffect } from "react";
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const BracketPage = () => {
  const params = useParams();
  const [rounds, setRounds] = useAtom(bracketDataAtom);
  const [loading, setLoading] = useAtom(bracketLoadingAtom);
  const [error, setError] = useAtom(bracketErrorAtom);
  const [selectedSport, setSelectedSport] = useAtom(selectedSportAtom);

  // Set selectedSport from URL params when component mounts
  useEffect(() => {
    if (params.sportid) {
      setSelectedSport(parseInt(params.sportid));
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

  // Custom seed component with glassmorphism styling and read-only display
  const CustomSeed = ({ seed, breakpoint, roundIndex, seedIndex }) => {
    const isLineConnector = seed.teams?.length === 1 && seed.teams[0]?.name === 'CONNECTOR';
    const isTBD = seed.teams?.some(team => team?.name === 'TBD');

    if (isLineConnector) {
      return (
        <Seed mobileBreakpoint={breakpoint} style={{ fontSize: 12 }}>
          <SeedItem style={{ backgroundColor: 'transparent', border: 'none' }}>
            <div></div>
          </SeedItem>
        </Seed>
      );
    }

    // Determine winner and styling
    const hasScores = seed.score && seed.score[0] !== undefined && seed.score[1] !== undefined;
    const team1Wins = hasScores && seed.score[0] > seed.score[1];
    const team2Wins = hasScores && seed.score[1] > seed.score[0];
    const isDraw = hasScores && seed.score[0] === seed.score[1] && seed.score[0] > 0;

    return (
      <Seed mobileBreakpoint={breakpoint} style={{ fontSize: 12 }}>
        <SeedItem
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            padding: '16px',
            minHeight: '120px',
            maxWidth: '280px',
            minWidth: '240px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            cursor: 'default',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '11px',
            fontWeight: '500',
            marginBottom: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>Match {seed.id || 'TBD'}</span>
            {seed.date && (
              <span style={{ fontSize: '9px', opacity: 0.6 }}>
                {seed.date}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Team 1 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: team1Wins ? 'rgba(34, 197, 94, 0.15)' :
                               team2Wins ? 'rgba(239, 68, 68, 0.15)' :
                               isDraw ? 'rgba(251, 191, 36, 0.15)' :
                               'rgba(255, 255, 255, 0.05)',
              border: team1Wins ? '1px solid rgba(34, 197, 94, 0.3)' :
                     team2Wins ? '1px solid rgba(239, 68, 68, 0.3)' :
                     isDraw ? '1px solid rgba(251, 191, 36, 0.3)' :
                     '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: team1Wins ? '600' : '500',
                  marginBottom: '2px'
                }}>
                  {seed.teams?.[0]?.name || 'TBD'}
                </div>
                {seed.teams?.[0]?.clubs && (
                  <div style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '10px',
                    fontWeight: '400'
                  }}>
                    {seed.teams[0].clubs.club_name}
                  </div>
                )}
              </div>
              {hasScores && (
                <div style={{
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '700',
                  backgroundColor: team1Wins ? 'rgba(34, 197, 94, 0.8)' :
                                   team2Wins ? 'rgba(239, 68, 68, 0.8)' :
                                   isDraw ? 'rgba(251, 191, 36, 0.8)' :
                                   'rgba(255, 255, 255, 0.1)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  minWidth: '32px',
                  textAlign: 'center',
                  border: team1Wins ? '1px solid rgba(34, 197, 94, 0.5)' :
                         team2Wins ? '1px solid rgba(239, 68, 68, 0.5)' :
                         isDraw ? '1px solid rgba(251, 191, 36, 0.5)' :
                         '1px solid rgba(255, 255, 255, 0.2)',
                }}>
                  {seed.score[0]}
                </div>
              )}
            </div>

            {/* Team 2 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: team2Wins ? 'rgba(34, 197, 94, 0.15)' :
                               team1Wins ? 'rgba(239, 68, 68, 0.15)' :
                               isDraw ? 'rgba(251, 191, 36, 0.15)' :
                               'rgba(255, 255, 255, 0.05)',
              border: team2Wins ? '1px solid rgba(34, 197, 94, 0.3)' :
                     team1Wins ? '1px solid rgba(239, 68, 68, 0.3)' :
                     isDraw ? '1px solid rgba(251, 191, 36, 0.3)' :
                     '1px solid rgba(255, 255, 255, 0.08)',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: team2Wins ? '600' : '500',
                  marginBottom: '2px'
                }}>
                  {seed.teams?.[1]?.name || 'TBD'}
                </div>
                {seed.teams?.[1]?.clubs && (
                  <div style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '10px',
                    fontWeight: '400'
                  }}>
                    {seed.teams[1].clubs.club_name}
                  </div>
                )}
              </div>
              {hasScores && (
                <div style={{
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '700',
                  backgroundColor: team2Wins ? 'rgba(34, 197, 94, 0.8)' :
                                   team1Wins ? 'rgba(239, 68, 68, 0.8)' :
                                   isDraw ? 'rgba(251, 191, 36, 0.8)' :
                                   'rgba(255, 255, 255, 0.1)',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  minWidth: '32px',
                  textAlign: 'center',
                  border: team2Wins ? '1px solid rgba(34, 197, 94, 0.5)' :
                         team1Wins ? '1px solid rgba(239, 68, 68, 0.5)' :
                         isDraw ? '1px solid rgba(251, 191, 36, 0.5)' :
                         '1px solid rgba(255, 255, 255, 0.2)',
                }}>
                  {seed.score[1]}
                </div>
              )}
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
          }} className="overflow-x-scroll hide-scrollbar">
            <Bracket
              rounds={rounds}
              renderSeedComponent={CustomSeed}
              roundTitleComponent={CustomRoundTitle}
              mobileBreakpoint={768}
              bracketClassName="custom-bracket"
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
    </div>
  );
};

export default BracketPage;