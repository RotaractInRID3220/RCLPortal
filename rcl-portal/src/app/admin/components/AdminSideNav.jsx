"use client";
import { userDeetsAtom } from "@/app/state/store";
import { Button } from "@/components/ui/button";
import { userLogOut } from "@/services/userServices";
import { useAtom } from "jotai";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import React from "react";
import {
  LayoutDashboard,
  Calendar,
  Users,
  GitBranch,
  Trophy,
  ClipboardList,
  UsersRound,
  CreditCard,
  LogOut,
  Shield,
  Settings,
  Repeat2,
} from "lucide-react";

// Navigation items configuration with permission requirements
const NAV_ITEMS = [
  { label: "Overview", path: "/admin/dashboard", icon: LayoutDashboard, permission: "basic" }, // Basic admin access
  { label: "Clubs", path: "/admin/dashboard/clubs", icon: Users, permission: "super_admin" }, // Requires explicit admin permission
  { label: "Events", path: "/admin/dashboard/events", icon: Calendar, permission: "admin" },
  { label: "Registrations", path: "/admin/dashboard/registrations", icon: ClipboardList, permission: "basic" },
  { label: "Teams", path: "/admin/dashboard/teams", icon: UsersRound, permission: "admin" },
  { label: "Bracket", path: "/admin/dashboard/bracket", icon: GitBranch, permission: "basic" },
  { label: "Leaderboard", path: "/admin/dashboard/leaderboard", icon: Trophy, permission: "basic" },
  { label: "Replacements", path: "/admin/dashboard/replacements", icon: Repeat2, permission: "super_admin" },
  { label: "Payments", path: "/admin/dashboard/payments", icon: CreditCard, permission: "super_admin" }, // Requires explicit admin permission
  { label: "Permissions", path: "/admin/dashboard/permissions", icon: Shield, permission: "super_admin" },
  { label: "Administration", path: "/admin/dashboard/administration", icon: Settings, permission: "admin" },
];

// Reusable NavLink component
const NavLink = ({ label, path, icon: Icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`
      group relative w-full flex items-center gap-3 px-4 py-2 rounded-lg
      text-sm font-medium transition-all duration-200 cursor-pointer
      ${
        isActive
          ? "bg-white/15 border border-white/30 text-white  shadow-white/5"
          : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 hover:text-white"
      }
      focus:outline-none 
    `}
    aria-current={isActive ? "page" : undefined}
  >
    <Icon className={`w-4 h-4 transition-transform duration-200 ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
    <span className="flex-1 text-left">{label}</span>
    {isActive && (
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
    )}
  </button>
);

const AdminSideNav = () => {
  const [userDetails, setUserDetails] = useAtom(userDeetsAtom);
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogOut = async () => {
    await userLogOut(setUserDetails);
  };

  const handleNavigation = (path) => {
    router.push(path);
  };

  // Filter navigation items based on user permissions
  const userPermissionLevel = session?.user?.permission_level;
  const userRoleId = session?.user?.role_id;
  const isBasicAdmin = [1, 2, 3, 4].includes(userRoleId);
  
  const filteredNavItems = NAV_ITEMS.filter((item) => {
    // Basic permission: accessible to all role 1-4 users
    if (item.permission === "basic" && isBasicAdmin) {
      return true;
    }
    
    // Admin permission: requires explicit admin or super_admin permission
    if (item.permission === "admin") {
      if (!userPermissionLevel) return false;
      
      const permissionHierarchy = { 'admin': 1, 'super_admin': 2 };
      const requiredLevel = permissionHierarchy[item.permission];
      const userLevel = permissionHierarchy[userPermissionLevel];
      
      return userLevel >= requiredLevel;
    }
    
    // Super admin permission: requires explicit super_admin permission
    if (item.permission === "super_admin") {
      if (!userPermissionLevel) return false;
      
      const permissionHierarchy = { 'admin': 1, 'super_admin': 2 };
      const requiredLevel = permissionHierarchy[item.permission];
      const userLevel = permissionHierarchy[userPermissionLevel];
      
      return userLevel >= requiredLevel;
    }
    
    return false; // Fallback
  });

  return (
    <div
      className={`${
        userDetails?.card_name == null ? "blur-xl" : "hidden md:flex"
      } h-full w-full items-center justify-center py-10`}
    >
      <div className="h-full justify-between flex flex-col rounded-r-lg bg-white/8 backdrop-blur-sm w-full p-5">
        {/* Logo Section */}
        <div>
          <div className="w-full flex items-center justify-center mb-8">
            <img 
              src="/LogoWhite.png" 
              className="w-5/6 transition-transform duration-300 hover:scale-105" 
              alt="RCL Portal Logo" 
            />
          </div>

          {/* Navigation Links */}
          <nav className="w-full flex flex-col space-y-2" aria-label="Admin navigation">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.path}
                label={item.label}
                path={item.path}
                icon={item.icon}
                isActive={pathname === item.path}
                onClick={() => handleNavigation(item.path)}
              />
            ))}
          </nav>
        </div>

        {/* User Profile & Logout Section */}
        <div className="space-y-3">
          <div className="w-full text-center py-3 px-4 border border-white/20 rounded-lg bg-white/2 cursor-crosshair">
            <p className="text-sm font-medium text-white truncate">
              Rtr. {userDetails?.card_name}
            </p>
          </div>
          <Button
            className="w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/50 text-white hover:bg-red-500 hover:border-red-500 transition-all duration-200 focus:ring-2 focus:ring-red-500/20 cursor-pointer"
            onClick={handleLogOut}
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSideNav;
