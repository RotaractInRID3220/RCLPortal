'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAtom } from 'jotai';
import { userDeetsAtom } from '@/app/state/store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Power, 
  PowerOff, 
  Shield, 
  Loader2, 
  Clock,
  User,
  AlertTriangle,
  CheckCircle2,
  Radio
} from 'lucide-react';
import { 
  getPortalStatus, 
  updatePortalStatus, 
  subscribeToPortalStatus 
} from '@/services/configService';

export default function PortalSettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [userDeets] = useAtom(userDeetsAtom);
  
  const [portalStatus, setPortalStatus] = useState({
    isOpen: false,
    updatedBy: null,
    updatedAt: null
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Check if user is super_admin - userDeets comes from club_membership_data table
  const isSuperAdmin = session?.user?.permission_level === 'super_admin' || userDeets?.permission_level === 'super_admin';
  // The RMIS_ID is stored as 'membership_id' in the club_membership_data table
  const userRmisId = userDeets?.card_name || session?.user?.userDeets?.card_name;

  // Fetch initial portal status
  const fetchPortalStatus = useCallback(async () => {
    try {
      setLoading(true);
      const status = await getPortalStatus();
      setPortalStatus(status);
    } catch (error) {
      console.error('Error fetching portal status:', error);
      toast.error('Failed to fetch portal status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortalStatus();
  }, [fetchPortalStatus]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToPortalStatus((newStatus) => {
      setPortalStatus(newStatus);
      toast.info(
        newStatus.isOpen 
          ? 'Portal has been opened by another admin' 
          : 'Portal has been closed by another admin',
        { duration: 4000 }
      );
    });

    return () => unsubscribe();
  }, []);

  // Handle portal toggle
  const handleTogglePortal = async () => {
    if (!isSuperAdmin) {
      toast.error('Only super admins can change portal status');
      return;
    }

    if (!userRmisId) {
      toast.error('User session not found. Please log in again.');
      return;
    }

    try {
      setUpdating(true);
      const newStatus = !portalStatus.isOpen;
      
      const result = await updatePortalStatus(newStatus, userRmisId);
      
      if (result.success) {
        setPortalStatus(result.data);
        toast.success(
          newStatus 
            ? 'Registration portal is now OPEN' 
            : 'Registration portal is now CLOSED',
          {
            description: newStatus 
              ? 'Players can now be registered for the sport day'
              : 'All registration activities have been suspended',
            duration: 5000
          }
        );
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error toggling portal:', error);
      toast.error('Failed to update portal status');
    } finally {
      setUpdating(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  // Redirect if not super_admin
  if (!loading && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/30 rounded-full p-6 mb-6">
          <Shield className="h-16 w-16 text-red-500" />
        </div>
        <h2 className="text-white text-2xl font-bold mb-2">Access Denied</h2>
        <p className="text-gray-400 mb-8 text-center max-w-md">
          Only super admins can access Portal Settings
        </p>
        <Button
          onClick={() => router.push('/admin/dashboard')}
          className="bg-cranberry hover:bg-cranberry/80 px-8"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="relative">
          <Loader2 className="h-16 w-16 text-cranberry animate-spin" />
          <div className="absolute inset-0 h-16 w-16 border-4 border-cranberry/20 rounded-full"></div>
        </div>
        <p className="text-gray-400 mt-6 text-lg">Loading portal settings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:min-h-full flex flex-col p-3 lg:p-0">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/dashboard')}
          className="mb-6 text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="bg-cranberry/20 p-3 rounded-full">
              <Shield className="h-7 w-7 text-cranberry" />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-white">
                Portal Settings
              </h1>
              <p className="text-gray-400">
                Manage registration portal access
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full space-y-6">
        
        {/* Current Status Card */}
        <Card className={`
          overflow-hidden border-2 backdrop-blur-lg shadow-2xl transition-all duration-500
          ${portalStatus.isOpen 
            ? 'bg-green-500/10 border-green-500/40' 
            : 'bg-red-500/10 border-red-500/40'
          }
        `}>
          {/* Status Header */}
          <div className={`
            p-6 border-b transition-colors duration-500
            ${portalStatus.isOpen 
              ? 'bg-green-500/20 border-green-500/30' 
              : 'bg-red-500/20 border-red-500/30'
            }
          `}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`
                  p-4 rounded-full transition-colors duration-500
                  ${portalStatus.isOpen 
                    ? 'bg-green-500/30' 
                    : 'bg-red-500/30'
                  }
                `}>
                  {portalStatus.isOpen ? (
                    <Power className="h-8 w-8 text-green-400" />
                  ) : (
                    <PowerOff className="h-8 w-8 text-red-400" />
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Registration Portal
                  </h2>
                  <p className={`text-sm ${portalStatus.isOpen ? 'text-green-400' : 'text-red-400'}`}>
                    {portalStatus.isOpen ? 'Currently accepting registrations' : 'Registrations are suspended'}
                  </p>
                </div>
              </div>
              
              {/* Live Status Badge */}
              <Badge 
                className={`
                  px-4 py-2 text-sm font-bold animate-pulse
                  ${portalStatus.isOpen 
                    ? 'bg-green-500/30 border-green-500/50 text-green-400' 
                    : 'bg-red-500/30 border-red-500/50 text-red-400'
                  }
                `}
              >
                <Radio className="h-3 w-3 mr-2" />
                {portalStatus.isOpen ? 'OPEN' : 'CLOSED'}
              </Badge>
            </div>
          </div>

          {/* Status Details */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Last Updated */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center text-gray-400 text-sm mb-2">
                  <Clock className="h-4 w-4 mr-2" />
                  <span>Last Updated</span>
                </div>
                <p className="text-white font-semibold">
                  {formatDate(portalStatus.updatedAt)}
                </p>
              </div>

              {/* Updated By */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center text-gray-400 text-sm mb-2">
                  <User className="h-4 w-4 mr-2" />
                  <span>Updated By</span>
                </div>
                <p className="text-white font-mono font-semibold">
                  {portalStatus.updatedBy || 'System'}
                </p>
              </div>
            </div>

            {/* Info Message */}
            <div className={`
              flex items-start gap-3 p-4 rounded-lg border
              ${portalStatus.isOpen 
                ? 'bg-green-500/10 border-green-500/30' 
                : 'bg-yellow-500/10 border-yellow-500/30'
              }
            `}>
              {portalStatus.isOpen ? (
                <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className={`text-sm ${portalStatus.isOpen ? 'text-green-400' : 'text-yellow-400'}`}>
                  {portalStatus.isOpen 
                    ? 'The registration scanner and manual entry are active. Admins can register players for the current sport day.'
                    : 'The registration portal is closed. All scanner and manual entry functions are disabled until the portal is reopened.'
                  }
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Toggle Button Card */}
        <Card className="bg-white/5 border border-cranberry/30 p-6 backdrop-blur-lg">
          <h3 className="text-lg font-semibold text-white mb-4">
            Portal Control
          </h3>
          
          <Button
            onClick={handleTogglePortal}
            disabled={updating}
            className={`
              w-full h-16 text-lg font-bold shadow-xl transition-all cursor-pointer
              ${portalStatus.isOpen 
                ? 'bg-red-500/80 hover:bg-red-500 text-white shadow-red-500/30 hover:shadow-red-500/50' 
                : 'bg-green-500/80 hover:bg-green-500 text-white shadow-green-500/30 hover:shadow-green-500/50'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {updating ? (
              <>
                <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                Updating...
              </>
            ) : portalStatus.isOpen ? (
              <>
                <PowerOff className="mr-3 h-6 w-6" />
                Close Registration Portal
              </>
            ) : (
              <>
                <Power className="mr-3 h-6 w-6" />
                Open Registration Portal
              </>
            )}
          </Button>

          <p className="text-gray-500 text-sm text-center mt-4">
            {portalStatus.isOpen 
              ? 'Closing the portal will immediately disable all registration activities'
              : 'Opening the portal will immediately enable registration activities'
            }
          </p>
        </Card>

        {/* Security Notice */}
        <Card className="bg-cranberry/10 border border-cranberry/30 p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-cranberry mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-white font-semibold text-sm mb-1">Security Notice</h4>
              <p className="text-gray-400 text-xs">
                Portal status changes are logged and broadcast in real-time to all connected clients.
                Only super admins can modify this setting. Changes take effect immediately.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
