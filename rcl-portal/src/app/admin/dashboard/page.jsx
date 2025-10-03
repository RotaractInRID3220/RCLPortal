'use client'
import { 
  loadingAtom, 
  userDeetsAtom, 
  adminDashboardDataAtom,
  adminStatsAtom, 
  adminStatsLoadingAtom, 
  adminStatsErrorAtom,
  adminLeaderboardAtom,
  adminLeaderboardLoadingAtom,
  pendingRequestsAtom,
  lastFetchTimestampAtom,
  isCacheValid
} from '@/app/state/store';
import { useAtom } from 'jotai'
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getOptimizedDashboardData, getLeaderboardPreview } from '@/services/adminServices';
import { toast } from 'sonner';
import StatsCard from '@/components/StatsCard';
import PieStatCard from '@/components/PieStatCard';
import { getRegisteredClubStats } from '@/services/adminClubStatsService';
import LeaderboardPreview from '@/components/LeaderboardPreview';
import AnnouncementsCard from '@/components/AnnouncementsCard';
import PendingRequestsCard from '@/components/PendingRequestsCard';

const AdminDashboardPage = React.memo(() => {
  const [userDeets] = useAtom(userDeetsAtom);
  const [loading] = useAtom(loadingAtom);
  const [dashboardData, setDashboardData] = useAtom(adminDashboardDataAtom);
  const [lastFetchTimestamp, setLastFetchTimestamp] = useAtom(lastFetchTimestampAtom);
  
  // Legacy atoms for backward compatibility
  const [adminStats, setAdminStats] = useAtom(adminStatsAtom);
  const [statsLoading, setStatsLoading] = useAtom(adminStatsLoadingAtom);
  const [statsError, setStatsError] = useAtom(adminStatsErrorAtom);
  const [leaderboardData, setLeaderboardData] = useAtom(adminLeaderboardAtom);
  const [leaderboardLoading, setLeaderboardLoading] = useAtom(adminLeaderboardLoadingAtom);
  const [pendingRequests, setPendingRequests] = useAtom(pendingRequestsAtom);
  
  const [currentLeaderboardCategory, setCurrentLeaderboardCategory] = useState('community');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Memoized values
  const isDataCacheValid = useMemo(() => {
    return isCacheValid(lastFetchTimestamp.adminDashboard, 'adminDashboard');
  }, [lastFetchTimestamp.adminDashboard]);

  const displayStats = useMemo(() => ({
    totalClubs: statsLoading ? 0 : adminStats.totalClubs,
    totalPlayers: statsLoading ? 0 : adminStats.totalPlayers,
    instituteClubs: statsLoading ? 0 : adminStats.instituteClubs,
    communityClubs: statsLoading ? 0 : adminStats.communityClubs
  }), [statsLoading, adminStats]);

  // Pie stats for registered/total clubs
  const [pieStats, setPieStats] = useState({ community: { registered: 0, total: 0 }, institute: { registered: 0, total: 0 } });
  const [pieStatsLoading, setPieStatsLoading] = useState(true);
  
  useEffect(() => {
    setPieStatsLoading(true);
    getRegisteredClubStats()
      .then(setPieStats)
      .catch(() => {})
      .finally(() => setPieStatsLoading(false));
  }, []);

  // Optimized data fetching with smart caching
  const fetchOptimizedDashboardData = useCallback(async (forceRefresh = false) => {
    try {
      // Check cache validity unless forcing refresh
      if (!forceRefresh && isDataCacheValid && dashboardData.stats.totalClubs > 0) {
        console.log('Using cached admin dashboard data');
        return;
      }

      setStatsLoading(true);
      setLeaderboardLoading(true);
      setStatsError(null);

      // Single optimized API call
      const data = await getOptimizedDashboardData(currentLeaderboardCategory, 10);
      
      // Update all data at once
      setDashboardData(data);
      setLastFetchTimestamp(prev => ({
        ...prev,
        adminDashboard: Date.now()
      }));

      // Update legacy atoms for backward compatibility
      setAdminStats(data.stats);
      setLeaderboardData(data.leaderboard);
      setPendingRequests(data.pendingRequests);

    } catch (error) {
      console.error('Error fetching optimized dashboard data:', error);
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
  }, [isDataCacheValid, dashboardData.stats.totalClubs, currentLeaderboardCategory, setDashboardData, setLastFetchTimestamp, setAdminStats, setLeaderboardData, setPendingRequests, setStatsLoading, setLeaderboardLoading, setStatsError]);

  // Handles leaderboard category filter changes
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
    if (!loading && userDeets) {
      fetchOptimizedDashboardData();
    }
  }, [loading, userDeets, fetchOptimizedDashboardData]);

  // Smart background refresh - only when cache is invalid
  useEffect(() => {
    if (!loading && userDeets && !isDataCacheValid) {
      const interval = setInterval(() => {
        fetchOptimizedDashboardData();
      }, 60000); // 60 seconds

      return () => clearInterval(interval);
    }
  }, [loading, userDeets, isDataCacheValid, fetchOptimizedDashboardData]);

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
            Welcome Back👋 <span className='font-semibold'>{userDeets?.card_name || 'Admin'}</span>
          </h1>
        </div>
      </div>

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-12 gap-6 h-full">
        
        {/* Left Column - Statistics */}
        <div className="col-span-8">
          <div className="grid grid-cols-2 gap-6 mb-6">
            {/* Top Row - Main Stats */}
            <StatsCard 
              title="Total Registered Clubs" 
              value={displayStats.totalClubs}
              indicatorColor="bg-cranberry"
              showIndicator={true}
            />
            <StatsCard 
              title="Total Registered Players" 
              value={displayStats.totalPlayers}
              indicatorColor="bg-cranberry"
              showIndicator={true}
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Bottom Row - Club Categories as PieStatCard */}
            <PieStatCard
              title="Institute based clubs"
              registered={pieStats.institute.registered}
              total={pieStats.institute.total}
              color="blue"
              loading={pieStatsLoading}
            />
            <PieStatCard
              title="Community based clubs"
              registered={pieStats.community.registered}
              total={pieStats.community.total}
              color="cranberry"
              loading={pieStatsLoading}
            />
          </div>

          {/* Leaderboard Section */}
          <div className="mt-6">
            <LeaderboardPreview 
              leaderboardData={leaderboardData} 
              onCategoryChange={handleLeaderboardCategoryChange}
            />
          </div>
        </div>

        {/* Right Column - Announcements & Pending Requests */}
        <div className="col-span-4 space-y-6">
          
          {/* Pending Requests Card */}
          <PendingRequestsCard count={pendingRequests} />
          
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

export default AdminDashboardPage;
