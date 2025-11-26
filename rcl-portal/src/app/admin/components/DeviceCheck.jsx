'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DeviceCheck({ children }) {
  const [isPC, setIsPC] = useState(true); // Default to true for SSR
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const userAgent = navigator.userAgent;
      const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) || width <= 1024;
      setIsPC(!isMobile);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // Exclude register page from device check
  if (pathname?.startsWith('/admin/dashboard/register')) {
    return children;
  }
  if (pathname?.startsWith('/admin/dashboard/bracket/mob')) {
    return children;
  }
  if (pathname?.startsWith('/admin/dashboard/player-numbers/mob')) {
    return children;
  }

  if (!isPC) {
    return (
      <div className="min-h-screen  flex items-center justify-center p-4">
        <div className="bg-cranberry/10 border border-cranberry rounded-lg p-8 max-w-md w-full text-center">
          <div className="mb-6">
            <AlertTriangle className="w-16 h-16 text-cranberry mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Admin Access</h1>
            <p className="text-white/80 text-sm">
              Please login using a PC device to access other features.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => router.push('/admin/dashboard/bracket/mob')}
              className="bg-cranberry hover:bg-cranberry/80 text-white border border-cranberry/50"
            >
              Scoring Portal
            </Button>
            <Button
              onClick={() => router.push('/admin/dashboard/register')}
              className="bg-cranberry hover:bg-cranberry/80 text-white border border-cranberry/50"
            >
              Registrations Portal
            </Button>
            <Button
              onClick={() => router.push('/admin/dashboard/player-numbers/mob')}
              className="bg-cranberry hover:bg-cranberry/80 text-white border border-cranberry/50"
            >
              Player Lookup
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return children;
}