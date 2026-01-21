'use client';

import { use, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPlayerVerificationData, generatePlayerNumber } from '@/services/playerService';
import { registerPlayerForDay } from '@/services/dayRegistrationService';
import { getPortalStatus, subscribeToPortalStatus } from '@/services/configService';
import { APP_CONFIG, SPORT_DAYS } from '@/config/app.config';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Building2, CreditCard, CheckCircle2, AlertCircle, Loader2, Trophy, Calendar, XCircle } from 'lucide-react';

export default function PlayerVerificationPage({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const rmisId = unwrappedParams.rmisId;

  const [player, setPlayer] = useState(null);
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  
  // Portal status state
  const [portalStatus, setPortalStatus] = useState({ isOpen: true, updatedBy: null, updatedAt: null });
  const [portalLoading, setPortalLoading] = useState(true);

  // Fetch portal status
  const fetchPortalStatus = useCallback(async () => {
    try {
      setPortalLoading(true);
      const status = await getPortalStatus();
      setPortalStatus(status);
      
      // If portal is closed, redirect back with message
      if (!status.isOpen) {
        toast.error('Registration portal is closed', {
          description: 'Redirecting to scanner...',
          duration: 3000
        });
        setTimeout(() => router.push('/admin/dashboard/register'), 2000);
      }
    } catch (error) {
      console.error('Error fetching portal status:', error);
      setPortalStatus({ isOpen: false, updatedBy: null, updatedAt: null });
    } finally {
      setPortalLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchPortalStatus();
  }, [fetchPortalStatus]);

  // Subscribe to real-time portal status changes
  useEffect(() => {
    const unsubscribe = subscribeToPortalStatus((newStatus) => {
      setPortalStatus(newStatus);
      
      if (!newStatus.isOpen) {
        toast.error('Registration portal has been closed', {
          description: 'Registration is no longer available',
          duration: 5000
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (rmisId && !portalLoading && portalStatus.isOpen) {
      loadPlayerData();
    }
  }, [rmisId, portalLoading, portalStatus.isOpen]);

  // Fetches player data, sports, and registration status - OPTIMIZED (1 API call instead of 3)
  const loadPlayerData = async () => {
    try {
      setLoading(true);
      
      // Single optimized API call that fetches all data at once
      const verificationData = await getPlayerVerificationData(rmisId, APP_CONFIG.CURRENT_SPORT_DAY);

      setPlayer(verificationData.player);
      setSports(verificationData.sports);
      setIsAlreadyRegistered(verificationData.registration.isRegistered);

    } catch (error) {
      console.error('Error loading player:', error);
      toast.error('Failed to load player details');
      router.push('/admin/dashboard/register');
    } finally {
      setLoading(false);
    }
  };

  // Handles player registration approval
  const handleApprove = async () => {
    // Double-check portal status before registration
    if (!portalStatus.isOpen) {
      toast.error('Registration portal is closed', {
        description: 'Cannot complete registration'
      });
      return;
    }
    
    try {
      setRegistering(true);

      await registerPlayerForDay(rmisId, APP_CONFIG.CURRENT_SPORT_DAY);
      
      toast.success(`${player.name} registered successfully!`, {
        description: `Registered for ${APP_CONFIG.CURRENT_SPORT_DAY}`
      });
      
      router.push('/admin/dashboard/register');

    } catch (error) {
      console.error('Error registering player:', error);
      
      if (error.message.includes('already registered')) {
        toast.error('Player is already registered for this day');
        setIsAlreadyRegistered(true);
      } else {
        toast.error('Failed to register player');
      }
    } finally {
      setRegistering(false);
    }
  };

  // Show loading state while checking portal status or loading player
  if (portalLoading || loading) {
    return (
      <div className="min-h-screen w-screen flex flex-col items-center justify-center p-4">
        <div className="relative">
          <Loader2 className="h-16 w-16 text-cranberry animate-spin" />
          <div className="absolute inset-0 h-16 w-16 border-4 border-cranberry/20 rounded-full"></div>
        </div>
        <p className="text-gray-400 mt-6 text-lg">
          {portalLoading ? 'Checking portal status...' : 'Loading player details...'}
        </p>
      </div>
    );
  }

  // Show portal closed message
  if (!portalStatus.isOpen) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-full p-6 mb-6">
          <XCircle className="h-16 w-16 text-red-500" />
        </div>
        <h2 className="text-white text-2xl font-bold mb-2">Portal Closed</h2>
        <p className="text-gray-400 mb-8 text-center max-w-md">
          The registration portal is currently closed. Please contact a super admin to enable registrations.
        </p>
        <Button
          onClick={() => router.push('/admin/dashboard/register')}
          className="bg-cranberry hover:bg-cranberry/80 px-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Scanner
        </Button>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-full p-6 mb-6">
          <AlertCircle className="h-16 w-16 text-red-500" />
        </div>
        <h2 className="text-white text-2xl font-bold mb-2">Player Not Found</h2>
        <p className="text-gray-400 mb-8 text-center max-w-md">
          The RMIS ID <span className="font-mono text-white">{rmisId}</span> does not exist in the system
        </p>
        <Button
          onClick={() => router.push('/admin/dashboard/register')}
          className="bg-cranberry hover:bg-cranberry/80 px-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Scanner
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col ">
      {/* Header */}
      <div className="">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/dashboard/register')}
          className="mb-6 text-white hover:bg-white/10 transition-all border border-white/40"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Scanner
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-start justify-center">
        <div className="w-full max-w-2xl lg:max-w-full space-y-6">
          
          {/* Player Details Card */}
          <Card className="bg-white/5 border border-cranberry/30 backdrop-blur-lg shadow-2xl overflow-hidden">
            {/* Header with Sport Day Badge */}
            <div className="bg-gradient-to-r from-cranberry/30 to-cranberry/10 border-b border-cranberry/30 p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-3xl font-bold text-white mb-1">Player Verification</h2>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Sport Day: {APP_CONFIG.CURRENT_SPORT_DAY}</span>
                  </div>
                </div>
                
                {/* Registration Status Badge */}
                {isAlreadyRegistered && (
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-full">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    <span className="text-green-400 font-semibold">Registered</span>
                  </div>
                )}
              </div>
            </div>

            {/* Player Info */}
            <div className="p-6 lg:p-8 space-y-6">
              
              {/* Player Name - Featured */}
              <div className="bg-cranberry/10 border border-cranberry/30 rounded-xl p-6 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-cranberry/20 rounded-full mb-4">
                  <User className="h-8 w-8 text-cranberry" />
                </div>
                <p className="text-gray-400 text-sm mb-2">Player Name</p>
                <h3 className="text-white text-3xl font-bold">
                  {player.name || '-'}
                </h3>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* RMIS ID */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center text-gray-400 text-sm mb-2">
                    <CreditCard className="h-4 w-4 mr-2" />
                    <span>RMIS ID</span>
                  </div>
                  <p className="text-white text-lg font-mono font-semibold">
                    {player.RMIS_ID || '-'}
                  </p>
                </div>

                {/* NIC */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center text-gray-400 text-sm mb-2">
                    <CreditCard className="h-4 w-4 mr-2" />
                    <span>NIC</span>
                  </div>
                  <p className="text-white text-lg font-mono font-semibold">
                    {player.NIC || '-'}
                  </p>
                </div>
              </div>

              {/* Club Name and Player Number Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Player Number for Current Sport Day */}
                {sports.length > 0 && sports[0]?.id && (
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center text-gray-400 text-sm mb-2">
                      <Trophy className="h-4 w-4 mr-2" />
                      <span>Player Number</span>
                    </div>
                    <p className="text-white text-lg font-mono font-bold tracking-wider">
                      {generatePlayerNumber(sports[0]?.events?.sport_day, sports[0]?.id) || '-'}
                    </p>
                  </div>
                )}
                {/* Club Name */}
                <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-center text-gray-400 text-sm mb-2">
                    <Building2 className="h-4 w-4 mr-2" />
                    <span>Club</span>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-white text-lg font-semibold">
                      {player.clubs?.club_name || '-'}
                    </p>
                    {player.clubs?.category && (
                      <Badge 
                        variant="outline" 
                        className={`${
                          player.clubs.category === 'community' 
                            ? 'border-blue-500/40 text-blue-400 bg-blue-500/10' 
                            : 'border-purple-500/40 text-purple-400 bg-purple-500/10'
                        } text-xs`}
                      >
                        {player.clubs.category}
                      </Badge>
                    )}
                  </div>
                </div>


              </div>
            </div>
          </Card>

          {/* Sports for the Day */}
          {sports.length > 0 && (
            <Card className="bg-white/5 border border-cranberry/30 backdrop-blur-lg shadow-2xl">
              <div className="bg-gradient-to-r from-cranberry/20 to-cranberry/5 border-b border-cranberry/30 p-6">
                <div className="flex items-center gap-3">
                  <div className="bg-cranberry/20 p-2 rounded-lg">
                    <Trophy className="h-6 w-6 text-cranberry" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Registered Sports</h3>
                    <p className="text-gray-400 text-sm">For {APP_CONFIG.CURRENT_SPORT_DAY}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 space-y-3">
                {sports.map((sport, index) => {
                  const playerNumber = generatePlayerNumber(sport.events?.sport_day, sport.id);
                  return (
                    <div 
                      key={index}
                      className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-all"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <div className="flex-1">
                          <h4 className="text-white font-semibold text-lg mb-1">
                            {sport.events?.sport_name || 'Unknown Sport'}
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            {sport.events?.sport_type && (
                              <Badge variant="outline" className="border-gray-500/40 text-gray-400 bg-gray-500/10 text-xs">
                                {sport.events.sport_type}
                              </Badge>
                            )}
                            {sport.events?.gender_type && (
                              <Badge variant="outline" className="border-gray-500/40 text-gray-400 bg-gray-500/10 text-xs">
                                {sport.events.gender_type}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {sport.main_player && (
                          <Badge className="bg-cranberry/20 border-cranberry/40 text-cranberry">
                            Main Player
                          </Badge>
                        )}
                      </div>
                      
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* No Sports Message */}
          {sports.length === 0 && (
            <Card className="bg-white/5 border border-yellow-500/30 backdrop-blur-lg p-6">
              <div className="flex items-center gap-3 text-yellow-400">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">
                  No sports registered for {APP_CONFIG.CURRENT_SPORT_DAY}
                </p>
              </div>
            </Card>
          )}

          {/* Portal Closed Warning */}
          {!portalStatus.isOpen && (
            <Card className="bg-red-500/20 border-2 border-red-500/50 p-6">
              <div className="flex items-center gap-4">
                <XCircle className="h-8 w-8 text-red-400 flex-shrink-0" />
                <div>
                  <h3 className="text-red-400 font-bold text-lg">Portal Closed</h3>
                  <p className="text-red-300/80 text-sm">Registration is currently disabled</p>
                </div>
              </div>
            </Card>
          )}

          {/* Approve Button */}
          <Button
            onClick={handleApprove}
            disabled={registering || isAlreadyRegistered || !portalStatus.isOpen}
            className={`w-full h-16 text-xl font-bold shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none ${
              !portalStatus.isOpen 
                ? 'bg-red-500/30 text-red-300' 
                : 'bg-cranberry hover:bg-cranberry/80 text-white shadow-cranberry/30 hover:shadow-cranberry/50'
            }`}
          >
            {registering ? (
              <>
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                Registering...
              </>
            ) : !portalStatus.isOpen ? (
              <>
                <XCircle className="mr-3 h-6 w-6" />
                Portal Closed
              </>
            ) : isAlreadyRegistered ? (
              <>
                <CheckCircle2 className="mr-3 h-6 w-6" />
                Already Registered
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-3 h-6 w-6" />
                Approve Registration
              </>
            )}
          </Button>

          {/* Info Text */}
          {!isAlreadyRegistered && (
            <p className="text-center text-gray-500 text-sm">
              This will register <span className="text-white font-semibold">{player.name}</span> for <span className="text-cranberry font-semibold">{APP_CONFIG.CURRENT_SPORT_DAY}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
