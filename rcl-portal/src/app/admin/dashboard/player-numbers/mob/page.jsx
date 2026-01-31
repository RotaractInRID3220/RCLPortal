'use client';

import { useState } from 'react';
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
  IdCard,
} from 'lucide-react';
import { APP_CONFIG } from '@/config/app.config';

export default function PlayerNumberMobileLookupage() {
  const router = useRouter();
  const [playerNumberQuery, setPlayerNumberQuery] = useState('');
  const [nicQuery, setNicQuery] = useState('');
  const [rmisIdQuery, setRmisIdQuery] = useState('');
  const [loading, setLoading] = useState(null); // Track which field is loading
  const [playerData, setPlayerData] = useState(null);
  const [error, setError] = useState(null);

  // Search for player by specific type
  const handleSearch = async (searchType, query) => {
    if (!query.trim()) {
      toast.error(`Please enter ${searchType === 'playerNumber' ? 'player number' : searchType === 'nic' ? 'NIC' : 'RMIS ID'}`);
      return;
    }

    try {
      setLoading(searchType);
      setError(null);
      setPlayerData(null);

      const response = await fetch(
        `/api/admin/player-numbers/lookup?query=${encodeURIComponent(query)}&searchType=${searchType}&sportDay=${APP_CONFIG.CURRENT_SPORT_DAY}`
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
      setLoading(null);
    }
  };

  // Handle Enter key press for specific field
  const handleKeyPress = (e, searchType, query) => {
    if (e.key === 'Enter') {
      handleSearch(searchType, query);
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
            Search by player number, NIC, or RMIS ID for {APP_CONFIG.CURRENT_SPORT_DAY}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-4">
        {/* Player Number Search */}
        <Card className="bg-cranberry/10 border border-cranberry/40 p-4 backdrop-blur-lg">
          <div className="flex items-center gap-2 mb-3">
            <Hash className="h-5 w-5 text-cranberry" />
            <h2 className="text-lg font-semibold text-white">Player Number</h2>
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="e.g., D-010032"
              value={playerNumberQuery}
              onChange={(e) => {
                setPlayerNumberQuery(e.target.value);
                setError(null);
              }}
              onKeyPress={(e) => handleKeyPress(e, 'playerNumber', playerNumberQuery)}
              disabled={loading !== null}
              className="h-11 bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-cranberry focus:ring-2 focus:ring-cranberry/20 transition-all disabled:opacity-50"
            />
            <Button
              onClick={() => handleSearch('playerNumber', playerNumberQuery)}
              disabled={loading !== null}
              className="h-11 px-4 bg-cranberry hover:bg-cranberry/80 text-white font-semibold transition-all disabled:opacity-50"
            >
              {loading === 'playerNumber' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
            </Button>
          </div>
        </Card>

        {/* NIC Search */}
        <Card className="bg-blue-500/10 border border-blue-500/40 p-4 backdrop-blur-lg">
          <div className="flex items-center gap-2 mb-3">
            <IdCard className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-white">NIC Number</h2>
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="e.g., 200012345678"
              value={nicQuery}
              onChange={(e) => {
                setNicQuery(e.target.value);
                setError(null);
              }}
              onKeyPress={(e) => handleKeyPress(e, 'nic', nicQuery)}
              disabled={loading !== null}
              className="h-11 bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all disabled:opacity-50"
            />
            <Button
              onClick={() => handleSearch('nic', nicQuery)}
              disabled={loading !== null}
              className="h-11 px-4 bg-blue-500 hover:bg-blue-500/80 text-white font-semibold transition-all disabled:opacity-50"
            >
              {loading === 'nic' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
            </Button>
          </div>
        </Card>

        {/* RMIS ID Search */}
        <Card className="bg-purple-500/10 border border-purple-500/40 p-4 backdrop-blur-lg">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">RMIS ID</h2>
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="e.g., RMIS12345"
              value={rmisIdQuery}
              onChange={(e) => {
                setRmisIdQuery(e.target.value);
                setError(null);
              }}
              onKeyPress={(e) => handleKeyPress(e, 'rmisId', rmisIdQuery)}
              disabled={loading !== null}
              className="h-11 bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 transition-all disabled:opacity-50"
            />
            <Button
              onClick={() => handleSearch('rmisId', rmisIdQuery)}
              disabled={loading !== null}
              className="h-11 px-4 bg-purple-500 hover:bg-purple-500/80 text-white font-semibold transition-all disabled:opacity-50"
            >
              {loading === 'rmisId' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
            </Button>
          </div>
        </Card>

        {/* Player Data Card */}
        {playerData && (
          <Card className="bg-white/5 border border-cranberry/30 overflow-hidden backdrop-blur-lg animate-in fade-in">
            {/* Player Info Header */}
            <div className="bg-gradient-to-r from-cranberry/30 to-cranberry/10 border-b border-cranberry/30 p-4">
              {/* Player Name - Featured */}
              <div className="text-center mb-3">
                <p className="text-gray-400 text-xs mb-1">Player Name</p>
                <h3 className="text-white text-xl font-bold">
                  {playerData.player.name || '-'}
                </h3>
              </div>
            </div>

            {/* Player Info */}
            <div className="p-4 space-y-4">
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
            </div>
          </Card>
        )}

        {/* Registered Sports for the Day */}
        {playerData && playerData.sports && playerData.sports.length > 0 && (
          <Card className="bg-white/5 border border-cranberry/30 backdrop-blur-lg overflow-hidden animate-in fade-in">
            <div className="bg-gradient-to-r from-cranberry/20 to-cranberry/5 border-b border-cranberry/30 p-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-cranberry" />
                <div>
                  <h3 className="text-lg font-bold text-white">Registered Sports</h3>
                  <p className="text-gray-400 text-xs">For {APP_CONFIG.CURRENT_SPORT_DAY}</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              {playerData.sports.map((sport, index) => (
                <div 
                  key={index}
                  className="bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-all"
                >
                  {/* Player Number Header */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white font-mono font-bold tracking-wider text-lg">
                      {sport.playerNumber}
                    </p>
                    {sport.isMainPlayer ? (
                      <Badge className="bg-cranberry/20 border-cranberry/40 text-cranberry text-xs">
                        Main Player
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-yellow-500/40 text-yellow-400 bg-yellow-500/10 text-xs">
                        Reserve
                      </Badge>
                    )}
                  </div>
                  
                  {/* Sport Name */}
                  <h4 className="text-white font-semibold mb-2">
                    {sport.name || 'Unknown Sport'}
                  </h4>
                  
                  {/* Sport Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {sport.type && (
                      <Badge variant="outline" className="border-gray-500/40 text-gray-400 bg-gray-500/10 text-xs">
                        {sport.type}
                      </Badge>
                    )}
                    {sport.genderType && (
                      <Badge variant="outline" className="border-gray-500/40 text-gray-400 bg-gray-500/10 text-xs">
                        {sport.genderType}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
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
