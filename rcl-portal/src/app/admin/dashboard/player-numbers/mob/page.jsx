'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Search,
  Hash,
  User,
  Building2,
  CreditCard,
  Trophy,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { APP_CONFIG } from '@/config/app.config';

export default function PlayerNumberMobileLookupage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [playerData, setPlayerData] = useState(null);
  const [error, setError] = useState(null);

  // Search for player by number or RMIS ID
  const handleSearch = async (query = searchQuery) => {
    if (!query.trim()) {
      toast.error('Please enter player number or RMIS ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setPlayerData(null);

      const response = await fetch(
        `/api/admin/player-numbers/lookup?query=${encodeURIComponent(query)}&sportDay=${APP_CONFIG.CURRENT_SPORT_DAY}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch player data');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Player not found');
      }

      setPlayerData(result.data);
      toast.success('Player found!');
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Error fetching player data');
      toast.error(err.message || 'Player not found');
    } finally {
      setLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4 pb-6">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/dashboard/player-numbers')}
          className="mb-4 text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Hash className="h-8 w-8 text-cranberry" />
            Player Lookup
          </h1>
          <p className="text-gray-400 text-sm">
            Search by player number or RMIS ID for {APP_CONFIG.CURRENT_SPORT_DAY}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Manual Search Card */}
        <Card className="bg-cranberry/10 border border-cranberry/40 p-6 backdrop-blur-lg">
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-5 w-5 text-cranberry" />
            <h2 className="text-xl font-semibold text-white">Manual Search</h2>
          </div>

          <div className="space-y-3">
            <Input
              type="text"
              placeholder="Enter player number (D-010032) or RMIS ID"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setError(null);
              }}
              onKeyPress={handleKeyPress}
              disabled={loading}
              className="h-12 bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-cranberry focus:ring-2 focus:ring-cranberry/20 transition-all disabled:opacity-50"
            />
            <Button
              onClick={() => handleSearch()}
              disabled={loading}
              className="w-full h-12 bg-cranberry hover:bg-cranberry/80 text-white font-semibold transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-5 w-5" />
                  Search
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Player Data Card */}
        {playerData && (
          <Card className="bg-white/5 border border-cranberry/30 overflow-hidden backdrop-blur-lg animate-in fade-in">
            {/* Player Number Header */}
            <div className="bg-gradient-to-r from-cranberry/30 to-cranberry/10 border-b border-cranberry/30 p-4">
              <p className="text-gray-400 text-xs mb-1">Player Number</p>
              <p className="text-white text-2xl font-mono font-bold tracking-wider">
                {playerData.playerNumber}
              </p>
            </div>

            {/* Player Info */}
            <div className="p-4 space-y-4">
              {/* Player Name */}
              <div className="bg-cranberry/10 border border-cranberry/30 rounded-lg p-3 text-center">
                <p className="text-gray-400 text-xs mb-2">Player Name</p>
                <h3 className="text-white text-xl font-bold">
                  {playerData.player.name || '-'}
                </h3>
              </div>

              {/* Details Grid */}
              <div className="space-y-3">
                {/* RMIS ID */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center text-gray-400 text-xs mb-1">
                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                    <span>RMIS ID</span>
                  </div>
                  <p className="text-white text-sm font-mono font-semibold">
                    {playerData.player.RMIS_ID || '-'}
                  </p>
                </div>

                {/* NIC */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center text-gray-400 text-xs mb-1">
                    <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                    <span>NIC</span>
                  </div>
                  <p className="text-white text-sm font-mono font-semibold">
                    {playerData.player.NIC || '-'}
                  </p>
                </div>

                {/* Club */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                  <div className="flex items-center text-gray-400 text-xs mb-1">
                    <Building2 className="h-3.5 w-3.5 mr-1.5" />
                    <span>Club</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-semibold">
                      {playerData.player.club?.club_name || '-'}
                    </p>
                    {playerData.player.club?.category && (
                      <Badge
                        variant="outline"
                        className={`${
                          playerData.player.club.category === 'community'
                            ? 'border-blue-500/40 text-blue-400 bg-blue-500/10'
                            : 'border-purple-500/40 text-purple-400 bg-purple-500/10'
                        } text-xs`}
                      >
                        {playerData.player.club.category}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Sport Info */}
              <div className="bg-gradient-to-r from-cranberry/10 to-transparent border border-cranberry/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-4 w-4 text-cranberry" />
                  <p className="text-gray-400 text-xs font-semibold">Sport</p>
                </div>
                <p className="text-white text-sm font-semibold mb-2">
                  {playerData.sport.name || 'Unknown'}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {playerData.sport.type && (
                    <Badge
                      variant="outline"
                      className="border-gray-500/40 text-gray-400 bg-gray-500/10 text-xs"
                    >
                      {playerData.sport.type}
                    </Badge>
                  )}
                  {playerData.sport.genderType && (
                    <Badge
                      variant="outline"
                      className="border-gray-500/40 text-gray-400 bg-gray-500/10 text-xs"
                    >
                      {playerData.sport.genderType}
                    </Badge>
                  )}
                  {playerData.registration.isMainPlayer && (
                    <Badge className="bg-cranberry/20 border-cranberry/40 text-cranberry text-xs">
                      Main Player
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Error Card */}
        {error && (
          <Card className="bg-red-500/10 border border-red-500/30 p-4 backdrop-blur-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-400 font-semibold text-sm">Not Found</p>
                <p className="text-red-300/80 text-xs mt-1">{error}</p>
              </div>
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
