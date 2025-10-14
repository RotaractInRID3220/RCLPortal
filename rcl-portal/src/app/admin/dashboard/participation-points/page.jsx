'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Search, Award, Trophy, Users, CheckCircle2, CheckCircle, XCircle, Clock } from 'lucide-react';
import PrivateRoute from '@/lib/PrivateRoute';
import { APP_CONFIG, SPORT_DAYS } from '@/config/app.config';

const ParticipationPointsPage = () => {
  const [participationData, setParticipationData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [awardingPoints, setAwardingPoints] = useState(false);
  const [selectedSportDay] = useState(APP_CONFIG.CURRENT_SPORT_DAY);
  const [awardSummary, setAwardSummary] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Get sport day label
  const sportDayLabel = Object.values(SPORT_DAYS).find(day => day.value === selectedSportDay)?.label || selectedSportDay;

  // Fetch participation data
  const fetchParticipationData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/participation-points?sportDay=${selectedSportDay}`);
      const result = await response.json();

      if (response.ok) {
        setParticipationData(result.data || []);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error fetching participation data:', error);
      toast.error('Failed to load participation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParticipationData();
  }, [selectedSportDay]);

  // Handle award points
  const handleAwardPoints = async () => {
    try {
      setAwardingPoints(true);
      const response = await fetch('/api/admin/participation-points/award', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sportDay: selectedSportDay }),
      });
      const result = await response.json();

      if (response.ok) {
        setAwardSummary(result.summary);
        toast.success(result.message);
        // Refresh data after awarding points
        fetchParticipationData();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('Failed to award points: ' + error.message);
    } finally {
      setAwardingPoints(false);
    }
  };

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = participationData.filter(club =>
      club.club_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort by: 1) Number of players (descending), 2) Club name (alphabetically)
    filtered.sort((a, b) => {
      if (b.registered_players_count !== a.registered_players_count) {
        return b.registered_players_count - a.registered_players_count;
      }
      return a.club_name.localeCompare(b.club_name);
    });

    return filtered;
  }, [participationData, searchTerm]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedData.slice(startIndex, endIndex);
  }, [filteredAndSortedData, currentPage, itemsPerPage]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Calculate total eligible clubs and sports
  const eligibleClubs = participationData.filter(club => club.eligible_sports_count > 0).length;
  const totalEligibleSports = participationData.reduce((sum, club) => sum + club.eligible_sports_count, 0);

  return (
    <PrivateRoute requiredPermission="admin" accessType="admin">
      <TooltipProvider>
        <div className="min-h-screen">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-wide text-white">PARTICIPATION POINTS</h1>
          <p className="text-white/70 mt-2">Award points to clubs based on player attendance - {sportDayLabel}</p>
        </div>

        {/* Summary Stats */}
        {!loading && participationData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-white/70 text-sm">Total Clubs</p>
                  <p className="text-white text-2xl font-bold">{participationData.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-white/70 text-sm">Eligible Clubs</p>
                  <p className="text-green-500 text-2xl font-bold">{eligibleClubs}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/20">
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-white/70 text-sm">Points Per Sport</p>
                  <p className="text-yellow-500 text-2xl font-bold">{APP_CONFIG.PARTICIPATION_POINTS_PER_SPORT}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Top Controls */}
        <div className="flex justify-between items-center mb-6">
          {/* Search */}
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-4 h-4" />
            <Input
              placeholder="Search clubs by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/5 border-white/20 text-white placeholder-white/50"
            />
          </div>

          {/* Award Points Button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={awardingPoints || loading || eligibleClubs === 0}
                className="bg-cranberry/20 border border-cranberry hover:bg-cranberry text-white flex items-center gap-2 cursor-pointer"
              >
                <Award className="w-4 h-4" />
                {awardingPoints ? 'Awarding Points...' : 'Award Participation Points'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-gray-900 border-gray-700 max-w-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Confirm Award Participation Points</AlertDialogTitle>
                <AlertDialogDescription className="text-gray-300">
                  <span>This will award <span className="text-cranberry font-semibold">{APP_CONFIG.PARTICIPATION_POINTS_PER_SPORT} points</span> per eligible sport to clubs for <span className="text-white font-semibold">{sportDayLabel}</span>.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="px-6 pb-4">
                <strong className="text-white">Eligibility Criteria:</strong>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1 text-gray-300">
                  <li>Club must have ≥50% of registered players attend on the day</li>
                  <li>Points will NOT be awarded if already awarded for this day</li>
                  <li>Total eligible clubs: <span className="text-green-400">{eligibleClubs}</span></li>
                  <li>Total eligible sports: <span className="text-blue-400">{totalEligibleSports}</span></li>
                </ul>
                <div className="mt-4">
                  <span className="text-yellow-400 text-sm">⚠️ This action will insert records into the club_points table and cannot be easily undone.</span>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-gray-700">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleAwardPoints} className="bg-cranberry hover:bg-cranberry/80">
                  Confirm Award Points
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Award Summary */}
        {awardSummary && (
          <Card className="bg-green-500/10 border-green-500/30 mb-6">
            <CardHeader>
              <CardTitle className="text-green-400 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Points Awarded Successfully
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white/90">
                <div>
                  <p className="text-sm text-white/70">Clubs Awarded</p>
                  <p className="text-xl font-bold">{awardSummary.clubsAwarded}</p>
                </div>
                <div>
                  <p className="text-sm text-white/70">Total Points</p>
                  <p className="text-xl font-bold">{awardSummary.totalPointsAwarded}</p>
                </div>
                <div>
                  <p className="text-sm text-white/70">Clubs Skipped</p>
                  <p className="text-xl font-bold">{awardSummary.clubsSkipped}</p>
                </div>
                <div>
                  <p className="text-sm text-white/70">Sport Day</p>
                  <p className="text-xl font-bold">{sportDayLabel}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Table */}
        {loading ? (
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-8">
              <div className="text-center text-white/70">
                <p>Loading participation data...</p>
              </div>
            </CardContent>
          </Card>
        ) : paginatedData.length === 0 ? (
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-8">
              <div className="text-center text-white/70">
                <p>No clubs found{searchTerm ? ' matching your search' : ''}.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/10">
                    <tr className="border-b border-white/20">
                      <th className="text-left p-4 text-white font-semibold">#</th>
                      <th className="text-left p-4 text-white font-semibold">Club Name</th>
                      <th className="text-center p-4 text-white font-semibold">Registered Players</th>
                      <th className="text-center p-4 text-white font-semibold">Day Registrations</th>
                      <th className="text-center p-4 text-white font-semibold">Registered Sports</th>
                      <th className="text-center p-4 text-white font-semibold">Eligible Sports</th>
                      <th className="text-center p-4 text-white font-semibold">Potential Points</th>
                      <th className="text-center p-4 text-white font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map((club, index) => {
                      const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                      return (
                        <tr 
                          key={club.club_id} 
                          className="border-b border-white/10 hover:bg-white/5 transition-colors"
                        >
                          <td className="p-4 text-white/70">{globalIndex}</td>
                          <td className="p-4 text-white font-medium">
                            <Link
                              href={`/admin/dashboard/participation-points/${club.club_id}`}
                              className="hover:text-blue-400 transition-colors underline decoration-transparent hover:decoration-current"
                            >
                              {club.club_name}
                            </Link>
                          </td>
                          <td className="p-4 text-center text-white">{club.registered_players_count}</td>
                          <td className="p-4 text-center text-white">{club.day_registration_count}</td>
                          <td className="p-4 text-center text-white">{club.registered_sports_count}</td>
                          <td className="p-4 text-center">
                            <span className={`font-semibold ${club.eligible_sports_count > 0 ? 'text-green-400' : 'text-white/50'}`}>
                              {club.eligible_sports_count}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`font-semibold ${club.eligible_sports_count > 0 ? 'text-yellow-400' : 'text-white/50'}`}>
                              {club.eligible_sports_count * APP_CONFIG.PARTICIPATION_POINTS_PER_SPORT}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            {club.already_awarded ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Clock className="w-5 h-5 text-blue-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Already Awarded</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : club.eligible_sports_count > 0 ? (
                              <Tooltip>
                                <TooltipTrigger>
                                  <CheckCircle className="w-5 h-5 text-green-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Eligible for Points</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger>
                                  <XCircle className="w-5 h-5 text-gray-400" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Not Eligible</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-white/70 text-sm">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)} of {filteredAndSortedData.length} clubs
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                size="sm"
              >
                Previous
              </Button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 text-sm ${
                        currentPage === pageNum
                          ? 'bg-cranberry text-white'
                          : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                      }`}
                      size="sm"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                size="sm"
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-6 bg-white/5 border border-white/20 rounded-lg p-4">
          <p className="text-white/70 text-sm">
            <span className="font-semibold text-white">Note:</span> Points are awarded to clubs where ≥50% of players registered for a sport have completed their day registration. 
            The system automatically checks for duplicates to prevent double-awarding for the same day.
          </p>
        </div>
      </div>
      </TooltipProvider>
    </PrivateRoute>
  );
};

export default ParticipationPointsPage;
