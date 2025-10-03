'use client'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

export default function Unauthorized() {
  const router = useRouter()

  const handleLogout = async () => {
    await signOut({ redirect: false })
    router.push('/')
  }

  return (
    <div className="flex items-center bg-red-600 justify-center h-screen w-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
        <p className="text-lg mb-6">You don't have permission to access this page.</p>
        <div className="space-x-4">
          <Button onClick={() => router.back()}  className="cursor-pointer bg-white/20 border border-white text-white hover:text-black">
            Go Back
          </Button>
          <Button onClick={handleLogout} className="cursor-pointer">
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}