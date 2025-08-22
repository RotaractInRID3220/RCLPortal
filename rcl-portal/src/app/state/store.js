import { atom, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const userDeetsAtom = atomWithStorage('userDeets', null);
export const loadingAtom = atom(false);
export const sportsDataAtom = atom([]);
export const sportsLoadingAtom = atom(false);



export function useResetAllAtoms() {
  const setUserDeets = useSetAtom(userDeetsAtom);
  const setSportsData = useSetAtom(sportsDataAtom);
  const setSportsLoading = useSetAtom(sportsLoadingAtom);

  return () => {
    setUserDeets(null);
    setSportsData([]);
    setSportsLoading(false);
  };
}