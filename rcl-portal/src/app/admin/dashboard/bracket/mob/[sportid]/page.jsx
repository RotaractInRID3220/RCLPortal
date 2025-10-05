"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from 'next/navigation';
import { useAtom } from 'jotai';
import { createClient } from '@supabase/supabase-js';
import BracketService from '@/services/bracketServices';
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
import { toast } from 'sonner';
import { ArrowLeft, RefreshCw } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const MobileMatchesPage = () => {
  const params = useParams();
  const router = useRouter();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Score editing dialog state
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState(null);
  const [tempScores, setTempScores] = useState({ team1: 0, team2: 0 });
  const [isSaving, setIsSaving] = useState(false);

  // Set selectedSport from URL params when component mounts
  useEffect(() => {
    if (params.sportid) {
      fetchMatches();
    }
  }, [params.sportid]);

  // Fetch matches for the sport
  const fetchMatches = async () => {
    if (!params.sportid) return;

    const currentSportId = parseInt(params.sportid);
    setLoading(true);
    setError(null);

    try {
      // Fetch matches data
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
        .eq('sport_id', currentSportId)
        .order('round_id', { ascending: true })
        .order('match_order', { ascending: true });

      if (matchesError) {
        throw new Error(matchesError.message);
      }

      setMatches(matchesData || []);
    } catch (error) {
      console.error('Error fetching matches:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle match click for scoring
  const handleMatchClick = (match) => {
    // Only allow editing if match has both teams
    if (!match.team1?.club?.club_name || !match.team2?.club?.club_name) {
      return;
    }

    setEditingMatch(match);
    setTempScores({
      team1: match.team1_score || 0,
      team2: match.team2_score || 0
    });
    setIsScoreDialogOpen(true);
  };

  // Handle saving scores
  const handleSaveScores = async () => {
    if (!editingMatch || !editingMatch.match_id) return;

    setIsSaving(true);
    try {
      // Update scores in database
      const { error } = await supabase
        .from('matches')
        .update({
          team1_score: tempScores.team1,
          team2_score: tempScores.team2
        })
        .eq('match_id', editingMatch.match_id);

      if (error) {
        console.error('Error updating scores:', error);
        toast.error('Failed to update scores. Please try again.');
        return;
      }

      // Close dialog and reset state
      setIsScoreDialogOpen(false);
      setEditingMatch(null);
      setTempScores({ team1: 0, team2: 0 });

      // Refresh matches
      fetchMatches();

      toast.success('Scores updated successfully!');
    } catch (error) {
      console.error('Error saving scores:', error);
      toast.error('Failed to update scores. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle score input change
  const handleScoreChange = (team, value) => {
    const numValue = Math.max(0, parseInt(value) || 0);
    setTempScores(prev => ({
      ...prev,
      [team]: numValue
    }));
  };

  // Format match date
  const formatMatchDate = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get team styling based on scores
  const getTeamStyling = (match, isTeam1) => {
    const team1Score = match.team1_score || 0;
    const team2Score = match.team2_score || 0;

    if (team1Score === 0 && team2Score === 0) {
      return {
        bgColor: "bg-white/10",
        scoreColor: "bg-white/20",
      };
    }

    if (isTeam1) {
      return team1Score > team2Score ? {
        bgColor: "bg-green-500/15",
        scoreColor: "bg-green-600",
      } : {
        bgColor: "bg-red-500/15",
        scoreColor: "bg-red-600",
      };
    } else {
      return team2Score > team1Score ? {
        bgColor: "bg-green-500/15",
        scoreColor: "bg-green-600",
      } : {
        bgColor: "bg-red-500/15",
        scoreColor: "bg-red-600",
      };
    }
  };

  return (
    <div className="min-h-screen p-4">
      <div className="flex w-full justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold tracking-wide">MATCHES</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="icon"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            onClick={fetchMatches}
            variant="outline"
            size="icon"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 h-9 w-9"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center mt-20">
          <img src="/load.svg" alt="" className="w-16" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
          <div className="text-red-400 font-semibold">Error loading matches:</div>
          <div className="text-red-300 mt-1">{error}</div>
          <button
            onClick={fetchMatches}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Matches List */}
      {!loading && !error && matches.length > 0 && (
        <div className="space-y-6">
          {/* Group matches by round */}
          {Object.entries(
            matches.reduce((acc, match) => {
              const roundKey = `Round ${match.round_id + 1}`;
              if (!acc[roundKey]) acc[roundKey] = [];
              acc[roundKey].push(match);
              return acc;
            }, {})
          ).map(([roundName, roundMatches]) => (
            <div key={roundName} className="space-y-3">
              <div className="flex items-center w-full mb-3">
                <h3 className="text-lg font-medium text-white/80 flex items-center">
                  {roundName}
                </h3>
                <div className="flex-1 ml-4 h-px bg-gradient-to-r from-white/50 to-white/10"></div>
              </div>

              <div className="space-y-3">
                {roundMatches.map((match) => {
                  const team1Styling = getTeamStyling(match, true);
                  const team2Styling = getTeamStyling(match, false);

                  return (
                    <div
                      key={match.match_id}
                      className="bg-white/10 rounded-lg p-4 hover:bg-white/15 transition-colors cursor-pointer"
                      onClick={() => handleMatchClick(match)}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <p className="font-medium text-white/80">Match #{match.match_id}</p>
                        <p className="text-xs text-white/60">{formatMatchDate(match.start_time)}</p>
                      </div>

                      <div className="space-y-2">
                        <div className={`flex w-full ${team1Styling.bgColor} items-center justify-between py-3 px-4 rounded-md`}>
                          <p className="text-sm font-medium truncate flex-1 mr-2">
                            {match.team1?.club?.club_name || 'TBD'}
                          </p>
                          <p className={`w-12 h-8 flex items-center justify-center ${team1Styling.scoreColor} rounded-sm text-sm font-bold`}>
                            {match.team1_score || 0}
                          </p>
                        </div>

                        <div className={`flex w-full ${team2Styling.bgColor} items-center justify-between py-3 px-4 rounded-md`}>
                          <p className="text-sm font-medium truncate flex-1 mr-2">
                            {match.team2?.club?.club_name || 'TBD'}
                          </p>
                          <p className={`w-12 h-8 flex items-center justify-center ${team2Styling.scoreColor} rounded-sm text-sm font-bold`}>
                            {match.team2_score || 0}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 text-center">
                        <p className="text-xs text-white/50">Tap to update scores</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Data State */}
      {!loading && !error && matches.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg">No matches found for this sport</div>
          <div className="text-gray-500 mt-2">
            Make sure there are matches created in the database for sport ID: {params.sportid}
          </div>
        </div>
      )}

      {/* SCORE EDITING DIALOG */}
      <Dialog open={isScoreDialogOpen} onOpenChange={setIsScoreDialogOpen}>
        <DialogContent className="bg-black/80 border-cranberry/40 backdrop-blur text-white w-[95vw] max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-white text-lg">Update Match Scores</DialogTitle>
            <DialogDescription className="text-gray-300 text-sm">
              Match #{editingMatch?.match_id}
            </DialogDescription>
          </DialogHeader>

          {editingMatch && (
            <div className="space-y-4 py-2">
              {/* Team 1 Score */}
              <div className="space-y-2">
                <Label className="text-white font-medium text-sm">
                  {editingMatch.team1?.club?.club_name || 'Team 1'}
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={tempScores.team1}
                  onChange={(e) => handleScoreChange('team1', e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white focus:border-cranberry focus:ring-cranberry h-10"
                  placeholder="Enter score"
                />
              </div>

              {/* Team 2 Score */}
              <div className="space-y-2">
                <Label className="text-white font-medium text-sm">
                  {editingMatch.team2?.club?.club_name || 'Team 2'}
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={tempScores.team2}
                  onChange={(e) => handleScoreChange('team2', e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white focus:border-cranberry focus:ring-cranberry h-10"
                  placeholder="Enter score"
                />
              </div>

              {/* Score Preview */}
              <div className="bg-white/10 rounded-lg p-3 border border-gray-700">
                <div className="text-center text-gray-300 text-xs mb-2">Score Preview</div>
                <div className="flex justify-between items-center">
                  <span className="text-white text-xs truncate mr-1 flex-1 text-left">
                    {editingMatch.team1?.club?.club_name}
                  </span>
                  <span className="text-lg font-bold text-white mx-2">
                    {tempScores.team1} - {tempScores.team2}
                  </span>
                  <span className="text-white text-xs truncate ml-1 flex-1 text-right">
                    {editingMatch.team2?.club?.club_name}
                  </span>
                </div>
                {tempScores.team1 !== tempScores.team2 && tempScores.team1 >= 0 && tempScores.team2 >= 0 && (
                  <div className="text-center mt-2 text-xs">
                    {tempScores.team1 > tempScores.team2 ? (
                      <span className="text-green-400">🏆 {editingMatch.team1?.club?.club_name} Wins</span>
                    ) : (
                      <span className="text-green-400">🏆 {editingMatch.team2?.club?.club_name} Wins</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsScoreDialogOpen(false)}
              className="border-gray-600 text-white hover:bg-gray-800 cursor-pointer h-9 text-sm flex-1"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveScores}
              disabled={isSaving}
              className="bg-cranberry/20 hover:bg-cranberry border cursor-pointer border-cranberry text-white h-9 text-sm flex-1"
            >
              {isSaving ? 'Saving...' : 'Save Scores'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MobileMatchesPage;