/**
 * Cache wiring for the generated endpoints.
 *
 * The codegen output is overwritten wholesale by `npm run codegen`, so tags are
 * layered on here instead. Without them, posting a drink would leave the feed,
 * the map and the leaderboard showing stale data until a full page reload.
 */
import { enhancedApi } from "./generatedApi";

export const atwApi = enhancedApi.enhanceEndpoints({
  addTagTypes: ["Posts", "Countries", "Game"],
  endpoints: {
    getPosts: { providesTags: ["Posts"] },
    getCountryTally: { providesTags: ["Countries"] },
    getGameState: { providesTags: ["Game"] },
    deletePost: { invalidatesTags: ["Posts", "Countries"] },
    adminDeletePost: { invalidatesTags: ["Posts", "Countries"] },
    advancePubStop: { invalidatesTags: ["Game"] },
    startNewRound: { invalidatesTags: ["Game", "Posts", "Countries"] },
    updateCutovers: { invalidatesTags: ["Game"] },
    setShadowBan: { invalidatesTags: ["Posts", "Countries"] },
  },
});

export const {
  useGetGameStateQuery,
  useJoinMutation,
  useGetPostsQuery,
  useDeletePostMutation,
  useGetCountryTallyQuery,
  useAdvancePubStopMutation,
  useStartNewRoundMutation,
  useUpdateCutoversMutation,
  useSetShadowBanMutation,
  useReleaseUsernameMutation,
  useAdminDeletePostMutation,
} = atwApi;
