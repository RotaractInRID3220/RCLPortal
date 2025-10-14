'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import StatsCard from '@/components/StatsCard';
import { getAdministrationStats } from '@/services/adminServices';
import { UserMinus, RefreshCw, Users, UserCheck, Calendar, Trophy, CreditCard, BarChart3, UserCog, Award } from 'lucide-react';
import PrivateRoute from '@/lib/PrivateRoute';

const AdministrationPage = () => {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [cleaningPlayers, setCleaningPlayers] = useState(false);
  const [syncingRMIS, setSyncingRMIS] = useState(false);

  // Fetch administration stats
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const data = await getAdministrationStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Failed to load administration statistics');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleGlobalCleanPlayers = async () => {
    try {
      setCleaningPlayers(true);
      const response = await fetch('/api/players/clean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // No club_id for global clean
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message);
        // Refresh stats after cleaning
        fetchStats();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('Failed to clean players globally: ' + error.message);
    } finally {
      setCleaningPlayers(false);
    }
  };

  const handleSyncRMIS = async () => {
    try {
      setSyncingRMIS(true);
      const response = await fetch('/api/players/sync-rmis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // No club_id for global sync
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(result.message);
        // Refresh stats after syncing
        fetchStats();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      toast.error('RMIS sync failed: ' + error.message);
    } finally {
      setSyncingRMIS(false);
    }
  };

  return (
    <PrivateRoute requiredPermission="admin" accessType="admin">
    <div className="min-h-screen">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-semibold tracking-wide text-white">ADMINISTRATION</h1>
        <p className="text-white/70 mt-2">System-wide administrative operations and statistics</p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-40 mb-8">
        {/* Global Clean Players */}
        <Card className="bg-white/5 border-white/20 h-full flex flex-col">
          <CardHeader className="flex-grow">
            <CardTitle className="text-white flex items-center gap-2">
              <UserMinus className="w-5 h-5" />
              Global Clean Players
            </CardTitle>
            <CardDescription className="text-white/70">
              Remove all players across all clubs who have no registrations. This operation affects the entire system.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={cleaningPlayers}
                  className="w-full bg-red-500/20 border border-red-500 hover:bg-red-500/30 text-red-200 cursor-pointer"
                >
                  {cleaningPlayers ? 'Cleaning...' : 'Clean Players Globally'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-900 border-gray-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Confirm Global Clean</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-300">
                    This will remove players without registrations from ALL clubs across the entire system. This action cannot be undone and will affect all data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-700">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGlobalCleanPlayers} className="bg-red-600 hover:bg-red-700">
                    Confirm Global Clean
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Sync with RMIS */}
        <Card className="bg-white/5 border-white/20 h-full flex flex-col">
          <CardHeader className="flex-grow">
            <CardTitle className="text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Sync with RMIS
            </CardTitle>
            <CardDescription className="text-white/70">
              Sync player and club data from the Rotaract Membership Information System across all clubs.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={syncingRMIS}
                  className="w-full bg-blue-500/20 border border-blue-500 hover:bg-blue-500/30 text-blue-200 cursor-pointer"
                >
                  {syncingRMIS ? 'Syncing...' : 'Sync RMIS Globally'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-900 border-gray-700">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Confirm Global RMIS Sync</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-300">
                    This will fetch and update player status data from RMIS for ALL clubs in the system. Ensure the system is ready for bulk updates.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-700">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSyncRMIS} className="bg-blue-600 hover:bg-blue-700">
                    Confirm Global Sync
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Membership Management */}
        <Card className="bg-white/5 border-white/20 h-full flex flex-col">
          <CardHeader className="flex-grow">
            <CardTitle className="text-white flex items-center gap-2">
              <UserCog className="w-5 h-5" />
              Membership Management
            </CardTitle>
            <CardDescription className="text-white/70">
              Monitor club membership compliance and apply penalty rules based on general member registration percentages.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button
              className="w-full bg-purple-500/20 border border-purple-500 hover:bg-purple-500/30 text-purple-200 cursor-pointer"
              onClick={() => window.location.href = '/admin/dashboard/membership-management'}
            >
              Manage Membership
            </Button>
          </CardContent>
        </Card>

        {/* Participation Points */}
        <Card className="bg-white/5 border-white/20 h-full flex flex-col">
          <CardHeader className="flex-grow">
            <CardTitle className="text-white flex items-center gap-2">
              <Award className="w-5 h-5" />
              Participation Points
            </CardTitle>
            <CardDescription className="text-white/70">
              Award points to clubs based on player attendance for sport days. Track participation and reward consistent attendance.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button
              className="w-full bg-yellow-500/20 border border-yellow-500 hover:bg-yellow-500/30 text-yellow-200 cursor-pointer"
              onClick={() => window.location.href = '/admin/dashboard/participation-points'}
            >
              Manage Participation
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Dashboard */}
      <div className="mb-6 mt-20">
        <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          System Statistics
        </h2>

        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white/5 border border-white/20 rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-white/20 rounded mb-2"></div>
                <div className="h-8 bg-white/20 rounded"></div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatsCard
              title="Total Clubs Registered"
              value={stats.totalClubs}
              indicatorColor="bg-cranberry"
              showIndicator={true}
            />
            <StatsCard
              title="Total Players"
              value={stats.totalPlayers}
              indicatorColor="bg-cranberry"
              showIndicator={true}
            />
            <StatsCard
              title="Total Registrations"
              value={stats.totalRegistrations}
              indicatorColor="bg-cranberry"
              showIndicator={true}
            />
            <StatsCard
              title="Total Events"
              value={stats.totalEvents}
              indicatorColor="bg-cranberry"
              showIndicator={true}
            />
            <StatsCard
              title="Total Teams"
              value={stats.totalTeams}
              indicatorColor="bg-cranberry"
              showIndicator={true}
            />
            <StatsCard
              title="Approved Payments"
              value={stats.totalPayments}
              indicatorColor="bg-cranberry"
              showIndicator={true}
            />
            <StatsCard
              title="Male Players"
              value={stats.playersByGender?.male || 0}
              indicatorColor="bg-cranberry"
              showIndicator={true}
            />
            <StatsCard
              title="Female Players"
              value={stats.playersByGender?.female || 0}
              indicatorColor="bg-cranberry"
              showIndicator={true}
            />
          </div>
        ) : (
          <div className="text-center text-red-400">
            Failed to load statistics
          </div>
        )}
      </div>

      {/* Registration Breakdown */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-white/5 border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Registration Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Individual Sports</span>
                  <span className="text-white font-semibold">{stats.registrationsByCategory.individual}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Team Sports</span>
                  <span className="text-white font-semibold">{stats.registrationsByCategory.team}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                Gender Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Male Players</span>
                  <span className="text-white font-semibold">{stats.playersByGender.male}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/80">Female Players</span>
                  <span className="text-white font-semibold">{stats.playersByGender.female}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
    </PrivateRoute>
  );
};

export default AdministrationPage;