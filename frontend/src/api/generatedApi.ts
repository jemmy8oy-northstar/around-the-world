import { emptySplitApi as api } from "./emptyApi";
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    getStatus: build.query<GetStatusApiResponse, GetStatusApiArg>({
      query: () => ({ url: `/api/status` }),
    }),
    getGameState: build.query<GetGameStateApiResponse, GetGameStateApiArg>({
      query: () => ({ url: `/api/game` }),
    }),
    join: build.mutation<JoinApiResponse, JoinApiArg>({
      query: (queryArg) => ({
        url: `/api/auth/join`,
        method: "POST",
        body: queryArg.joinRequest,
      }),
    }),
    refresh: build.mutation<RefreshApiResponse, RefreshApiArg>({
      query: (queryArg) => ({
        url: `/api/auth/refresh`,
        method: "POST",
        body: queryArg.refreshRequest,
      }),
    }),
    getPosts: build.query<GetPostsApiResponse, GetPostsApiArg>({
      query: (queryArg) => ({
        url: `/api/posts`,
        params: {
          country: queryArg.country,
        },
      }),
    }),
    createPost: build.mutation<CreatePostApiResponse, CreatePostApiArg>({
      query: (queryArg) => ({
        url: `/api/posts`,
        method: "POST",
        body: queryArg.body,
      }),
    }),
    deletePost: build.mutation<DeletePostApiResponse, DeletePostApiArg>({
      query: (queryArg) => ({
        url: `/api/posts/${queryArg.postId}`,
        method: "DELETE",
      }),
    }),
    getCountryTally: build.query<
      GetCountryTallyApiResponse,
      GetCountryTallyApiArg
    >({
      query: () => ({ url: `/api/countries` }),
    }),
    advancePubStop: build.mutation<
      AdvancePubStopApiResponse,
      AdvancePubStopApiArg
    >({
      query: () => ({ url: `/api/admin/stop/next`, method: "POST" }),
    }),
    startNewRound: build.mutation<
      StartNewRoundApiResponse,
      StartNewRoundApiArg
    >({
      query: (queryArg) => ({
        url: `/api/admin/round`,
        method: "POST",
        body: queryArg.startRoundRequest,
      }),
    }),
    updateCutovers: build.mutation<
      UpdateCutoversApiResponse,
      UpdateCutoversApiArg
    >({
      query: (queryArg) => ({
        url: `/api/admin/settings`,
        method: "PUT",
        body: queryArg.updateCutoversRequest,
      }),
    }),
    getShadowBannedUsers: build.query<
      GetShadowBannedUsersApiResponse,
      GetShadowBannedUsersApiArg
    >({
      query: () => ({ url: `/api/admin/users/banned` }),
    }),
    setShadowBan: build.mutation<SetShadowBanApiResponse, SetShadowBanApiArg>({
      query: (queryArg) => ({
        url: `/api/admin/users/${queryArg.username}/ban`,
        method: "POST",
        body: queryArg.shadowBanRequest,
      }),
    }),
    releaseUsername: build.mutation<
      ReleaseUsernameApiResponse,
      ReleaseUsernameApiArg
    >({
      query: (queryArg) => ({
        url: `/api/admin/users/${queryArg.username}/release`,
        method: "POST",
      }),
    }),
    adminDeletePost: build.mutation<
      AdminDeletePostApiResponse,
      AdminDeletePostApiArg
    >({
      query: (queryArg) => ({
        url: `/api/admin/posts/${queryArg.postId}`,
        method: "DELETE",
      }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as enhancedApi };
export type GetStatusApiResponse = unknown;
export type GetStatusApiArg = void;
export type GetGameStateApiResponse = /** status 200 OK */ GameState;
export type GetGameStateApiArg = void;
export type JoinApiResponse = /** status 200 OK */ AuthSession;
export type JoinApiArg = {
  joinRequest: JoinRequest;
};
export type RefreshApiResponse = /** status 200 OK */ AuthSession;
export type RefreshApiArg = {
  refreshRequest: RefreshRequest;
};
export type GetPostsApiResponse = /** status 200 OK */ Post[];
export type GetPostsApiArg = {
  country?: string;
};
export type CreatePostApiResponse = /** status 201 Created */ Post;
export type CreatePostApiArg = {
  body: {
    photo: IFormFile;
  } & {
    caption: string;
  } & {
    countryCode: string;
  };
};
export type DeletePostApiResponse = unknown;
export type DeletePostApiArg = {
  postId: string;
};
export type GetCountryTallyApiResponse = /** status 200 OK */ CountryTally[];
export type GetCountryTallyApiArg = void;
export type AdvancePubStopApiResponse = /** status 200 OK */ number;
export type AdvancePubStopApiArg = void;
export type StartNewRoundApiResponse = /** status 200 OK */ number;
export type StartNewRoundApiArg = {
  startRoundRequest: StartRoundRequest;
};
export type UpdateCutoversApiResponse = unknown;
export type UpdateCutoversApiArg = {
  updateCutoversRequest: UpdateCutoversRequest;
};
export type GetShadowBannedUsersApiResponse = /** status 200 OK */ string[];
export type GetShadowBannedUsersApiArg = void;
export type SetShadowBanApiResponse = unknown;
export type SetShadowBanApiArg = {
  username: string;
  shadowBanRequest: ShadowBanRequest;
};
export type ReleaseUsernameApiResponse = unknown;
export type ReleaseUsernameApiArg = {
  username: string;
};
export type AdminDeletePostApiResponse = unknown;
export type AdminDeletePostApiArg = {
  postId: string;
};
export type GameMode = "Practice" | "Live" | "Finished";
export type GameState = {
  mode?: GameMode;
  roundId?: number;
  roundName: string;
  currentStopNumber?: number;
  goLiveAt?: string;
  readOnlyAt?: string;
};
export type ProblemDetails = {
  type?: null | string;
  title?: null | string;
  status?: null | number;
  detail?: null | string;
  instance?: null | string;
};
export type AuthSession = {
  accessToken: string;
  accessTokenExpiresAt?: string;
  refreshToken: string;
  userId?: string;
  username: string;
  isAdmin?: boolean;
};
export type JoinRequest = {
  partyCode?: null | string;
  username: string;
};
export type RefreshRequest = {
  refreshToken: string;
};
export type Post = {
  id?: string;
  userId?: string;
  username: string;
  photoUrl: string;
  caption: string;
  countryCode: string;
  stopNumber?: number;
  createdAt?: string;
};
export type IFormFile = Blob;
export type CountryTally = {
  countryCode: string;
  postCount?: number;
};
export type StartRoundRequest = {
  name?: null | string;
};
export type UpdateCutoversRequest = {
  goLiveAt?: string;
  readOnlyAt?: string;
};
export type ShadowBanRequest = {
  isShadowBanned?: boolean;
};
export const {
  useGetStatusQuery,
  useGetGameStateQuery,
  useJoinMutation,
  useRefreshMutation,
  useGetPostsQuery,
  useCreatePostMutation,
  useDeletePostMutation,
  useGetCountryTallyQuery,
  useAdvancePubStopMutation,
  useStartNewRoundMutation,
  useUpdateCutoversMutation,
  useGetShadowBannedUsersQuery,
  useSetShadowBanMutation,
  useReleaseUsernameMutation,
  useAdminDeletePostMutation,
} = injectedRtkApi;
