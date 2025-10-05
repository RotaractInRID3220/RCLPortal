// Service functions for user operations
import { signOut } from 'next-auth/react'

export const userLogOut = async (setUserDetails) => {
  // Clear Jotai atom
  setUserDetails(null);
  
  // Sign out from NextAuth
  await signOut({ 
    redirect: false 
  });
};