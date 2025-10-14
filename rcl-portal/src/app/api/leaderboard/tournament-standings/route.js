import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { APP_CONFIG } from '@/config/app.config';

// GET /api/leaderboard/tournament-standings?sportId={sportId}
// Calculates tournament standings based on match results
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sportId = searchParams.get('sportId');

    if (!sportId) {
      return NextResponse.json(
        { error: 'Sport ID is required' },
        { status: 400 }
      );
    }

    // Fetch all matches for this sport using supabase directly
    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select(`
        match_id,
        round_id,
        team1_score,
        team2_score,
        team1:team1_id (
          team_id,
          club:club_id (
            club_id,
            club_name
          )
        ),
        team2:team2_id (
          team_id,
          club:club_id (
            club_id,
            club_name
          )
        )
      `)
      .eq('sport_id', sportId);

    if (matchesError) {
      console.error('Error fetching match data:', matchesError);
      return NextResponse.json(
        { error: 'Failed to fetch match data' },
        { status: 500 }
      );
    }

    if (!matchesData || matchesData.length === 0) {
      return NextResponse.json({ standings: [] });
    }

    // Extract matches with proper structure
    const allMatches = matchesData.map(match => ({
      match_id: match.match_id,
      round_id: match.round_id,
      team1: {
        id: match.team1?.team_id,
        club_id: match.team1?.club?.club_id,
        club_name: match.team1?.club?.club_name,
        score: parseInt(match.team1_score) || 0
      },
      team2: {
        id: match.team2?.team_id,
        club_id: match.team2?.club?.club_id,
        club_name: match.team2?.club?.club_name,
        score: parseInt(match.team2_score) || 0
      }
    }));

    if (allMatches.length === 0) {
      return NextResponse.json({ standings: [] });
    }

    // Find finals match (round_id = 5)
    const finalsMatch = allMatches.find(m => m.round_id === 5);

    // Find consolation finals match (round_id = 4)
    const consolationFinalsMatch = allMatches.find(m => m.round_id === 4);

    // Find semi-finals matches (round_id = 3)
    const semiFinalsMatches = allMatches.filter(m => m.round_id === 3);

    const calculatedStandings = [];

    // 1st Place - Finals Winner
    if (finalsMatch && finalsMatch.team1 && finalsMatch.team2) {
      const team1Score = finalsMatch.team1.score;
      const team2Score = finalsMatch.team2.score;

      // Only calculate if match has been played (scores are not both 0)
      if (team1Score > 0 || team2Score > 0) {
        const winner = team1Score > team2Score ? finalsMatch.team1 : finalsMatch.team2;
        const loser = team1Score > team2Score ? finalsMatch.team2 : finalsMatch.team1;

        if (winner.club_id && winner.club_name && winner.club_name !== 'TBD') {
          calculatedStandings.push({
            club_id: winner.club_id,
            club_name: winner.club_name,
            place: 1,
            points: APP_CONFIG.FIRST_PLACE_POINTS
          });
        }

        // 2nd Place - Finals Loser
        if (loser.club_id && loser.club_name && loser.club_name !== 'TBD') {
          calculatedStandings.push({
            club_id: loser.club_id,
            club_name: loser.club_name,
            place: 2,
            points: APP_CONFIG.SECOND_PLACE_POINTS
          });
        }
      }
    }

    // 3rd & 4th Place Logic
    if (consolationFinalsMatch && consolationFinalsMatch.team1 && consolationFinalsMatch.team2) {
      // If consolation finals exists
      const team1Score = consolationFinalsMatch.team1.score;
      const team2Score = consolationFinalsMatch.team2.score;

      if (team1Score > 0 || team2Score > 0) {
        const thirdPlace = team1Score > team2Score ? consolationFinalsMatch.team1 : consolationFinalsMatch.team2;
        const fourthPlace = team1Score > team2Score ? consolationFinalsMatch.team2 : consolationFinalsMatch.team1;

        if (thirdPlace.club_id && thirdPlace.club_name && thirdPlace.club_name !== 'TBD') {
          calculatedStandings.push({
            club_id: thirdPlace.club_id,
            club_name: thirdPlace.club_name,
            place: 3,
            points: APP_CONFIG.THIRD_PLACE_POINTS
          });
        }

        if (fourthPlace.club_id && fourthPlace.club_name && fourthPlace.club_name !== 'TBD') {
          calculatedStandings.push({
            club_id: fourthPlace.club_id,
            club_name: fourthPlace.club_name,
            place: 4,
            points: APP_CONFIG.PARTICIPATION_POINTS_PER_SPORT
          });
        }
      }
    } else if (semiFinalsMatches.length === 2) {
      // No consolation finals - compare semi-finals losers
      const semiLosers = [];

      semiFinalsMatches.forEach(match => {
        if (match.team1 && match.team2) {
          const team1Score = match.team1.score;
          const team2Score = match.team2.score;

          if (team1Score > 0 || team2Score > 0) {
            const loser = team1Score < team2Score ? match.team1 : match.team2;

            if (loser.club_id && loser.club_name && loser.club_name !== 'TBD') {
              semiLosers.push({
                ...loser,
                semifinalScore: team1Score < team2Score ? team1Score : team2Score
              });
            }
          }
        }
      });

      // Compare semi-final losers' scores to determine 3rd and 4th
      if (semiLosers.length === 2) {
        semiLosers.sort((a, b) => b.semifinalScore - a.semifinalScore);

        calculatedStandings.push({
          club_id: semiLosers[0].club_id,
          club_name: semiLosers[0].club_name,
          place: 3,
          points: APP_CONFIG.THIRD_PLACE_POINTS
        });

        calculatedStandings.push({
          club_id: semiLosers[1].club_id,
          club_name: semiLosers[1].club_name,
          place: 4,
          points: APP_CONFIG.PARTICIPATION_POINTS_PER_SPORT
        });
      }
    }

    // Below 4th place - rank by total scores across all matches
    const clubTotalScores = {};

    allMatches.forEach(match => {
      if (match.team1 && match.team1.club_id && match.team1.club_name && match.team1.club_name !== 'TBD') {
        if (!clubTotalScores[match.team1.club_id]) {
          clubTotalScores[match.team1.club_id] = {
            club_id: match.team1.club_id,
            club_name: match.team1.club_name,
            totalScore: 0
          };
        }
        clubTotalScores[match.team1.club_id].totalScore += match.team1.score;
      }

      if (match.team2 && match.team2.club_id && match.team2.club_name && match.team2.club_name !== 'TBD') {
        if (!clubTotalScores[match.team2.club_id]) {
          clubTotalScores[match.team2.club_id] = {
            club_id: match.team2.club_id,
            club_name: match.team2.club_name,
            totalScore: 0
          };
        }
        clubTotalScores[match.team2.club_id].totalScore += match.team2.score;
      }
    });

    // Get clubs already ranked (1-4)
    const rankedClubIds = calculatedStandings.map(s => s.club_id);

    // Get remaining clubs
    const remainingClubs = Object.values(clubTotalScores)
      .filter(club => !rankedClubIds.includes(club.club_id))
      .sort((a, b) => b.totalScore - a.totalScore);

    // Assign places starting from 5th
    remainingClubs.forEach((club, index) => {
      calculatedStandings.push({
        club_id: club.club_id,
        club_name: club.club_name,
        place: 5 + index,
        points: APP_CONFIG.PARTICIPATION_POINTS_PER_SPORT
      });
    });

    return NextResponse.json({ standings: calculatedStandings });

  } catch (error) {
    console.error('Error calculating tournament standings:', error);
    return NextResponse.json(
      { error: 'Failed to calculate tournament standings' },
      { status: 500 }
    );
  }
}