'use client'
import { loadingAtom, userDeetsAtom } from '@/app/state/store';
import { useAtom } from 'jotai'
import React, { useState, useEffect, useCallback } from 'react'
import { getOptimizedDashboardData } from '@/services/adminServices';
import { toast } from 'sonner';
import StatsCard from '@/components/StatsCard';
import PieStatCard from '@/components/PieStatCard';
import LeaderboardPreview from '@/components/LeaderboardPreview';
import AnnouncementsCard from '@/components/AnnouncementsCard';
import PendingRequestsCard from '@/components/PendingRequestsCard';
import { AdminLiveSummary } from '@/components/LiveSummary';

const REFRESH_MS = 30000; // live numbers: always re-read from the server, never reuse an old copy

const AdminDashboardPage = React.memo(() => {
  const [userDeets] = useAtom(userDeetsAtom);
  const [loading] = useAtom(loadingAtom);
  const [data, setData] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [category, setCategory] = useState('community');

  const load = useCallback(async (cat, { quiet = true } = {}) => {
    try {
      setData(await getOptimizedDashboardData(cat, 10));
      setStatsError(null);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setStatsError(error.message);
      if (!quiet) toast.error('Failed to load dashboard data');
    }
  }, []);

  useEffect(() => {
    if (loading || !userDeets) return;
    load(category, { quiet: false });
    const interval = setInterval(() => load(category), REFRESH_MS);
    return () => clearInterval(interval);
  }, [loading, userDeets, category, load]);

  const stats = data?.stats;
  const pieStats = stats?.registeredClubs ?? { community: { registered: 0, total: 0 }, institute: { registered: 0, total: 0 } };
  const pieStatsLoading = !stats;
  const leaderboardData = data?.leaderboard ?? [];
  const pendingRequests = data?.pendingRequests ?? 0;
  const pendingReplacements = stats?.pendingReplacements ?? 0;
  const pendingSwaps = stats?.pendingSwaps ?? 0;
  const displayStats = { totalClubs: stats?.totalClubs ?? 0, totalPlayers: stats?.totalPlayers ?? 0 };

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
              title="Total Clubs" 
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
              onCategoryChange={setCategory}
            />
          </div>
        </div>

        {/* Right Column - Announcements & Pending Requests */}
        <div className="col-span-4 space-y-6">
          
          {/* Pending Requests Card */}
          <PendingRequestsCard count={pendingRequests} replacements={pendingReplacements} swaps={pendingSwaps} />
          
          {/* Announcements */}
          <AnnouncementsCard showNames />
        </div>
      </div>

      {data && (
        <div className="mt-6">
          <AdminLiveSummary payments={data.payments} checkin={data.checkin} membership={data.membership} />
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

export default AdminDashboardPage;
