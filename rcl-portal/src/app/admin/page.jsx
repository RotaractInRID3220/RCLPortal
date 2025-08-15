'use client'
import { useAtom, useSetAtom } from 'jotai'
import React from 'react'
import { loadingAtom, userDeetsAtom } from '../state/store'

const page = () => {
    const [useD, setUserD] = useAtom(userDeetsAtom);
    const [loading, setLoading] = useAtom(loadingAtom);
    const setuserDeets = useSetAtom(userDeetsAtom);


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
    <div>
      <h1>Admin Page</h1>
      <button onClick={() => setuserDeets([])}>xoxo</button>
      {useD?.card_name}
    </div>
  )
}

export default page
