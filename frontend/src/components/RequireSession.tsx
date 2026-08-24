import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSession } from "../auth/useSession";

/**
 * Sends anyone without a session to the join screen, remembering where they were
 * headed so a shared link to a country feed still lands correctly after joining.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (!session) {
    return (
      <Navigate
        to="/join"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}
