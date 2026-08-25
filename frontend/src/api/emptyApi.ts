import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { Mutex } from "./mutex";
import { readSession, writeSession, clearSession } from "../auth/tokenStorage";
import { sessionEnded, sessionEstablished } from "../auth/sessionSlice";

const rawBaseQuery = fetchBaseQuery({
  // The generated endpoint URLs already carry the /api prefix, so this must stay
  // at the root or every request goes to /api/api/...
  baseUrl: "/",
  prepareHeaders: (headers) => {
    const session = readSession();
    if (session) headers.set("Authorization", `Bearer ${session.accessToken}`);

    // The admin page holds its key separately: it is not a player credential and
    // must survive not being joined to the game at all.
    const adminKey = window.sessionStorage.getItem("atw.adminKey");
    if (adminKey) headers.set("X-Admin-Key", adminKey);

    return headers;
  },
});

// Serialises refreshes. Without this, a screen that fires three queries at once
// on an expired token would burn three refresh tokens — and because they are
// single-use, the last two would fail and log the user out mid-crawl.
const refreshMutex = new Mutex();

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  await refreshMutex.waitForUnlock();

  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status !== 401) return result;

  const session = readSession();
  if (!session) return result;

  if (refreshMutex.isLocked()) {
    // Another call is already refreshing — wait for it, then retry with whatever
    // token it landed on.
    await refreshMutex.waitForUnlock();
    return rawBaseQuery(args, api, extraOptions);
  }

  const release = await refreshMutex.acquire();

  try {
    const refreshResult = await rawBaseQuery(
      {
        url: "/api/auth/refresh",
        method: "POST",
        body: { refreshToken: session.refreshToken },
      },
      api,
      extraOptions,
    );

    const refreshed = refreshResult.data as
      | {
          accessToken: string;
          refreshToken: string;
          userId: string;
          username: string;
        }
      | undefined;

    if (!refreshed?.accessToken) {
      clearSession();
      api.dispatch(sessionEnded());
      return result;
    }

    const next = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken,
      userId: refreshed.userId,
      username: refreshed.username,
    };

    writeSession(next);
    api.dispatch(sessionEstablished(next));

    result = await rawBaseQuery(args, api, extraOptions);
  } finally {
    release();
  }

  return result;
};

export const emptySplitApi = createApi({
  baseQuery: baseQueryWithReauth,
  tagTypes: ["Posts", "Countries", "Game"],
  endpoints: () => ({}),
});
