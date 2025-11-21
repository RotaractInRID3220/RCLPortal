"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { toast } from "sonner";
import { userDeetsAtom, clubMembersAtom } from "@/app/state/store";
import PrivateRoute from "@/lib/PrivateRoute";
import { getSwapContext, submitSwapRequest } from "@/services/swapService";
import { APP_CONFIG } from "@/config/app.config";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Repeat2,
  Calendar,
  
  Users,
  ArrowRight,
  ArrowLeftRight,
  Clock,
  AlertCircle,
  
} from "lucide-react";

const DEFAULT_CONTEXT = {
  sports: [],
  sportRegistrations: {},
  playerRegistrationMap: {},
  requests: [],
};

const SWAP_MODE_TABS = [
  {
    id: "player-to-player",
    label: "Swap two players",
    description: "Exchange players within the same sport",
    icon: Users,
  },
  {
    id: "single-move",
    label: "Move to new sport",
    description: "Reassign a player to another sport",
    icon: ArrowLeftRight,
  },
];

const formatDateLabel = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const getStatusMeta = (status) => {
  if (status === true) {
    return {
      label: "Approved",
      className:
        "border-green-500/40 bg-green-500/15 text-green-200 dark:text-green-100",
    };
  }
  if (status === false) {
    return {
      label: "Rejected",
      className:
        "border-red-500/40 bg-red-500/15 text-red-200 dark:text-red-100",
    };
  }
  return {
    label: "Pending",
    className:
      "border-amber-500/40 bg-amber-500/15 text-amber-200 dark:text-amber-100",
  };
};

const SwapsPage = () => {
  const [userDeets] = useAtom(userDeetsAtom);
  const [clubMembers, setClubMembers] = useAtom(clubMembersAtom);
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [swapType, setSwapType] = useState("player-to-player");
  const [selectedSportId, setSelectedSportId] = useState("");
  const [selectedRegistrationId, setSelectedRegistrationId] = useState("");
  const [selectedSecondRegistrationId, setSelectedSecondRegistrationId] =
    useState("");
  const [selectedSecondPlayerSportId, setSelectedSecondPlayerSportId] = useState("");
  const [selectedDestinationSportId, setSelectedDestinationSportId] =
    useState("");
  const [reason, setReason] = useState("");
  // supportingLink intentionally removed
  const [submitting, setSubmitting] = useState(false);

  const now = new Date();
  const replacementOpening = new Date(APP_CONFIG.REPLACEMENT_OPENING);
  const replacementDeadline = new Date(APP_CONFIG.REPLACEMENT_DEADLINE);
  const isBeforeReplacementOpen = now < replacementOpening;
  const isAfterReplacementDeadline = now > replacementDeadline;
  const isWithinReplacementWindow = !isBeforeReplacementOpen && !isAfterReplacementDeadline;

  const ensureClubMembers = useCallback(async () => {
    if (!userDeets?.club_id) return;
    if (Array.isArray(clubMembers) && clubMembers.length > 0) return;

    try {
      const response = await fetch(`/api/council?clubID=${userDeets.club_id}`);
      const data = await response.json();
      if (data.success && Array.isArray(data.members)) {
        setClubMembers(data.members);
      }
    } catch (error) {
      console.error("Failed to fetch club members for swaps:", error);
    }
  }, [clubMembers, setClubMembers, userDeets?.club_id]);

  const loadContext = useCallback(
    async (force = false) => {
      if (!userDeets?.club_id) return;
      try {
        if (force) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        const result = await getSwapContext(userDeets.club_id);
        if (!result.success) {
          toast.error(result.error || "Failed to load swap data");
          return;
        }
        setContext(result.data);
      } catch (error) {
        console.error("Failed to load swaps context:", error);
        toast.error("Failed to load swap data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userDeets?.club_id]
  );

  useEffect(() => {
    ensureClubMembers();
  }, [ensureClubMembers]);

  useEffect(() => {
    if (userDeets?.club_id) {
      loadContext();
    }
  }, [userDeets?.club_id, loadContext]);

  const selectedSport = useMemo(() => {
    const id = Number(selectedSportId);
    if (!id) return null;
    return context.sports.find((sport) => sport.sport_id === id) || null;
  }, [context.sports, selectedSportId]);

  const registeredPlayers = useMemo(() => {
    if (!selectedSport) return [];
    const list = context.sportRegistrations?.[String(selectedSport.sport_id)] || [];
    return Array.isArray(list) ? list : [];
  }, [context.sportRegistrations, selectedSport]);

  const eligibleDestinationSports = useMemo(() => {
    if (!context.sports.length) return [];
    
    // For single move, filter based on gender compatibility
    const primaryPlayer = registeredPlayers.find(
      (reg) => String(reg.id) === String(selectedRegistrationId)
    );
    const primaryPlayerGender = primaryPlayer?.player?.gender?.toLowerCase();
    const primarySportId = selectedSport?.sport_id;
    
    const currentRegistrations = Object.values(context.sportRegistrations).flat();
    const counts = currentRegistrations.reduce((acc, registration) => {
      acc[registration.sport_id] =
        (acc[registration.sport_id] || 0) + (registration.main_player ? 1 : 0);
      return acc;
    }, {});
    
    const mixedValues = new Set(['mix', 'mixed', 'open', 'any']);
    
    return context.sports.filter((sport) => {
      // Exclude current sport
      if (primarySportId && sport.sport_id === primarySportId) return false;
      
      // Check capacity
      const maxCount = sport.max_count || 0;
      const count = counts[sport.sport_id] || 0;
      if (maxCount > 0 && count >= maxCount) return false;
      
      // Check gender compatibility when player is selected
      if (selectedRegistrationId && primaryPlayerGender) {
        const sportGender = sport.gender_type?.toLowerCase();
        
        if (sportGender) {
          // Mixed/open sports accept all genders
          if (mixedValues.has(sportGender)) return true;
          
          // Boy sports require male players
          if (sportGender === 'm' || sportGender === 'male') {
            if (primaryPlayerGender !== 'm' && primaryPlayerGender !== 'male') {
              return false;
            }
          }
          
          // Girl sports require female players
          if (sportGender === 'f' || sportGender === 'female') {
            if (primaryPlayerGender !== 'f' && primaryPlayerGender !== 'female') {
              return false;
            }
          }
        }
      }
      
      return true;
    });
  }, [context.sports, context.sportRegistrations, selectedSport, selectedRegistrationId, registeredPlayers]);

  const eligibleSecondPlayerSports = useMemo(() => {
    if (!selectedSport || !selectedRegistrationId) return [];
    
    const primaryPlayer = registeredPlayers.find(
      (reg) => String(reg.id) === String(selectedRegistrationId)
    );
    const primaryPlayerGender = primaryPlayer?.player?.gender?.toLowerCase();
    const primarySportGender = selectedSport?.gender_type?.toLowerCase();
    
    const mixedValues = new Set(['mix', 'mixed', 'open', 'any']);
    
    // Determine eligible second sport genders based on first sport
    let allowedSecondSportGenders = new Set();
    
    if (mixedValues.has(primarySportGender)) {
      // Mixed sport: can swap with boy, girl, or mixed sports
      allowedSecondSportGenders = new Set(['m', 'f', 'male', 'female', 'mix', 'mixed', 'open', 'any']);
    } else if (primarySportGender === 'm' || primarySportGender === 'male') {
      // Boy sport: can swap with boy or mixed sports only
      allowedSecondSportGenders = new Set(['m', 'male', 'mix', 'mixed', 'open', 'any']);
    } else if (primarySportGender === 'f' || primarySportGender === 'female') {
      // Girl sport: can swap with girl or mixed sports only
      allowedSecondSportGenders = new Set(['f', 'female', 'mix', 'mixed', 'open', 'any']);
    } else {
      // Unknown gender type, allow all
      allowedSecondSportGenders = new Set(['m', 'f', 'male', 'female', 'mix', 'mixed', 'open', 'any']);
    }
    
    return context.sports.filter((sport) => {
      // Exclude same sport
      if (sport.sport_id === selectedSport?.sport_id) return false;
      
      // Must have registrations
      if (!context.sportRegistrations?.[String(sport.sport_id)]?.length) return false;
      
      // Check if second sport gender is allowed
      const secondSportGender = sport.gender_type?.toLowerCase();
      if (secondSportGender && !allowedSecondSportGenders.has(secondSportGender)) {
        return false;
      }
      
      return true;
    });
  }, [context.sports, selectedSport, selectedRegistrationId, context.sportRegistrations, registeredPlayers]);

  const secondPlayerOptionsBySport = useMemo(() => {
    if (!selectedSecondPlayerSportId || !selectedSport) return [];
    
    const sportId = Number(selectedSecondPlayerSportId);
    const registrations = context.sportRegistrations?.[String(sportId)] || [];
    const primaryPlayer = registeredPlayers.find((reg) => String(reg.id) === String(selectedRegistrationId));
    const primaryPlayerRMIS = primaryPlayer?.RMIS_ID;
    const primaryPlayerGender = primaryPlayer?.player?.gender?.toLowerCase();
    const primarySportGender = selectedSport?.gender_type?.toLowerCase();
    
    // Get the second sport details
    const secondSport = context.sports.find(s => s.sport_id === sportId);
    const secondSportGender = secondSport?.gender_type?.toLowerCase();
    
    const mixedValues = new Set(['mix', 'mixed', 'open', 'any']);
    
    // Helper: Check if a player's gender matches sport requirements
    const isGenderCompatible = (playerGender, sportGender) => {
      const normPlayerGender = playerGender?.toLowerCase();
      const normSportGender = sportGender?.toLowerCase();
      
      if (!normSportGender) return true;
      
      // Mixed/open sports accept all genders
      if (mixedValues.has(normSportGender)) return true;
      
      if (!normPlayerGender) return false;
      
      // Boy sports require male players
      if (normSportGender === 'm' || normSportGender === 'male') {
        return normPlayerGender === 'm' || normPlayerGender === 'male';
      }
      
      // Girl sports require female players
      if (normSportGender === 'f' || normSportGender === 'female') {
        return normPlayerGender === 'f' || normPlayerGender === 'female';
      }
      
      return true;
    };
    
    // Filter players in the second sport
    return registrations
      .filter((reg) => {
        // Exclude primary player
        if (reg.RMIS_ID === primaryPlayerRMIS) return false;
        
        const secondPlayerGender = reg.player?.gender?.toLowerCase();
        
        // Check if second player can participate in primary sport
        if (!isGenderCompatible(secondPlayerGender, primarySportGender)) {
          return false;
        }
        
        // Check if primary player can participate in second sport
        if (!isGenderCompatible(primaryPlayerGender, secondSportGender)) {
          return false;
        }
        
        return true;
      })
      .map((reg) => ({
        rmis: reg.RMIS_ID,
        name: reg.player?.name || reg.RMIS_ID,
        registration_id: reg.id,
        main_player: reg.main_player,
        sport_day: reg.sport_day,
      }))
      .filter((player, index, self) =>
        index === self.findIndex((p) => p.rmis === player.rmis)
      ); // Remove duplicates
  }, [context.sportRegistrations, selectedSecondPlayerSportId, context.sports, registeredPlayers, selectedRegistrationId, selectedSport]);
  const secondPlayerOptions = useMemo(() => {
    const keys = Object.keys(context.playerRegistrationMap || {});
    const flattened = Object.values(context.sportRegistrations).flat();
    const primary = (context.sportRegistrations?.[String(selectedSport?.sport_id)] || []).find((r) => String(r.id) === String(selectedRegistrationId));
    const primaryRMIS = primary?.RMIS_ID || null;
    return keys
      .filter((rmis) => rmis !== primaryRMIS)
      .map((rmis) => {
      const joined = flattened.find((r) => r.RMIS_ID === rmis);
      const name = joined?.player?.name || rmis;
      const regs = context.playerRegistrationMap[rmis] || [];
      return { rmis, name, regs };
    });
  }, [context.playerRegistrationMap, context.sportRegistrations, selectedSport?.sport_id, selectedRegistrationId]);

  const resetForm = () => {
    setSelectedRegistrationId("");
    setSelectedSecondRegistrationId("");
    setSelectedSecondPlayerSportId("");
    setSelectedDestinationSportId("");
    setReason("");
  };

  const handleSubmit = useCallback(async () => {
    if (!userDeets?.club_id) return;
    if (!selectedRegistrationId) {
      toast.error("Select the primary player");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please add a reason for the swap");
      return;
    }
    // supporting link disabled in portal flow

    const payload = {
      club_id: userDeets.club_id,
      player1_registrations_id: Number(selectedRegistrationId),
      reason: reason.trim(),
      requested_by: userDeets?.membership_id || null,
    };

    // linking is removed from swap flow
    if (swapType === "player-to-player") {
      if (!selectedSecondRegistrationId) {
        toast.error("Select the second player for the swap");
        return;
      }
      payload.player2_registrations_id = Number(selectedSecondRegistrationId);
    } else {
      if (!selectedDestinationSportId) {
        toast.error("Choose a destination sport");
        return;
      }
      payload.sport2_id = Number(selectedDestinationSportId);
    }

    try {
      setSubmitting(true);
      const result = await submitSwapRequest(payload);
      if (!result.success) {
        toast.error(result.error || "Failed to submit swap request");
        return;
      }
      toast.success("Swap request submitted");
      await loadContext(true);
      resetForm();
    } catch (error) {
      console.error("Failed to submit swap:", error);
      toast.error("Failed to submit swap request");
    } finally {
      setSubmitting(false);
    }
  }, [
    userDeets?.club_id,
    selectedRegistrationId,
    reason,
    swapType,
    selectedSecondRegistrationId,
    selectedDestinationSportId,
    userDeets?.membership_id,
    loadContext,
  ]);

  if (loading) {
    return (
      <PrivateRoute accessType="portal">
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-white/70">
            <img src="/load.svg" alt="Loading" className="w-20" />
            <p className="text-sm">Loading swap data…</p>
          </div>
        </div>
      </PrivateRoute>
    );
  }

  return (
    <PrivateRoute accessType="portal">
      <div className="space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 text-white">
              <Repeat2 className="h-8 w-8 text-blue-400" aria-hidden="true" />
              <h1 className="text-3xl font-semibold tracking-tight">Player Swaps</h1>
            </div>
            <p className="text-sm text-white/70">
              Request swaps or single-player moves for your club roster.
            </p>
          </div>
          {/* <Button
            type="button"
            variant="outline"
            onClick={() => loadContext(true)}
            disabled={refreshing}
            className="min-w-[140px] cursor-pointer disabled:cursor-not-allowed"
          >
              {refreshing ? (
              <>
                <img src="/load.svg" alt="Refreshing" className="w-4 h-4 mr-2 inline" />
                Refreshing…
              </>
            ) : (
              "Refresh"
            )}
          </Button> */}
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {isBeforeReplacementOpen && (
            <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-900/20 via-amber-800/10 to-transparent p-6">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -z-10" />
              <div className="flex flex-col items-center text-center gap-4">
                <div className="p-3 rounded-full bg-amber-500/20 border border-amber-500/30">
                  <Clock className="w-6 h-6 text-amber-200" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl font-semibold text-white">Swap Requests Not Yet Available</h2>
                  <p className="text-sm text-white/70 max-w-2xl">
                    Player swap requests will be available after the replacement period opens.
                  </p>
                </div>
                <div className="flex items-center gap-3 px-5 py-2.5 rounded-lg bg-amber-500/15 border border-amber-500/25">
                  <Calendar className="w-4 h-4 text-amber-200 flex-shrink-0" />
                  <div className="text-left">
                    <p className="text-xs text-amber-200/70 uppercase tracking-wide leading-tight">Swaps open after</p>
                    <p className="text-xs font-semibold text-amber-100">{formatDateLabel(APP_CONFIG.REPLACEMENT_OPENING)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {isAfterReplacementDeadline && (
            <div className="relative overflow-hidden rounded-xl border border-red-500/30 bg-gradient-to-br from-red-900/20 via-red-800/10 to-transparent p-6">
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl -z-10" />
              <div className="flex flex-col items-center text-center gap-4">
                <div className="p-3 rounded-full bg-red-500/20 border border-red-500/30">
                  <AlertCircle className="w-6 h-6 text-red-200" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl font-semibold text-white">Swap Window Closed</h2>
                  <p className="text-sm text-white/70 max-w-2xl">
                    The deadline for player swap requests has passed. All teams are now finalized for the upcoming event.
                  </p>
                </div>
                <div className="flex items-center gap-3 px-5 py-2.5 rounded-lg bg-red-500/15 border border-red-500/25">
                  <Calendar className="w-4 h-4 text-red-200 flex-shrink-0" />
                  <div className="text-left">
                    <p className="text-xs text-red-200/70 uppercase tracking-wide leading-tight">Window closed on</p>
                    <p className="text-xs font-semibold text-red-100">{formatDateLabel(APP_CONFIG.REPLACEMENT_DEADLINE)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {isWithinReplacementWindow && (
            <section className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/10">
                <div className="grid gap-3 md:grid-cols-2">
                  {SWAP_MODE_TABS.map(({ id, label, description, icon: Icon }) => {
                    const isActive = swapType === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSwapType(id)}
                        aria-pressed={isActive}
                        className={`
                          flex min-h-20 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60
                          ${
                            isActive
                              ? "border-blue-400 bg-blue-500/20 text-white shadow-lg"
                              : "border-white/10 bg-white/5 text-white/80 hover:border-white/30 hover:bg-white/10"
                          }
                        `}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                        <div>
                          <p className="text-sm font-semibold">{label}</p>
                          <p className="text-xs text-white/60">{description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/10">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="sport-select"
                      className="text-sm font-medium text-white/80"
                    >
                      Source sport
                    </label>
                    <Select
                      value={selectedSportId}
                      onValueChange={(value) => {
                        setSelectedSportId(value);
                        setSelectedRegistrationId("");
                        setSelectedSecondRegistrationId("");
                        setSelectedSecondPlayerSportId("");
                      }}
                    >
                      <SelectTrigger
                        id="sport-select"
                        className="w-full border-white/20 bg-white/10 text-white mt-2"
                      >
                        <SelectValue
                          placeholder={
                            context.sports.length
                              ? "Select a sport"
                              : "No registrations yet"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {context.sports.map((sport) => (
                          <SelectItem
                            key={sport.sport_id}
                            value={String(sport.sport_id)}
                          >
                            {sport.sport_name} · {sport.gender_type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="player-select"
                      className="text-sm font-medium text-white/80"
                    >
                      Primary player
                    </label>
                    <Select
                      value={selectedRegistrationId}
                      onValueChange={(v) => {
                        setSelectedRegistrationId(v);
                        setSelectedSecondRegistrationId("");
                        setSelectedSecondPlayerSportId("");
                      }}
                      disabled={!selectedSportId}
                    >
                      <SelectTrigger
                        id="player-select"
                        className="w-full border-white/20 bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                      >
                        <SelectValue
                          placeholder={
                            !selectedSportId
                              ? "Select a sport first"
                              : registeredPlayers.length
                              ? "Select a player"
                              : "No players available"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {registeredPlayers.length === 0 && (
                          <SelectItem value="none" disabled>
                            No players
                          </SelectItem>
                        )}
                        {registeredPlayers.map((player) => (
                          <SelectItem key={player.id} value={String(player.id)}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {player.player?.name || player.RMIS_ID}
                              </span>
                              {player.main_player && (
                                <Badge variant="outline" className="text-xs">
                                  Main
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {swapType === "player-to-player" ? (
                    <>
                      <div className="space-y-2">
                        <label
                          htmlFor="second-player-sport"
                          className="text-sm font-medium text-white/80"
                        >
                          Second player's sport
                        </label>
                        <Select
                          value={selectedSecondPlayerSportId}
                          onValueChange={(val) => {
                            setSelectedSecondPlayerSportId(val);
                            setSelectedSecondRegistrationId(""); // Reset second player when sport changes
                          }}
                          disabled={!selectedRegistrationId}
                        >
                          <SelectTrigger
                            id="second-player-sport"
                            className="w-full border-white/20 bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
                          >
                            <SelectValue
                              placeholder={
                                !selectedRegistrationId
                                  ? "Select primary player first"
                                  : eligibleSecondPlayerSports.length
                                  ? "Select sport"
                                  : "No compatible sports"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {eligibleSecondPlayerSports.length === 0 && (
                              <SelectItem value="none" disabled>
                                No compatible sports
                              </SelectItem>
                            )}
                            {eligibleSecondPlayerSports.map((sport) => (
                              <SelectItem key={sport.sport_id} value={String(sport.sport_id)}>
                                <div className="flex items-center gap-2">
                                  <span>{sport.sport_name}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {sport.gender_type}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="second-player-select" className="text-sm font-medium text-white/80">
                          Second player
                        </label>
                        <Select
                          value={selectedSecondRegistrationId}
                          onValueChange={setSelectedSecondRegistrationId}
                          disabled={!selectedSecondPlayerSportId}
                        >
                          <SelectTrigger
                            id="second-player-select"
                            className="w-full border-white/20 bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
                          >
                            <SelectValue
                              placeholder={
                                !selectedSecondPlayerSportId
                                  ? "Select sport first"
                                  : secondPlayerOptionsBySport.length
                                  ? "Select player"
                                  : "No players available"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {secondPlayerOptionsBySport.length === 0 && (
                              <SelectItem value="none" disabled>
                                No players
                              </SelectItem>
                            )}
                            {secondPlayerOptionsBySport.map((player) => (
                              <SelectItem key={player.registration_id} value={String(player.registration_id)}>
                                <div className="flex items-center gap-2">
                                  <span>{player.name}</span>
                                  <span className="text-white/60 text-xs">({player.sport_day})</span>
                                  {player.main_player && (
                                    <Badge variant="outline" className="text-xs">
                                      Main
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2 md:col-span-2">
                      <label
                        htmlFor="destination-select"
                        className="text-sm font-medium text-white/80"
                      >
                        Destination sport
                      </label>
                      <Select
                        value={selectedDestinationSportId}
                        onValueChange={setSelectedDestinationSportId}
                        disabled={!selectedRegistrationId}
                      >
                        <SelectTrigger
                          id="destination-select"
                          className="w-full border-white/20 bg-white/10 text-white disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                          <SelectValue
                            placeholder={
                              !selectedRegistrationId
                                ? "Select primary player first"
                                : eligibleDestinationSports.length
                                ? "Select destination sport"
                                : "No slots available"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {eligibleDestinationSports.length === 0 && (
                            <SelectItem value="none" disabled>
                              No available slots
                            </SelectItem>
                          )}
                          {eligibleDestinationSports.map((sport) => (
                            <SelectItem
                              key={sport.sport_id}
                              value={String(sport.sport_id)}
                            >
                              {sport.sport_name} · {sport.gender_type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  <label
                    htmlFor="reason-input"
                    className="text-sm font-medium text-white/80"
                  >
                    Reason
                  </label>
                  <textarea
                    id="reason-input"
                    className="min-h-[120px] w-full rounded-xl border border-white/15 bg-white/10 p-4 text-sm text-white placeholder:text-white/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 resize-none mt-2"
                    placeholder="Explain why this change is needed"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  {/* <p className="text-xs text-white/60">
                    {reason.length}/500
                  </p> */}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !selectedRegistrationId || !reason.trim()}
                    className="min-w-[180px] bg-cranberry/70 border border-cranberry hover:bg-cranberry disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-white"
                  >
                    {submitting ? (
                        <>
                          <img src="/load.svg" alt="Loading" className="w-4 h-4 mr-2 inline" />
                          Submitting…
                        </>
                      ) : (
                      <>
                        Submit
                        <ArrowRight className="h-4 w-4 inline" />
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetForm}
                    disabled={submitting}
                    className="text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </section>
          )}

          <aside className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/10" aria-label="Swap context">
            <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-4">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-amber-200" aria-hidden="true" />
                <div>
                  <p className="text-xs uppercase tracking-wide text-amber-200/80">
                    Swap window
                  </p>
                  <p className="text-sm font-semibold text-amber-100">
                    {formatDateLabel(APP_CONFIG.REPLACEMENT_OPENING)} —
                    {" "}
                    {formatDateLabel(APP_CONFIG.REPLACEMENT_DEADLINE)}
                  </p>
                </div>
              </div>
            </div>

            <section className="space-y-3 max-h-[450px] overflow-y-scroll hide-scrollbar">
              <h2 className="text-sm font-semibold text-white/80">
                Recent requests
              </h2>
              {context.requests.length === 0 ? (
                <p className="text-sm text-white/60">No swap requests yet.</p>
              ) : (
                <div className="space-y-3">
                  {context.requests.map((request) => {
                    const statusMeta = getStatusMeta(request.status);
                    return (
                      <article
                        key={request.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              Swap #{request.id}
                            </p>
                            <p className="text-xs text-white/60">
                              Submitted {formatDateTime(request.created_at)}
                            </p>
                          </div>
                          <Badge className={statusMeta.className}>
                            {statusMeta.label}
                          </Badge>
                        </div>

                        <div className="mt-3 space-y-2 text-sm text-white/80">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-white/60" aria-hidden="true" />
                            <div className="flex flex-1 items-center gap-2">
                              <span className="font-medium">
                                {request.player_one?.name || request.player_one?.RMIS_ID || "-"}
                              </span>
                              <ArrowRight className="h-4 w-4 text-white/50" aria-hidden="true" />
                              <span className="font-medium">
                                {request.player_two?.name || request.player_two?.RMIS_ID || request.sport_two?.sport_name || "-"}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-white/60">
                            {request.reason || "No reason provided"}
                          </p>
                          {/* supporting link removed from portal flow */}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </PrivateRoute>
  );
};

export default SwapsPage;
