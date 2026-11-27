'use client';

import { loadingAtom, userDeetsAtom } from '@/app/state/store';
import { useAtom } from 'jotai';
import React, { useState, useEffect, useCallback } from 'react';
import { getOptimizedPortalDashboardData } from '@/services/portalServices';
import { toast } from 'sonner';
import StatsCard from '@/components/StatsCard';
import LeaderboardPreview from '@/components/LeaderboardPreview';
import AnnouncementsCard from '@/components/AnnouncementsCard';
import { PortalLiveSummary } from '@/components/LiveSummary';
import PieStatCard from './components/PieStatCard';

const REFRESH_MS = 30000; // live numbers: always re-read from the server, never reuse an old copy

const PortalDashboardPage = React.memo(() => {
  const [userDeets] = useAtom(userDeetsAtom);
  const [loading] = useAtom(loadingAtom);
  const [data, setData] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [category, setCategory] = useState('community');

  const load = useCallback(async (cat, { quiet = true } = {}) => {
    try {
      setData(await getOptimizedPortalDashboardData(userDeets.club_id, cat, 10));
      setStatsError(null);
    } catch (error) {
      console.error('Error fetching portal dashboard data:', error);
      setStatsError(error.message);
      if (!quiet) toast.error('Failed to load dashboard data');
    }
  }, [userDeets?.club_id]);

  useEffect(() => {
    if (loading || !userDeets?.club_id) return;
    load(category, { quiet: false });
    const interval = setInterval(() => load(category), REFRESH_MS);
    return () => clearInterval(interval);
  }, [loading, userDeets?.club_id, category, load]);

  const portalStats = data?.stats;
  const statsLoading = !portalStats;
  const leaderboardData = data?.leaderboard ?? [];
  const displayStats = {
    registeredEvents: portalStats?.registeredEvents ?? 0,
    registeredPlayers: portalStats?.registeredPlayers ?? 0,
    totalPoints: portalStats?.totalPoints ?? 0,
    clubRank: portalStats?.clubRank ?? 0,
  };
  const playerBreakdown = portalStats?.playerBreakdown || { general: 0, prospective: 0, total: 0 };
  const pieStatLoading = statsLoading;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen w-screen">
        <img src="/load.svg" alt="" className="w-20" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Welcome Message */}
      <div className="text-center mb-12">
        <div className="flex justify-center items-center">
          <h1 className="text-3xl font-light text-white">
            Welcome Back👋 <span className='font-semibold'>{userDeets?.card_name || 'User'}</span>
          </h1>
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-12 gap-6 h-full">
        {/* Left Column - Statistics */}
        <div className="col-span-8 h-full grid grid-rows-2 gap-6">
          <div className="grid grid-cols-2 gap-6 mb-6 h-full">
            {/* Top Row - Main Stats */}
            <StatsCard 
              title="Registered Events" 
              value={displayStats.registeredEvents}
              indicatorColor="bg-cranberry"
              showIndicator={true}
            />
            <StatsCard 
              title="Registered Players" 
              value={displayStats.registeredPlayers}
              indicatorColor="bg-cranberry"
              showIndicator={true}
            />
          </div>

          <div className="grid grid-cols-2 gap-6 h-full">
            {/* Bottom Row - Points & Rank */}
            <StatsCard
              title="Total Points"
              value={displayStats.totalPoints}
              indicatorColor="bg-cranberry/10"
              showIndicator={false}
            />
            <StatsCard
              title="Club Rank"
              value={displayStats.clubRank}
              indicatorColor="bg-cranberry/10"
              showIndicator={false}
            />
          </div>
        </div>

        {/* Right Column - Player Breakdown + Announcements */}
        <div className="col-span-4 h-full">
          {/* Registered players breakdown PieStatCard */}
          <PieStatCard
            title="General members %"
            registered={playerBreakdown.total > 0 ? Math.round((playerBreakdown.general / playerBreakdown.total) * 100) : 0}
            total={100}
            color="cranberry"
            loading={pieStatLoading}
          />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 h-full mt-6">
          {/* Leaderboard Section */}
          <div className="col-span-8">
            <LeaderboardPreview 
              leaderboardData={leaderboardData} 
              onCategoryChange={setCategory}
            />
          </div>
          <div className='col-span-4'>
            {/* Announcements */}
            <AnnouncementsCard />
          </div>
      </div>

      {portalStats && (
        <div className="mt-6">
          <PortalLiveSummary stats={portalStats} />
        </div>
      )}

      {statsError && (
        <div className="text-center text-red-400 mt-4">
          Error loading dashboard: {statsError}
        </div>
      )}
    </div>
  );
});

export default PortalDashboardPage;
