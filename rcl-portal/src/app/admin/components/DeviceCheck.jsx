'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

export default function DeviceCheck({ children }) {
  const [isPC, setIsPC] = useState(true); // Default to true for SSR
  const pathname = usePathname();

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

  if (!isPC) {
    return (
      <div className="flex items-center justify-center min-h-screen text-center text-white">
        <div>
          <AlertTriangle className="w-16 h-16 mb-4 text-yellow-500 mx-auto" />
          <h1 className="text-2xl font-bold">Admin - Please access through a PC device.</h1>
        </div>
      </div>
    );
  }

  return children;
}