"use client";
import { clubMembersAtom, userDeetsAtom } from "@/app/state/store";
import { Button } from "@/components/ui/button";
import { userLogOut } from "@/services/userServices";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import React, { use, useEffect } from "react";

const PortalSideNav = () => {
  const [userDetails, setUserDetails] = useAtom(userDeetsAtom);
  const [clubMembers, setClubMembers] = useAtom(clubMembersAtom)
  const router = useRouter();

  const handleLogOut = () => {
    userLogOut(setUserDetails);
  };

  useEffect(() => {
    fetchClubMembers();
  }, [userDetails]);

  const fetchClubMembers = async () => {
    if (!userDetails?.club_id) {
      console.log('No club_id available yet');
      return;
    }
    
    try {
      const response = await fetch(`/api/council?clubID=${userDetails.club_id}`);
      const data = await response.json();
      console.log('Club members API response:', data);
      
      // Set the members array from the response
      if (data.success && Array.isArray(data.members)) {
        setClubMembers(data.members);
      } else {
        console.error('Invalid club members data format:', data);
        setClubMembers([]);
      }
    } catch (error) {
      console.error('Error fetching club members:', error);
      setClubMembers([]);
    }
  };

  const navigateToOverview = () => {
    router.push("/portal/dashboard");
  };

  const navigateToRegistration = () => {
    router.push("/portal/dashboard/registration");
  };

  const navigateToPayment = () => {
    router.push("/portal/dashboard/payment");
  };

  const navigateToLeaderboard = () => {
    router.push("/portal/dashboard/leaderboard");
  };

  return (
    <div
      className={`${
        userDetails?.card_name == null ? "blur-xl" : "flex"
      } h-full w-full items-center justify-center py-10`}
    >
      <div className="h-full justify-between flex flex-col rounded-r-lg bg-white/8 w-full p-5">
        <div>
          <div className="w-full flex items-center justify-center">
            <img src="/LogoWhite.png" className="w-5/6" alt="" />
          </div>
          <div className="w-full flex flex-col space-y-3 justify-center items-center  mt-10">
            <div
              className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all"
              onClick={navigateToOverview}
            >
              Overview
            </div>
            <div
              className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all"
              onClick={navigateToRegistration}
            >
              Registrations
            </div>
            <div
              className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all"
              onClick={navigateToPayment}
            >
              Payment
            </div>
            <div
              className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all"
              onClick={navigateToLeaderboard}
            >
              Leaderboard
            </div>

          </div>
        </div>
        <div>
          <h1 className="w-full text-center py-2 border rounded-md mb-3 text-sm cursor-crosshair">
            Rtr. {userDetails?.card_name}
          </h1>
          <Button
            className="w-full items-center text-center bg-red-500/10 border border-red-500 text-white cursor-pointer hover:bg-red-500 transition-200ms"
            onClick={handleLogOut}
          >
            LOG OUT
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PortalSideNav;
