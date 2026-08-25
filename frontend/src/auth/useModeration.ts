import {
  useGetShadowBannedUsersQuery,
  useSetShadowBanMutation,
} from "../api/atwApi";
import { useSession } from "./useSession";

/**
 * Everything a feed needs to offer moderation, in one place, so the feed and the
 * per-country feed cannot drift into offering different controls.
 *
 * The banned-users query is skipped entirely for ordinary players: it is
 * admin-gated server-side and would 403 on every feed render, filling their
 * console with errors and the network tab with pointless traffic.
 */
export function useModeration() {
  const session = useSession();
  const canModerate = session?.isAdmin === true;

  const { data: shadowBannedUsernames } = useGetShadowBannedUsersQuery(
    undefined,
    { skip: !canModerate },
  );

  const [setShadowBan] = useSetShadowBanMutation();

  return {
    canModerate,
    shadowBannedUsernames,
    onShadowBan: (username: string, shadowBan: boolean) =>
      setShadowBan({ username, shadowBanRequest: { isShadowBanned: shadowBan } }),
  };
}
