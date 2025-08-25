import { atom, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const userDeetsAtom = atomWithStorage('userDeets', null);
export const loadingAtom = atom(false);
export const sportsDataAtom = atom([]);
export const sportsLoadingAtom = atom(false);

// Matches/Games atoms
export const matchesAtom = atom([]);
export const matchesLoadingAtom = atom(false);
export const matchesErrorAtom = atom(null);

// Tournament Bracket atoms
export const bracketDataAtom = atom([]);
export const bracketLoadingAtom = atom(false);
export const bracketErrorAtom = atom(null);
export const selectedSportAtom = atom(4); // Default sport ID

// Clubs atoms
export const clubsAtom = atom([]);
export const clubsLoadingAtom = atom(false);
export const clubsErrorAtom = atom(null);



export function useResetAllAtoms() {
  const setUserDeets = useSetAtom(userDeetsAtom);
  const setSportsData = useSetAtom(sportsDataAtom);
  const setSportsLoading = useSetAtom(sportsLoadingAtom);
  const setMatches = useSetAtom(matchesAtom);
  const setMatchesLoading = useSetAtom(matchesLoadingAtom);
  const setMatchesError = useSetAtom(matchesErrorAtom);
  const setClubs = useSetAtom(clubsAtom);
  const setClubsLoading = useSetAtom(clubsLoadingAtom);
  const setClubsError = useSetAtom(clubsErrorAtom);
  const setBracketData = useSetAtom(bracketDataAtom);
  const setBracketLoading = useSetAtom(bracketLoadingAtom);
  const setBracketError = useSetAtom(bracketErrorAtom);

  return () => {
    setUserDeets(null);
    setSportsData([]);
    setSportsLoading(false);
    setMatches([]);
    setMatchesLoading(false);
    setMatchesError(null);
    setClubs([]);
    setClubsLoading(false);
    setClubsError(null);
    setBracketData([]);
    setBracketLoading(false);
    setBracketError(null);
  };
}