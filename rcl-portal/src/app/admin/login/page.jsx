'use client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAtom, useSetAtom } from 'jotai'
import { loadingAtom, userDeetsAtom } from '@/app/state/store'
import { toast } from 'sonner'

const adminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const router = useRouter();
    const [UserDeets,setUserDeets] = useAtom(userDeetsAtom);
    const setGlobalLoading = useSetAtom(loadingAtom);

    // Set global loading to false when login page renders
    useEffect(() => {
        console.log('Login page rendered, setting global loading to false');
        setGlobalLoading(false);
    }, []);

    const handleLogin = async () => {
      setError(null);
      if (!email || !password) {
        setError('Username and password are required');
        return;
      }
      try {
        setLoading(true);
        const params = new URLSearchParams({ username: email, password });
        const res = await fetch(`/api/council?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || !data?.authorized) {
          setError(data?.error || 'Login failed');
          setLoading(false);
          return;
        }
        // Save user data in atom (persisted to localStorage with TTL)
        setUserDeets(data.user || null);
        toast.success('Login successful');
        router.push('/');
      } catch (e) {
        setError('Network error');
        setLoading(false);
      }
    };

  return (
    <div className='flex items-center justify-center h-screen w-screen'>
        {UserDeets?.card_name}
      <div className='w-[500px] h-[500px] fixed top-0 bottom-0 left-0 right-0 m-auto bg-cranberry -z-10 rounded-full blur-[15rem]'></div>
        <div className='w-1/4 h-96 bg-cranberry/80 border border-cranberry fixed top-0 bottom-0 left-0 right-0 m-auto rounded-3xl flex flex-col items-center justify-center py-5'>
            <img src="/LogoWhite.png" alt="" className="w-2/4"/>
            <div className='w-5/6 mt-10'>
                <Input type='email' placeholder='Username' value={email} onChange={(e) => setEmail(e.target.value)} className='w-full h-12'/>
                <Input type='password' placeholder='Password' value={password} onChange={(e) => setPassword(e.target.value)} className='w-full mt-5 h-12'/>
                {error && <p className='text-red-500 text-sm mt-2'>{error}</p>}
            </div>
            <Button onClick={handleLogin} disabled={loading} variant='default' className='w-5/6 cursor-pointer mt-7 h-12 hover:bg-blackD hover:text-white'>
              {loading ? 'Logging in...' : 'Login'}
            </Button>
        </div>
    </div>
  )
}

export default adminLogin
