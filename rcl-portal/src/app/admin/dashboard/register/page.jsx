'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { QrCode, Search, ArrowLeft, ScanLine } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function RegisterPage() {
  const router = useRouter();
  const [rmisId, setRmisId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const scannerRef = useRef(null);
  const html5QrcodeScannerRef = useRef(null);

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
    // Auto-start camera on mobile
    if (isMobile && !scanning) {
      startScanning();
    }

    return () => {
      if (html5QrcodeScannerRef.current) {
        html5QrcodeScannerRef.current.clear().catch(console.error);
      }
    };
  }, [isMobile]);

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

  return (
    <div className="min-h-screen lg:min-h-full flex flex-col p-3 lg:p-0">
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
            {isMobile ? 'Scan QR code or enter RMIS ID' : 'Enter RMIS ID to register player'}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto w-full gap-8">
        
        {/* QR Scanner - Mobile Only */}
        {isMobile && (
          <Card className="w-full bg-white/5 border border-cranberry/30 p-8 backdrop-blur-lg shadow-2xl animate-fade-in">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-cranberry/20 p-3 rounded-full mr-3">
                <ScanLine className="h-7 w-7 text-cranberry" />
              </div>
              <h2 className="text-2xl font-bold text-white">Scan QR Code</h2>
            </div>
            
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
        <Card className="w-full bg-cranberry/10 border border-cranberry/40 p-8 backdrop-blur-lg shadow-2xl">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-cranberry/20 p-3 rounded-full mr-3">
              <Search className="h-7 w-7 text-cranberry" />
            </div>
            <h2 className="text-2xl font-bold text-white">Manual Entry</h2>
          </div>

          <div className="space-y-4">
            <Input
              type="text"
              placeholder="Enter RMIS ID (e.g., RID3220-12345)"
              value={rmisId}
              onChange={(e) => setRmisId(e.target.value)}
              onKeyPress={handleKeyPress}
              className="h-14 bg-white/5 border-white/20 text-white text-lg placeholder:text-gray-500 focus:border-cranberry focus:ring-2 focus:ring-cranberry/20 transition-all"
            />
            <Button
              onClick={handleSearch}
              className="w-full h-14 cursor-pointer bg-cranberry/80 hover:bg-cranberry text-white text-lg font-semibold shadow-lg shadow-cranberry/20 transition-all hover:shadow-lg hover:shadow-cranberry/30"
            >
              <Search className="mr-2 h-5 w-5" />
              Search Player
            </Button>
          </div>
        </Card>

        {/* Info Card */}
        <div className="mt-4 text-center max-w-xl">
          <p className="text-gray-500 text-sm leading-relaxed">
            {isMobile 
              ? 'Use the camera to scan player QR codes or manually enter their RMIS ID below to register them for the current sport day.'
              : 'Enter the player\'s RMIS ID to verify their details and register them for the current sport day.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
