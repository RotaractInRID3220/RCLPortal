import { atom, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const userDeetsAtom = atomWithStorage('userDeets', null);
export const loadingAtom = atom(false);

// Enhanced sports data atoms with caching
export const sportsDataAtom = atomWithStorage('sportsData', []);
export const sportsLoadingAtom = atom(false);

// Enhanced clubs data atoms with caching
export const clubsDataAtom = atomWithStorage('clubsData', []);

// Cache timestamp atoms for tracking data freshness
export const lastFetchTimestampAtom = atomWithStorage('lastFetchTimestamp', {
  sports: 0,
  clubs: 0,
  leaderboard: 0,
  clubPoints: 0,
  adminDashboard: 0,
  portalDashboard: 0
});

// Cache duration constants (in milliseconds)
export const CACHE_DURATION = {
  sports: 2 * 60 * 1000,          // 2 minutes for sports data
  clubs: 10 * 60 * 1000,         // 10 minutes for clubs data
  leaderboard: 2 * 60 * 1000,    // 2 minutes for leaderboard data (frequently updated)
  clubPoints: 2 * 60 * 1000,     // 2 minutes for club points
  adminDashboard: 1 * 60 * 1000, // 1 minute for admin dashboard (high priority data)
  portalDashboard: 2 * 60 * 1000 // 2 minutes for portal dashboard (user-specific data)
};

// Helper function to check cache validity
export const isCacheValid = (timestamp, type = 'sports') => {
  if (!timestamp) return false;
  return Date.now() - timestamp < CACHE_DURATION[type];
};

// Cache invalidation helper
export const invalidateCacheAtom = atom(
  null,
  (get, set, cacheType) => {
    set(lastFetchTimestampAtom, (prev) => ({
      ...prev,
      [cacheType]: 0
    }));
  }
);

// Matches/Games atoms
export const matchesAtom = atom([]);
export const matchesLoadingAtom = atom(false);
export const matchesErrorAtom = atom(null);

// Tournament Bracket atoms
export const bracketDataAtom = atom([]);
export const bracketLoadingAtom = atom(false);
export const bracketErrorAtom = atom(null);
export const selectedSportAtom = atom(4); // Default sport ID

// Clubs atoms (keeping for backward compatibility)
export const clubsAtom = atom([]);
export const clubMembersAtom = atom([]);
export const clubsLoadingAtom = atom(false);

// Admin Dashboard atoms with enhanced caching
export const adminDashboardDataAtom = atomWithStorage('adminDashboardData', {
  stats: {
    totalClubs: 0,
    totalPlayers: 0,
    communityClubs: 0,
    instituteClubs: 0
  },
  leaderboard: [],
  pendingRequests: 0
});

// Legacy atoms (kept for backward compatibility)
export const adminStatsAtom = atom(
  (get) => get(adminDashboardDataAtom).stats,
  (get, set, update) => {
    const current = get(adminDashboardDataAtom);
    set(adminDashboardDataAtom, { ...current, stats: update });
  }
);

export const adminLeaderboardAtom = atom(
  (get) => get(adminDashboardDataAtom).leaderboard,
  (get, set, update) => {
    const current = get(adminDashboardDataAtom);
    set(adminDashboardDataAtom, { ...current, leaderboard: update });
  }
);

export const pendingRequestsAtom = atom(
  (get) => get(adminDashboardDataAtom).pendingRequests,
  (get, set, update) => {
    const current = get(adminDashboardDataAtom);
    set(adminDashboardDataAtom, { ...current, pendingRequests: update });
  }
);

export const adminStatsLoadingAtom = atom(false);
export const adminStatsErrorAtom = atom(null);
export const adminLeaderboardLoadingAtom = atom(false);
export const clubsErrorAtom = atom(null);

// Leaderboard data atoms with caching
export const leaderboardDataAtom = atomWithStorage('leaderboardData', {
  community: [],
  institute: []
});
export const leaderboardLoadingAtom = atom(false);
export const leaderboardErrorAtom = atom(null);

// Club points cache atoms
export const clubPointsDataAtom = atomWithStorage('clubPointsData', {});
export const clubPointsLoadingAtom = atom(false);

// Portal Dashboard atoms with enhanced caching
export const portalDashboardDataAtom = atomWithStorage('portalDashboardData', {
  stats: {
    registeredEvents: 0,
    registeredPlayers: 0,
    totalPoints: 0,
    clubRank: 0,
    clubInfo: {
      club_id: null,
      club_name: '',
      category: ''
    }
  },
  leaderboard: []
});

export const portalStatsAtom = atom(
  (get) => get(portalDashboardDataAtom).stats,
  (get, set, update) => {
    const current = get(portalDashboardDataAtom);
    set(portalDashboardDataAtom, { ...current, stats: update });
  }
);

export const portalLeaderboardAtom = atom(
  (get) => get(portalDashboardDataAtom).leaderboard,
  (get, set, update) => {
    const current = get(portalDashboardDataAtom);
    set(portalDashboardDataAtom, { ...current, leaderboard: update });
  }
);

export const portalStatsLoadingAtom = atom(false);
export const portalStatsErrorAtom = atom(null);
export const portalLeaderboardLoadingAtom = atom(false);




export function useResetAllAtoms() {
  const setUserDeets = useSetAtom(userDeetsAtom);
  const setSportsData = useSetAtom(sportsDataAtom);
  const setSportsLoading = useSetAtom(sportsLoadingAtom);
  const setClubsData = useSetAtom(clubsDataAtom);
  const setLastFetchTimestamp = useSetAtom(lastFetchTimestampAtom);
  const setMatches = useSetAtom(matchesAtom);
  const setMatchesLoading = useSetAtom(matchesLoadingAtom);
  const setMatchesError = useSetAtom(matchesErrorAtom);
  const setClubs = useSetAtom(clubsAtom);
  const setClubsLoading = useSetAtom(clubsLoadingAtom);
  const setClubsError = useSetAtom(clubsErrorAtom);
  const setBracketData = useSetAtom(bracketDataAtom);
  const setBracketLoading = useSetAtom(bracketLoadingAtom);
  const setBracketError = useSetAtom(bracketErrorAtom);
  const setClubMembers = useSetAtom(clubMembersAtom);

  return () => {
    setUserDeets(null);
    setSportsData([]);
    setSportsLoading(false);
    setClubsData([]);
    setLastFetchTimestamp({ sports: 0, clubs: 0, leaderboard: 0, clubPoints: 0, adminDashboard: 0, portalDashboard: 0 });
    setMatches([]);
    setMatchesLoading(false);
    setMatchesError(null);
    setClubs([]);
    setClubsLoading(false);
    setClubsError(null);
    setBracketData([]);
    setBracketLoading(false);
    setBracketError(null);
    setClubMembers([]);
  };
}