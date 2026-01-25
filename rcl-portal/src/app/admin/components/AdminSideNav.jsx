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
  Grid,
  Trophy,
  ClipboardList,
  UsersRound,
  CreditCard,
  LogOut,
  Shield,
  Settings,
  Repeat2,
  ArrowLeftRight,
  ChevronDown,
  Wrench,
  Hash,
  Activity,
  Volleyball,
  ScanLine,
  CalendarCheck
} from "lucide-react";

// Navigation items configuration with permission requirements
const BASE_NAV_ITEMS = [
  { label: "Overview", path: "/admin/dashboard", icon: LayoutDashboard, permission: "basic" },
  { label: "Registrations", path: "/admin/dashboard/registrations", icon: ClipboardList, permission: "basic" },
  { label: "Leaderboard", path: "/admin/dashboard/leaderboard", icon: Trophy, permission: "basic" },
  { label: "Payments", path: "/admin/dashboard/payments", icon: CreditCard, permission: "super_admin" },
];

const NAV_GROUPS = [
  {
    label : "Events Section",
    icon  : Volleyball,
    items : [
      { label: "Events", path: "/admin/dashboard/events", icon: Calendar, permission: "admin" },
      { label: "Teams", path: "/admin/dashboard/teams", icon: UsersRound, permission: "admin" },
      { label: "Bracket", path: "/admin/dashboard/bracket", icon: GitBranch, permission: "basic" },
      { label: "Track Events", path: "/admin/dashboard/track-events", icon: Activity, permission: "admin" },
      { label: "Day Check-ins", path: "/admin/dashboard/day-registrations", icon: CalendarCheck, permission: "admin" }
    ]
  },
  {
    label: "Replacements & Swaps",
    icon: Repeat2,
    items: [
      { label: "Replacements", path: "/admin/dashboard/replacements", icon: Repeat2, permission: "super_admin" },
      { label: "Swaps", path: "/admin/dashboard/swaps", icon: ArrowLeftRight, permission: "admin" },
      { label: "Admin Changes", path: "/admin/dashboard/player-changes", icon: Shield, permission: "administrator" },
    ],
  },
  {
    label: "Admin Options",
    icon: Grid,
    items: [
      { label: "Administration", path: "/admin/dashboard/administration", icon: Settings, permission: "admin" },
      { label: "Player Numbers", path: "/admin/dashboard/player-numbers", icon: Hash, permission: "admin" },
    ],
  },
  {
    label: "Configurations",
    icon: Wrench,
    items: [
      { label: "Portal Settings", path: "/admin/dashboard/portal-settings", icon: ScanLine, permission: "administrator" },
      { label: "Clubs", path: "/admin/dashboard/clubs", icon: Users, permission: "super_admin" },
      { label: "Permissions", path: "/admin/dashboard/permissions", icon: Shield, permission: "super_admin" },
    ],
  },
];

// Reusable NavLink component
const NavLink = ({ label, path, icon: Icon, isActive, onClick, className = "" }) => (
  <button
    type="button"
    onClick={onClick}
    className={`
      group relative w-full flex items-center gap-3 px-4 py-2 rounded-lg
      text-xs font-medium transition-all duration-200 cursor-pointer
      ${
        isActive
          ? "bg-white/15 border border-white/30 text-white  shadow-white/5"
          : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 hover:text-white"
      }
      focus:outline-none 
      ${className}
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

const ExpandableGroup = ({ label, icon: Icon, isExpanded, onToggle, children }) => (
  <div className="w-full">
    <button
      type="button"
      onClick={onToggle}
      className={`
        group relative w-full flex items-center gap-3 px-4 py-2 rounded-lg
        text-xs font-medium transition-all duration-200 cursor-pointer
        ${isExpanded ? "bg-white/15 border border-white/30 text-white shadow-white/5" : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20 hover:text-white"}
        focus:outline-none
      `}
      aria-expanded={isExpanded}
    >
      <Icon className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "scale-110" : "group-hover:scale-110"}`} />
      <span className="flex-1 text-left">{label}</span>
      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
    </button>
    <div
      className={`overflow-hidden transition-all duration-200 ease-in-out ${isExpanded ? "max-h-64 opacity-100 mt-2" : "max-h-0 opacity-0 pointer-events-none"}`}
      aria-hidden={!isExpanded}
    >
      <div className="flex flex-col space-y-2 pl-4 border-l border-white/10">
        {children}
      </div>
    </div>
  </div>
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
  const permissionHierarchy = { admin: 1, super_admin: 2, administrator: 3 };

  const canAccess = (item) => {
    if (item.permission === "basic") {
      return isBasicAdmin;
    }

    if (item.permission === "admin" || item.permission === "super_admin" || item.permission === "administrator") {
      if (!userPermissionLevel) return false;
      const userLevel = permissionHierarchy[userPermissionLevel] || 0;
      const requiredLevel = permissionHierarchy[item.permission] || Infinity;
      return userLevel >= requiredLevel;
    }

    return false;
  };

  const filteredNavItems = BASE_NAV_ITEMS.filter(canAccess);

  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(canAccess),
  })).filter((group) => group.items.length > 0);

  const [expandedGroups, setExpandedGroups] = React.useState(() => {
    const initialState = {};
    NAV_GROUPS.forEach((group) => {
      initialState[group.label] = group.items.some((item) => pathname?.startsWith(item.path));
    });
    return initialState;
  });

  React.useEffect(() => {
    setExpandedGroups((prev) => {
      const updated = { ...prev };
      let hasChanges = false;

      NAV_GROUPS.forEach((group) => {
        const shouldExpand = group.items.some((item) => pathname?.startsWith(item.path));
        if (prev[group.label] !== shouldExpand) {
          updated[group.label] = shouldExpand;
          hasChanges = true;
        }
      });

      return hasChanges ? updated : prev;
    });
  }, [pathname]);

  const toggleGroup = (label) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  return (
    <div
      className={`${
        userDetails?.card_name == null ? "blur-xl" : "hidden md:flex"
      } h-full w-full items-center justify-center py-10`}
    >
      <div className="h-full justify-between flex flex-col rounded-r-lg bg-white/8 backdrop-blur-sm w-full p-5">
        {/* Logo Section */}
        <div>
          <div className="w-full flex items-center justify-center mb-4">
            <img 
              src="/LogoWhite.png" 
              className="w-9/12 transition-transform duration-300 hover:scale-105" 
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

            {filteredGroups.map((group) => (
              <ExpandableGroup
                key={group.label}
                label={group.label}
                icon={group.icon}
                isExpanded={!!expandedGroups[group.label]}
                onToggle={() => toggleGroup(group.label)}
              >
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    label={item.label}
                    path={item.path}
                    icon={item.icon}
                    isActive={pathname === item.path}
                    onClick={() => handleNavigation(item.path)}
                    className="pl-6"
                  />
                ))}
              </ExpandableGroup>
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
