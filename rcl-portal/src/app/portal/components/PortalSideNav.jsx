'use client'
import { userDeetsAtom } from '@/app/state/store'
import { Button } from '@/components/ui/button'
import { userLogOut } from '@/services/userServices'
import { useAtom } from 'jotai'
import React from 'react'

const PortalSideNav = () => {
  const [userDetails, setUserDetails] = useAtom(userDeetsAtom);

  const handleLogOut = () => {
    userLogOut(setUserDetails);
  }

  return (
    <div className={`${userDetails?.card_name == null ? 'blur-xl' : 'flex'} h-full w-full items-center justify-center py-10`}>
        <div className="h-full justify-between flex flex-col rounded-r-lg bg-white/8 w-full p-5">
          <div>
              <div className="w-full flex items-center justify-center">
                <img src="/LogoWhite.png" className="w-5/6" alt="" />
              </div>
              <div className="w-full flex flex-col space-y-3 justify-center items-center  mt-10">
                <div className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all">OVERVIEW</div>
                <div className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all">OVERVIEW</div>
                <div className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all">OVERVIEW</div>
                <div className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all">OVERVIEW</div>
              </div>
          </div>
          <div>
            <h1 className="w-full text-center py-2 border rounded-md mb-3 text-sm cursor-crosshair">Rtr. {userDetails?.card_name}</h1>
            <Button className="w-full items-center text-center bg-red-500/10 border border-red-500 text-white cursor-pointer hover:bg-red-500 transition-200ms" onClick={handleLogOut}>LOG OUT</Button>
          </div>
        </div>
    </div>
  )
}

export default PortalSideNav
