'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Users, Trophy, Calendar, CheckCircle, XCircle } from 'lucide-react';
import PrivateRoute from '@/lib/PrivateRoute';
import { APP_CONFIG, SPORT_DAYS } from '@/config/app.config';

const ClubParticipationDetailsPage = () => {
  const params = useParams();
  const router = useRouter();
  const [clubData, setClubData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSportDay] = useState(APP_CONFIG.CURRENT_SPORT_DAY);

  // Get sport day label
  const sportDayLabel = Object.values(SPORT_DAYS).find(day => day.value === selectedSportDay)?.label || selectedSportDay;

  // Fetch club participation details
  const fetchClubDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/participation-points/${params.clubId}?sportDay=${selectedSportDay}`);
      const result = await response.json();

      if (response.ok) {
        setClubData(result.data);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error fetching club details:', error);
      // Handle error - could show toast or redirect
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.clubId) {
      fetchClubDetails();
    }
  }, [params.clubId, selectedSportDay]);

  if (loading) {
    return (
      <PrivateRoute accessType="admin">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center text-white/70">
            <p>Loading club details...</p>
          </div>
        </div>
      </PrivateRoute>
    );
  }

  if (!clubData) {
    return (
      <PrivateRoute accessType="admin">
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center text-white/70">
            <p>Club not found</p>
            <Button
              onClick={() => router.back()}
              className="mt-4 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </PrivateRoute>
    );
  }

  const { club, sports, players, summary } = clubData;

  return (
    <PrivateRoute requiredPermission="admin" accessType="admin">
      <div className="min-h-screen">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-start gap-4 mb-4">
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="bg-white/5 border-white/20 text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Participation Points
            </Button>
          </div>
          <h1 className="text-3xl font-semibold tracking-wide text-white">{club.club_name}</h1>
          <p className="text-white/70 mt-2">Participation Breakdown - {sportDayLabel}</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-4">
              <div className="text-center">
                <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                <p className="text-white/70 text-sm">Total Players</p>
                <p className="text-white text-2xl font-bold">{summary.total_players}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-4">
              <div className="text-center">
                <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                <p className="text-white/70 text-sm">Day Registered</p>
                <p className="text-green-400 text-2xl font-bold">{summary.day_registered_count}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-4">
              <div className="text-center">
                <Trophy className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                <p className="text-white/70 text-sm">Sports</p>
                <p className="text-yellow-400 text-2xl font-bold">{summary.total_sports}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/20">
            <CardContent className="p-4">
              <div className="text-center">
                <Calendar className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <p className="text-white/70 text-sm">Attendance Rate</p>
                <p className="text-purple-400 text-2xl font-bold">
                  {summary.total_players > 0
                    ? Math.round((summary.day_registered_count / summary.total_players) * 100)
                    : 0}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* Sports Breakdown */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6" />
            Sports Breakdown
          </h2>

          {sports.map((sport) => {
            const registeredCount = sport.players.filter(p => p.day_registered).length;
            const attendanceRate = sport.players.length > 0
              ? Math.round((registeredCount / sport.players.length) * 100)
              : 0;

            return (
              <Card key={sport.sport_id} className="bg-white/5 border-white/20">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    <span>{sport.sport_name}</span>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-white/70">
                        {registeredCount}/{sport.players.length} registered
                      </span>
                      <Badge
                        variant={attendanceRate >= 50 ? "default" : "secondary"}
                        className={
                          attendanceRate >= 50
                            ? "bg-green-500/20 text-green-300 border-green-500/30"
                            : "bg-red-500/20 text-red-300 border-red-500/30"
                        }
                      >
                        {attendanceRate}% attendance
                        {attendanceRate >= 50 && " ✓ Eligible"}
                      </Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {sport.players.map((player) => (
                      <div
                        key={player.RMIS_ID}
                        className={`p-3 rounded border transition-colors ${
                          player.day_registered
                            ? 'border-green-400 bg-green-400/5'
                            : 'border-gray-600 bg-gray-600/5'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white text-sm font-medium">
                            {player.name}
                          </span>
                          {player.day_registered ? (
                            <CheckCircle className="w-4 h-4 text-green-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <p className="text-white/60 text-xs mt-1">{player.RMIS_ID}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="mt-8 bg-white/5 border border-white/20 rounded-lg p-4">
          <p className="text-white/70 text-sm">
            <span className="font-semibold text-white">Note:</span> Green borders indicate players who have completed day registration for {sportDayLabel}.
            Sports with ≥50% attendance are eligible for participation points.
          </p>
        </div>
      </div>
    </PrivateRoute>
  );
};

export default ClubParticipationDetailsPage;