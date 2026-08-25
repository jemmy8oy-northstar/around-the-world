import type { Page } from "@playwright/test";

/**
 * Deterministic API mocks for the e2e suite.
 *
 * Every backend call the frontend makes is fulfilled here with a fixed fixture,
 * so the tests never touch a real server and render identically every run.
 * Add a new route here whenever the frontend starts calling a new endpoint.
 */

const SESSION = {
  accessToken: "e2e-access-token",
  accessTokenExpiresAt: "2026-08-27T08:00:00Z",
  refreshToken: "e2e-refresh-token",
  userId: "11111111-1111-1111-1111-111111111111",
  username: "Dave",
  isAdmin: false,
};

const POSTS = [
  {
    id: "00000000-0000-0000-0000-000000000005",
    userId: SESSION.userId,
    username: "Dave",
    photoUrl: "",
    caption: "Another Guinness. No notes.",
    countryCode: "IE",
    stopNumber: 2,
    createdAt: "2026-08-26T21:10:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    userId: "22222222-2222-2222-2222-222222222222",
    username: "Priya",
    photoUrl: "",
    caption: "Kingfisher, ice cold",
    countryCode: "IN",
    stopNumber: 2,
    createdAt: "2026-08-26T21:02:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    userId: "33333333-3333-3333-3333-333333333333",
    username: "Sam",
    photoUrl: "",
    caption: "Sapporo — crisp",
    countryCode: "JP",
    stopNumber: 1,
    createdAt: "2026-08-26T20:20:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000001",
    userId: SESSION.userId,
    username: "Dave",
    photoUrl: "",
    caption: "Guinness, obviously. Setting the tone.",
    countryCode: "IE",
    stopNumber: 1,
    createdAt: "2026-08-26T20:05:00Z",
  },
];

const TALLY = [
  { countryCode: "IE", postCount: 2 },
  { countryCode: "IN", postCount: 1 },
  { countryCode: "JP", postCount: 1 },
];

export interface MockOptions {
  /** Drives the banner and whether the composer is available. */
  mode?: "Practice" | "Live" | "Finished";
  posts?: typeof POSTS;
  tally?: typeof TALLY;
  /** Admin-only: who the feed should mark as hidden from everyone else. */
  bannedUsernames?: string[];
}

export async function mockApi(
  page: Page,
  options: MockOptions = {},
): Promise<void> {
  const {
    mode = "Live",
    posts = POSTS,
    tally = TALLY,
    bannedUsernames = [],
  } = options;

  await page.route("**/api/game", (route) =>
    route.fulfill({
      json: {
        mode,
        roundId: 1,
        roundName: "Round 1",
        currentStopNumber: 2,
        goLiveAt: "2026-08-28T16:00:00Z",
        readOnlyAt: "2026-08-29T04:00:00Z",
      },
    }),
  );

  // Mirrors the real endpoint rather than always saying yes: a guest joins on a
  // name alone, and the host's name is refused with 403 until the code comes
  // with it. A mock that accepted everything would let the join screen drop the
  // host gate entirely and still pass.
  await page.route("**/api/auth/join", (route) => {
    const body = route.request().postDataJSON() as {
      username?: string;
      partyCode?: string | null;
    };
    const isHost = (body?.username ?? "").trim().toLowerCase() === "james";

    if (isHost && body?.partyCode?.trim() !== "260802") {
      return route.fulfill({
        status: 403,
        contentType: "application/problem+json",
        json: {
          status: 403,
          title: "Forbidden",
          detail: "That name is the host's. Enter the host code to claim it.",
        },
      });
    }

    return route.fulfill({
      json: isHost ? { ...SESSION, username: "james", isAdmin: true } : SESSION,
    });
  });
  await page.route("**/api/auth/refresh", (route) =>
    route.fulfill({ json: SESSION }),
  );

  // Query string included, so the per-country feed is matched too.
  await page.route("**/api/posts**", (route) => {
    if (route.request().method() !== "GET")
      return route.fulfill({ status: 201, json: posts[0] });

    const country = new URL(route.request().url()).searchParams.get("country");
    const filtered = country
      ? posts.filter(
          (p) => p.countryCode.toLowerCase() === country.toLowerCase(),
        )
      : posts;

    return route.fulfill({ json: filtered });
  });

  await page.route("**/api/countries", (route) =>
    route.fulfill({ json: tally }),
  );
  await page.route("**/api/admin/**", (route) =>
    route.fulfill({ status: 200, json: 3 }),
  );

  // Registered after the catch-all, which returns the bare number the pub-stop
  // route answers with — Playwright uses the last matching route, and this one
  // has to win. Without it the banned-users query would hand the feed a `3`
  // where it expects a list of names.
  await page.route("**/api/admin/users/banned", (route) =>
    route.fulfill({ json: bannedUsernames }),
  );
}

/** Puts a session in storage so a spec can start on an authenticated screen. */
export async function signIn(page: Page): Promise<void> {
  await page.addInitScript(
    (session) =>
      window.localStorage.setItem("atw.session", JSON.stringify(session)),
    SESSION,
  );
}

/**
 * Signs in as the one player who owns the admin surface. Separate from
 * {@link signIn} so every existing spec keeps running as an ordinary guest —
 * the admin sees controls on other people's posts, and a shared fixture would
 * quietly change what half the suite is testing.
 */
export async function signInAsAdmin(page: Page): Promise<void> {
  await page.addInitScript(
    (session) =>
      window.localStorage.setItem("atw.session", JSON.stringify(session)),
    { ...SESSION, username: "james", isAdmin: true },
  );
}
