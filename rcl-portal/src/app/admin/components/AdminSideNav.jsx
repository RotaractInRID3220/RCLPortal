"use client";
import { userDeetsAtom } from "@/app/state/store";
import { Button } from "@/components/ui/button";
import { userLogOut } from "@/services/userServices";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import React from "react";

const AdminSideNav = () => {
  const [userDetails, setUserDetails] = useAtom(userDeetsAtom);
  const router = useRouter();

  const handleLogOut = () => {
    userLogOut(setUserDetails);
  };

  const navigateToSports = () => {
    router.push("/admin/dashboard/events");
  };
  const navigateToClubs = () => {
    router.push("/admin/dashboard/clubs");
  };
  const navigateToBracket = () => {
    router.push("/admin/dashboard/bracket");
  };
  const navigateToLeaderboard = () => {
    router.push("/admin/dashboard/leaderboard");
  };
  const navigateToRegistrations = () => {
    router.push("/admin/dashboard/registrations");
  };
  
  const navigateToPayments = () => {
    router.push("/admin/dashboard/payments");
  };

  const navigateToTeams = () => {
    router.push("/admin/dashboard/teams");
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
              onClick={navigateToSports}
            >
              EVENTS
            </div>
            <div
              className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all"
              onClick={navigateToClubs}
            >
              CLUB MANAGEMENT
            </div>
            <div
              className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all"
              onClick={navigateToBracket}
            >
              BRACKET
            </div>
            <div
              className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all"
              onClick={navigateToLeaderboard}
            >
              LEADERBOARD
            </div>
            <div
              className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all"
              onClick={navigateToRegistrations}
            >
              REGISTRATIONS
            </div>
            <div
              className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all"
              onClick={navigateToTeams}
            >
              TEAMS
            </div>
            <div
              className="text-center w-full bg-white/5 border py-1.5 rounded-md cursor-pointer hover:bg-white/15 transition-all"
              onClick={navigateToPayments}
            >
              PAYMENTS
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

export default AdminSideNav;
