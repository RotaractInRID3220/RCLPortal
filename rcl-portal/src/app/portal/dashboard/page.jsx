'use client';

import { 
  loadingAtom, 
  userDeetsAtom, 
  portalDashboardDataAtom,
  portalStatsAtom,
  portalStatsLoadingAtom,
  portalStatsErrorAtom,
  portalLeaderboardAtom,
  portalLeaderboardLoadingAtom,
  lastFetchTimestampAtom,
  isCacheValid
} from '@/app/state/store';
import { useAtom } from 'jotai';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getOptimizedPortalDashboardData } from '@/services/portalServices';
import { getLeaderboardPreview } from '@/services/adminServices';
import { toast } from 'sonner';
import StatsCard from '@/components/StatsCard';
import LeaderboardPreview from '@/components/LeaderboardPreview';
import AnnouncementsCard from '@/components/AnnouncementsCard';
import PieStatCard from './components/PieStatCard';

const PortalDashboardPage = React.memo(() => {
  const [userDeets] = useAtom(userDeetsAtom);
  const [loading] = useAtom(loadingAtom);
  const [dashboardData, setDashboardData] = useAtom(portalDashboardDataAtom);
  const [lastFetchTimestamp, setLastFetchTimestamp] = useAtom(lastFetchTimestampAtom);
  
  // Portal-specific atoms
  const [portalStats, setPortalStats] = useAtom(portalStatsAtom);
  const [statsLoading, setStatsLoading] = useAtom(portalStatsLoadingAtom);
  const [statsError, setStatsError] = useAtom(portalStatsErrorAtom);
  const [leaderboardData, setLeaderboardData] = useAtom(portalLeaderboardAtom);
  const [leaderboardLoading, setLeaderboardLoading] = useAtom(portalLeaderboardLoadingAtom);
  
  const [currentLeaderboardCategory, setCurrentLeaderboardCategory] = useState('community');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Debug: Log the current loading states
  console.log('Current loading states:', { 
    statsLoading, 
    leaderboardLoading, 
    isRefreshing,
    hasData: leaderboardData?.length > 0
  });

  // Memoized values
  const isDataCacheValid = useMemo(() => {
    return isCacheValid(lastFetchTimestamp.portalDashboard, 'portalDashboard');
  }, [lastFetchTimestamp.portalDashboard]);

  // Match admin logic for stats display
  const displayStats = useMemo(() => ({
    registeredEvents: statsLoading ? 0 : portalStats.registeredEvents,
    registeredPlayers: statsLoading ? 0 : portalStats.registeredPlayers,
    totalPoints: statsLoading ? 0 : portalStats.totalPoints,
    clubRank: statsLoading ? 0 : portalStats.clubRank
  }), [statsLoading, portalStats]);

  // PieStat breakdown for registered players
  const playerBreakdown = portalStats?.playerBreakdown || { general: 0, prospective: 0, total: 0 };
  const pieStatLoading = statsLoading || !portalStats?.playerBreakdown;

  // Optimized data fetching with smart caching (match admin logic)
  const fetchOptimizedDashboardData = useCallback(async (forceRefresh = false) => {
    try {
      if (!userDeets?.club_id) {
        console.error('No club ID found in user details:', userDeets);
        return;
      }

      // Check cache validity unless forcing refresh
      if (!forceRefresh && isDataCacheValid && dashboardData.stats?.registeredEvents > 0) {
        console.log('Using cached portal dashboard data');
        return;
      }

      setStatsLoading(true);
      setLeaderboardLoading(true);
      setStatsError(null);

      // Single optimized API call
      const data = await getOptimizedPortalDashboardData(
        userDeets.club_id,
        currentLeaderboardCategory,
        10
      );

      // Update all data at once
      setDashboardData(data);
      setLastFetchTimestamp(prev => ({
        ...prev,
        portalDashboard: Date.now()
      }));

      // Update individual atoms for backward compatibility
      setPortalStats(data.stats);
      setLeaderboardData(data.leaderboard);

    } catch (error) {
      console.error('Error fetching optimized portal dashboard data:', error);
      setStatsError(error.message);
      if (forceRefresh) {
        toast.error('Failed to refresh dashboard data');
      } else {
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setStatsLoading(false);
      setLeaderboardLoading(false);
      setIsRefreshing(false);
    }
  }, [
    userDeets?.club_id,
    isDataCacheValid,
    dashboardData.stats?.registeredEvents,
    currentLeaderboardCategory,
    setDashboardData,
    setLastFetchTimestamp,
    setPortalStats,
    setLeaderboardData,
    setStatsLoading,
    setLeaderboardLoading,
    setStatsError
  ]);

  // Handles leaderboard category filter changes (match admin logic)
  const handleLeaderboardCategoryChange = useCallback(async (category) => {
    try {
      setLeaderboardLoading(true);
      setCurrentLeaderboardCategory(category);

      // Fetch only leaderboard data for category change
      const leaderboard = await getLeaderboardPreview(category);
      setLeaderboardData(leaderboard);

    } catch (error) {
      console.error('Error fetching filtered leaderboard:', error);
      toast.error('Failed to load leaderboard data');
    } finally {
      setLeaderboardLoading(false);
    }
  }, [setLeaderboardData, setLeaderboardLoading]);

  // Background refresh handler
  const handleRefresh = useCallback(() => {
    if (!isRefreshing) {
      setIsRefreshing(true);
      fetchOptimizedDashboardData(true);
    }
  }, [isRefreshing, fetchOptimizedDashboardData]);

  // Initial data fetch
  useEffect(() => {
    if (!loading && userDeets?.club_id) {
      fetchOptimizedDashboardData();
    }
  }, [loading, userDeets?.club_id, fetchOptimizedDashboardData]);

  // Smart background refresh - only when cache is invalid
  useEffect(() => {
    if (!loading && userDeets?.club_id && !isDataCacheValid) {
      const interval = setInterval(() => {
        fetchOptimizedDashboardData();
      }, 60000); // 60 seconds

      return () => clearInterval(interval);
    }
  }, [loading, userDeets?.club_id, isDataCacheValid, fetchOptimizedDashboardData]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
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
              onCategoryChange={handleLeaderboardCategoryChange}
            />
          </div>
          <div className='col-span-4'>
            {/* Announcements */}
            <AnnouncementsCard />
          </div>
      </div>

      {statsError && (
        <div className="text-center text-red-400 mt-4">
          Error loading dashboard: {statsError}
        </div>
      )}
    </div>
  );
});

export default PortalDashboardPage;
