'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { QrCode, Search, ArrowLeft, ScanLine, XCircle, Loader2 } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { getPortalStatus, subscribeToPortalStatus } from '@/services/configService';

export default function RegisterPage() {
  const router = useRouter();
  const [rmisId, setRmisId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);
  
  // Portal status state
  const [portalStatus, setPortalStatus] = useState({ isOpen: true, updatedBy: null, updatedAt: null });
  const [portalLoading, setPortalLoading] = useState(true);

  // Fetch portal status on mount
  const fetchPortalStatus = useCallback(async () => {
    try {
      setPortalLoading(true);
      const status = await getPortalStatus();
      setPortalStatus(status);
    } catch (error) {
      console.error('Error fetching portal status:', error);
      // Default to closed for security
      setPortalStatus({ isOpen: false, updatedBy: null, updatedAt: null });
    } finally {
      setPortalLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortalStatus();
  }, [fetchPortalStatus]);

  // Subscribe to real-time portal status changes
  useEffect(() => {
    const unsubscribe = subscribeToPortalStatus((newStatus) => {
      setPortalStatus(newStatus);
      
      // Stop scanner if portal closes
      if (!newStatus.isOpen && html5QrcodeScannerRef.current) {
        html5QrcodeScannerRef.current.clear().catch(console.error);
        html5QrcodeScannerRef.current = null;
        setScanning(false);
      }
      
      toast.info(
        newStatus.isOpen 
          ? 'Registration portal is now OPEN' 
          : 'Registration portal has been CLOSED',
        { duration: 5000 }
      );
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Check if device is mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Auto-start camera on mobile ONLY if portal is open
    if (isMobile && !scanning && portalStatus.isOpen && !portalLoading) {
      startScanning();
    }

    return () => {
      if (html5QrcodeScannerRef.current) {
        html5QrcodeScannerRef.current.clear().catch(console.error);
      }
    };
  }, [isMobile, portalStatus.isOpen, portalLoading]);

  // Handles QR code scan success
  const onScanSuccess = (decodedText) => {
    try {
      // Extract RMIS ID from URL
      const url = new URL(decodedText);
      const pathParts = url.pathname.split('/');
      const scannedRmisId = pathParts[pathParts.length - 1];
      
      if (scannedRmisId) {
        // Stop scanner before navigation
        if (html5QrcodeScannerRef.current) {
          html5QrcodeScannerRef.current.clear().catch(console.error);
        }
        router.push(`/admin/dashboard/register/player/${scannedRmisId}`);
      } else {
        toast.error('Invalid QR code format');
      }
    } catch (error) {
      toast.error('Invalid QR code');
    }
  };

  // Starts QR scanner
  const startScanning = () => {
    if (scannerRef.current && !html5QrcodeScannerRef.current) {
      setScanning(true);
      
      html5QrcodeScannerRef.current = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
        },
        false
      );

      html5QrcodeScannerRef.current.render(onScanSuccess, (error) => {
        // Silent error handling for continuous scanning
      });
    }
  };

  // Handles manual RMIS ID search
  const handleSearch = () => {
    // Check portal status before allowing search
    if (!portalStatus.isOpen) {
      toast.error('Registration portal is closed', {
        description: 'Please contact a super admin to open the portal'
      });
      return;
    }
    
    if (!rmisId.trim()) {
      toast.error('Please enter RMIS ID');
      return;
    }

    router.push(`/admin/dashboard/register/player/${rmisId.trim()}`);
  };

  // Handles Enter key press in input
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Show loading state while checking portal status
  if (portalLoading) {
    return (
      <div className="min-h-screen lg:min-h-full flex flex-col items-center justify-center p-3 lg:p-0">
        <div className="relative">
          <Loader2 className="h-16 w-16 text-cranberry animate-spin" />
          <div className="absolute inset-0 h-16 w-16 border-4 border-cranberry/20 rounded-full"></div>
        </div>
        <p className="text-gray-400 mt-6 text-lg">Checking portal status...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen lg:min-h-full flex flex-col p-3 lg:p-0">
      {/* Portal Closed Banner */}
      {!portalStatus.isOpen && (
        <div className="mb-6 bg-red-500/20 border-2 border-red-500/50 rounded-xl p-6 backdrop-blur-lg animate-pulse">
          <div className="flex items-center justify-center gap-4">
            <div className="bg-red-500/30 p-3 rounded-full">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-red-400">Registration Portal Closed</h2>
              <p className="text-red-300/80 text-sm mt-1">
                Contact a super admin to open the registration portal
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 ">
        <Button
          variant="ghost"
          onClick={() => router.push('/admin/dashboard')}
          className="mb-6 text-white hover:bg-white/10 transition-all"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="text-center space-y-2">
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-3">
            Player Registration
          </h1>
          <p className="text-gray-400 text-lg">
            {!portalStatus.isOpen 
              ? 'Registration is currently disabled' 
              : isMobile 
                ? 'Scan QR code or enter RMIS ID' 
                : 'Enter RMIS ID to register player'
            }
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full gap-8 ${!portalStatus.isOpen ? 'opacity-50 pointer-events-none' : ''}`}>
        
        {/* QR Scanner - Mobile Only */}
        {isMobile && (
          <Card className={`w-full bg-white/5 border p-8 backdrop-blur-lg shadow-2xl animate-fade-in ${!portalStatus.isOpen ? 'border-red-500/30' : 'border-cranberry/30'}`}>
            <div className="flex items-center justify-center mb-6">
              <div className={`p-3 rounded-full mr-3 ${!portalStatus.isOpen ? 'bg-red-500/20' : 'bg-cranberry/20'}`}>
                <ScanLine className={`h-7 w-7 ${!portalStatus.isOpen ? 'text-red-400' : 'text-cranberry'}`} />
              </div>
              <h2 className="text-2xl font-bold text-white">Scan QR Code</h2>
            </div>
            
            {portalStatus.isOpen ? (
              <>
                <div 
                  ref={scannerRef}
                  id="qr-reader" 
                  className="w-full rounded-xl overflow-hidden border-2 border-cranberry/20"
                ></div>
                
                {scanning && (
                  <div className="mt-6 text-center space-y-2">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-cranberry/10 border border-cranberry/30 rounded-full">
                      <div className="w-2 h-2 bg-cranberry rounded-full animate-pulse"></div>
                      <p className="text-cranberry font-medium text-sm">Scanner Active</p>
                    </div>
                    <p className="text-gray-400 text-sm">
                      Position the QR code within the frame
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-64 rounded-xl border-2 border-red-500/20 bg-red-500/5 flex items-center justify-center">
                <div className="text-center">
                  <XCircle className="h-16 w-16 text-red-400/50 mx-auto mb-4" />
                  <p className="text-red-400/80 font-medium">Scanner Disabled</p>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Divider - Mobile Only */}
        {isMobile && (
          <div className="flex items-center w-full">
            <div className="flex-1 border-t border-white/10"></div>
            <span className="px-6 text-gray-500 text-sm font-medium">OR</span>
            <div className="flex-1 border-t border-white/10"></div>
          </div>
        )}

        {/* Manual RMIS Input */}
        <Card className={`w-full p-8 backdrop-blur-lg shadow-2xl ${!portalStatus.isOpen ? 'bg-red-500/10 border-2 border-red-500/40' : 'bg-cranberry/10 border border-cranberry/40'}`}>
          <div className="flex items-center justify-center mb-6">
            <div className={`p-3 rounded-full mr-3 ${!portalStatus.isOpen ? 'bg-red-500/20' : 'bg-cranberry/20'}`}>
              <Search className={`h-7 w-7 ${!portalStatus.isOpen ? 'text-red-400' : 'text-cranberry'}`} />
            </div>
            <h2 className="text-2xl font-bold text-white">Manual Entry</h2>
          </div>

          <div className="space-y-4">
            <Input
              type="text"
              placeholder={portalStatus.isOpen ? "Enter RMIS ID (e.g., RID3220-12345)" : "Portal is closed"}
              value={rmisId}
              onChange={(e) => setRmisId(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!portalStatus.isOpen}
              className={`h-14 text-lg transition-all ${
                !portalStatus.isOpen 
                  ? 'bg-red-500/5 border-red-500/30 text-red-300 placeholder:text-red-400/50 cursor-not-allowed' 
                  : 'bg-white/5 border-white/20 text-white placeholder:text-gray-500 focus:border-cranberry focus:ring-2 focus:ring-cranberry/20'
              }`}
            />
            <Button
              onClick={handleSearch}
              disabled={!portalStatus.isOpen}
              className={`w-full h-14 text-lg font-semibold shadow-lg transition-all ${
                !portalStatus.isOpen
                  ? 'bg-red-500/30 text-red-300 cursor-not-allowed shadow-none'
                  : 'cursor-pointer bg-cranberry/80 hover:bg-cranberry text-white shadow-cranberry/20 hover:shadow-lg hover:shadow-cranberry/30'
              }`}
            >
              {portalStatus.isOpen ? (
                <>
                  <Search className="mr-2 h-5 w-5" />
                  Search Player
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-5 w-5" />
                  Portal Closed
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Info Card */}
        <div className="mt-4 text-center max-w-xl">
          <p className={`text-sm leading-relaxed ${!portalStatus.isOpen ? 'text-red-400/60' : 'text-gray-500'}`}>
            {!portalStatus.isOpen 
              ? 'The registration portal is currently closed. Please contact a super admin to enable registrations.'
              : isMobile 
                ? 'Use the camera to scan player QR codes or manually enter their RMIS ID below to register them for the current sport day.'
                : 'Enter the player\'s RMIS ID to verify their details and register them for the current sport day.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
