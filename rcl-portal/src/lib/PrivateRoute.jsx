"use client";
import { loadingAtom, userDeetsAtom } from "@/app/state/store";
import { useAtom } from "jotai";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const PrivateRoute = ({ children, redirectTo = "/admin/login" }) => {
  const [loading, setLoading] = useAtom(loadingAtom);
  const [userDeets, setUserDeets] = useAtom(userDeetsAtom);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Start the check process once on mount
    console.log('Component mounted, starting 1500ms wait...');
    setIsWaiting(true);
    
    const timeout = setTimeout(() => {
      console.log('1500ms wait complete, setting hasCheckedStorage to true');
      setHasCheckedStorage(true);
      setIsWaiting(false);
    }, 1500);

    return () => {
      console.log('Cleanup: clearing timeout');
      clearTimeout(timeout);
    };
  }, []); 

  useEffect(() => {
    const isUserEmpty = !userDeets || (Array.isArray(userDeets) && userDeets.length === 0) || Object.keys(userDeets || {}).length === 0;
    console.log('Redirect check:', { isUserEmpty, hasCheckedStorage, loading });
    
    if (isUserEmpty && hasCheckedStorage && !loading) {
      console.log('Redirecting to:', redirectTo);
      router.push(redirectTo);
    }
  }, [userDeets, router, redirectTo, hasCheckedStorage, loading]);

  // If we're on the login page, don't apply PrivateRoute logic
  if (pathname === redirectTo) {
    return <>{children}</>;
  }

  const isUserEmpty = !userDeets || (Array.isArray(userDeets) && userDeets.length === 0) || Object.keys(userDeets || {}).length === 0;
  
  if (!loading && !isUserEmpty) {
    return <>{children}</>;
  }

  if (loading || isWaiting || !hasCheckedStorage) {
    return <div>
      <div className="flex justify-center items-center h-screen">
        <img src="/load.svg" alt="" className="w-20" />
      </div>
    </div>
  }

  // If we reach here, user is empty and storage has been checked - show loading until redirect
  return <div>
    <div className="flex justify-center items-center h-screen">
      <img src="/load.svg" alt="" className="w-20" />
    </div>
  </div>;
};

export default PrivateRoute;
