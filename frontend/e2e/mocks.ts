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
}

export async function mockApi(
  page: Page,
  options: MockOptions = {},
): Promise<void> {
  const { mode = "Live", posts = POSTS, tally = TALLY } = options;

  await page.route("**/api/game", (route) =>
    route.fulfill({
      json: {
        mode,
        roundId: 1,
        roundName: "Round 1",
        currentStopNumber: 2,
        goLiveAt: "2026-08-26T16:00:00Z",
        readOnlyAt: "2026-08-27T04:00:00Z",
      },
    }),
  );

  await page.route("**/api/auth/join", (route) =>
    route.fulfill({ json: SESSION }),
  );
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
}

/** Puts a session in storage so a spec can start on an authenticated screen. */
export async function signIn(page: Page): Promise<void> {
  await page.addInitScript(
    (session) =>
      window.localStorage.setItem("atw.session", JSON.stringify(session)),
    SESSION,
  );
}
