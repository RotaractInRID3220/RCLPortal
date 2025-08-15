'use client'
import { loadingAtom, userDeetsAtom } from '@/app/state/store';
import { useAtom, useSetAtom } from 'jotai'
import React from 'react'
const page = () => {
    const [useD, setUserD] = useAtom(userDeetsAtom);
    const [loading, setLoading] = useAtom(loadingAtom);


    if (loading){
        return (
            <div>
                <div className="flex justify-center items-center h-screen">
                    <img src="/load.svg" alt="" className="w-20" />
                </div>
            </div>
        )
    }
  return (
    <div className='py-10 px-10'>
      <h1>Admin Page</h1>
    </div>
  )
}

export default page
