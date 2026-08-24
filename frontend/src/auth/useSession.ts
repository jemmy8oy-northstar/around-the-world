import { useSelector } from "react-redux";
import type { RootState } from "../store";

export function useSession() {
  return useSelector((state: RootState) => state.session.session);
}
