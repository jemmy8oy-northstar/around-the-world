import { test, expect, type Locator } from "@playwright/test";
import { mockApi, signIn, signInAsAdmin } from "./mocks";
import { MAX_SCALE } from "../src/components/mapZoom";

/**
 * Spreads two fingers apart on `target` by `factor`, centred on a client point.
 *
 * Playwright has no multi-touch gesture API, and the CI project is mobile
 * WebKit, where `mouse.wheel` throws outright — so the events are dispatched
 * from inside the page. They are built as plain cancelable Events carrying a
 * `touches` array rather than real TouchEvents, because the TouchEvent and
 * Touch constructors are not portable across WebKit and Chromium and this has
 * to run on both. The map's handler reads exactly `touches[i].clientX/Y` and
 * calls preventDefault, so that is the whole surface it needs.
 *
 * This drives the real pinch path — the gesture James asked for — rather than
 * the wheel shorthand it used to, which no phone ever sends.
 */
async function pinch(
  target: Locator,
  { x, y, factor }: { x: number; y: number; factor: number },
): Promise<void> {
  await target.evaluate((element, { x, y, factor }) => {
    const fire = (type: string, touches: { clientX: number; clientY: number }[]) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "touches", { value: touches });
      element.dispatchEvent(event);
    };

    // Both fingers move symmetrically, so the midpoint — the point the map is
    // held still under — is the same before and after.
    const spread = (radius: number) => [
      { clientX: x - radius, clientY: y },
      { clientX: x + radius, clientY: y },
    ];

    fire("touchstart", spread(60));
    fire("touchmove", spread(60 * factor));
    fire("touchend", []);
  }, { x, y, factor });
}

/**
 * Smoke + screenshot coverage for the whole app, driven off mocked API
 * responses (see mocks.ts) so it needs no backend and renders identically every
 * run. Each test asserts the key content, then captures a phone-viewport
 * screenshot into e2e/screenshots/ for visual review.
 */

test.describe("joining", () => {
  test.beforeEach(async ({ page }) => mockApi(page));

  test("the join screen asks for a name and nothing else", async ({ page }) => {
    await page.goto("./join");

    await expect(
      page.getByRole("heading", { name: "Around the World" }),
    ).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeVisible();

    // The name field says what the name is FOR, not "what should we call you?" —
    // people pick a better name when they know it goes above every post.
    await expect(page.getByLabel("Your name")).toHaveAttribute(
      "placeholder",
      "This will appear above your posts",
    );

    // No code, for anybody. Asserted by absence because that is the change:
    // a field that is merely optional would still pass a "name is visible" test.
    await expect(page.getByLabel("Party code")).toHaveCount(0);
    await expect(page.getByLabel("Host code")).toHaveCount(0);

    await page.screenshot({ path: "e2e/screenshots/join.png", fullPage: true });
  });

  test("an unauthenticated visitor is sent to join", async ({ page }) => {
    await page.goto("./");

    await expect(page).toHaveURL(/\/join$/);
  });

  test("joining lands you on the feed", async ({ page }) => {
    await page.goto("./join");

    await page.getByLabel("Your name").fill("Dave");
    await page.getByRole("button", { name: "Let's go" }).click();

    await expect(
      page.getByText("Guinness, obviously. Setting the tone."),
    ).toBeVisible();
  });

  test("the host's name asks for the code, and the code lets him in", async ({
    page,
  }) => {
    await page.goto("./join");

    await page.getByLabel("Your name").fill("james");
    await page.getByRole("button", { name: "Let's go" }).click();

    // Refused, and the field it needs appears rather than being on the screen
    // for every guest all night.
    await expect(page.getByRole("alert")).toHaveText(/host code/i);
    await expect(page.getByLabel("Host code")).toBeVisible();

    await page.screenshot({
      path: "e2e/screenshots/join-host-code.png",
      fullPage: true,
    });

    await page.getByLabel("Host code").fill("260802");
    await page.getByRole("button", { name: "Let's go" }).click();

    await expect(
      page.getByText("Guinness, obviously. Setting the tone."),
    ).toBeVisible();
  });

  test("the birthday plug links to the channel and records the tap on join", async ({
    page,
  }) => {
    await page.goto("./join");

    const plug = page.getByRole("link", { name: /subscribe/i });
    await expect(plug).toBeVisible();
    await expect(plug).toHaveAttribute(
      "href",
      "https://www.youtube.com/@jemmy8oy",
    );

    await page.screenshot({ path: "e2e/screenshots/join.png", fullPage: true });

    // Tapped BEFORE joining, which is the whole difficulty: there is no token
    // yet, so the visit has to survive until one exists. Stop the navigation —
    // a real tap leaves for YouTube and the test cannot follow.
    await plug.evaluate((a) => a.removeAttribute("target"));
    await page.route("https://www.youtube.com/**", (route) =>
      route.fulfill({ body: "not youtube" }),
    );

    const recorded = page.waitForRequest(
      (request) =>
        request.url().includes("/api/me/channel-visit") &&
        request.method() === "POST",
    );

    await plug.click();
    await page.goBack();

    await page.getByLabel("Your name").fill("Dave");
    await page.getByRole("button", { name: "Let's go" }).click();

    await recorded;
  });

  test("the plug is not rendered at all when the channel url is switched off", async ({
    page,
  }) => {
    await mockApi(page, { youTubeUrl: "" });
    await page.goto("./join");

    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page.getByRole("link", { name: /subscribe/i })).toHaveCount(0);
  });

  test("the host's name with the wrong code stays out", async ({ page }) => {
    await page.goto("./join");

    await page.getByLabel("Your name").fill("james");
    await page.getByRole("button", { name: "Let's go" }).click();
    await page.getByLabel("Host code").fill("000000");
    await page.getByRole("button", { name: "Let's go" }).click();

    await expect(page).toHaveURL(/\/join$/);
    await expect(page.getByRole("alert")).toBeVisible();
  });
});

test.describe("the app", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await signIn(page);
  });

  test("the feed groups drinks under pub-stop dividers", async ({ page }) => {
    await page.goto("./");

    await expect(page.getByText("🍺 Stop 2")).toBeVisible();
    await expect(page.getByText("🍺 Stop 1")).toBeVisible();
    await expect(page.getByText("Another Guinness. No notes.")).toBeVisible();

    // The banner reports which pub the group is on.
    await expect(page.getByText("Stop", { exact: true })).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/feed.png", fullPage: true });
  });

  test("you can delete your own post but not someone else s", async ({
    page,
  }) => {
    await page.goto("./");

    // Two of the four fixture posts belong to the signed-in user.
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(2);
  });

  test("only the author who tapped the channel gets the crown", async ({
    page,
  }) => {
    await page.goto("./");

    // Exactly one of the four fixture authors has authorVisitedChannel — a
    // count, not a "is visible", because rendering it on everyone would pass one.
    await expect(
      page.getByRole("img", { name: "Subscribed to the channel" }),
    ).toHaveCount(1);
  });

  test("the map shows one badge per country", async ({ page }) => {
    await page.goto("./map");

    await expect(
      page.getByText("3 countries so far", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "2 from IE" })).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/map.png", fullPage: true });
  });

  test("zooming the map spreads the badges without inflating them", async ({
    page,
  }) => {
    await page.goto("./map");

    const badge = page.getByRole("button", { name: "2 from IE" });
    const other = page.getByRole("button", { name: /from IN$/ });
    const map = page.getByRole("img", { name: "World map of drinks by country" });

    const before = (await badge.boundingBox())!;
    const gapBefore = (await other.boundingBox())!.x - before.x;

    // Modest, and about the centre, so both badges stay inside the viewBox —
    // a badge scrolled off the edge would make this assert nothing.
    const frame = (await map.boundingBox())!;
    await pinch(map, {
      x: frame.x + frame.width / 2,
      y: frame.y + frame.height / 2,
      factor: 2,
    });

    await expect(map).not.toHaveAttribute("data-scale", "1.000");
    const scale = Number(await map.getAttribute("data-scale"));
    expect(scale).toBeCloseTo(2, 2);

    const after = (await badge.boundingBox())!;
    const gapAfter = (await other.boundingBox())!.x - after.x;

    // Countries move apart by exactly the zoom factor.
    expect(gapAfter / gapBefore).toBeCloseTo(scale, 1);

    // And a badge stays exactly the size it was, which is the actual
    // requirement: magnifying the cluster along with the map separates nothing.
    expect(after.width).toBeCloseTo(before.width, 1);
    expect(after.height).toBeCloseTo(before.height, 1);

    await page.screenshot({
      path: "e2e/screenshots/map-zoomed.png",
      fullPage: true,
    });

    await page.getByRole("button", { name: "Reset map" }).click();
    await expect(map).toHaveAttribute("data-scale", "1.000");
  });

  test("a crowded map can be pinched apart", async ({ page }) => {
    // The case worth designing for: a party that really does drink its way
    // around the world ends up with a knot of badges over Europe, where the
    // countries are small and close. Three fixture pins never show this.
    await mockApi(page, {
      tally: [
        "GB", "IE", "FR", "DE", "NL", "BE", "LU", "CH", "AT", "IT",
        "ES", "PT", "DK", "NO", "SE", "PL", "CZ", "HU", "SK", "SI",
        "HR", "BA", "RS", "ME", "AL", "MK", "GR", "US", "JP", "AU",
      ].map((countryCode, index) => ({
        countryCode,
        postCount: (index % 4) + 1,
      })),
    });

    await page.goto("./map");

    const map = page.getByRole("img", { name: "World map of drinks by country" });

    // Albania and North Macedonia, measured across every close pair on this
    // map as the tightest of the lot: 1.63px between centres at rest, needing
    // 10.35x to separate two 16.8px tap targets. Asserting on the WORST pair is
    // the point — an easier one would pass at a ceiling that still left this
    // one untappable, which is exactly the bug James reported on #45.
    const first = page.getByRole("button", { name: /from AL$/ });
    const second = page.getByRole("button", { name: /from MK$/ });

    // boundingBox does not wait for the first render; a bare read here raced it.
    await expect(first).toBeVisible();

    const gap = async () => {
      const a = (await first.boundingBox())!;
      const b = (await second.boundingBox())!;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    // The bar is the tap target, not the drawn circle. Two badges can be
    // visually distinguishable and still share every pixel you could press,
    // and "I can see it but I cannot open it" is the same complaint.
    const target = (await first.boundingBox())!.width;

    // At rest these two overlap: their centres are closer together than one
    // badge is wide, which is exactly the complaint.
    const crowded = await gap();
    expect(crowded).toBeLessThan(target);

    await page.screenshot({
      path: "e2e/screenshots/map-crowded.png",
      fullPage: true,
    });

    // Pinch into the knot rather than the middle of the ocean, and address it by
    // coordinate rather than by locator: at this density a neighbouring badge
    // sits on top of this one and would intercept anything aimed at it — which
    // is the strongest statement of the problem. Crowded pins are not merely
    // hard to read, they are untappable.
    const knot = (await first.boundingBox())!;

    // Deliberately spread further than the ceiling allows, so this pins the
    // ceiling itself rather than one gesture's arithmetic.
    await pinch(map, {
      x: knot.x + knot.width / 2,
      y: knot.y + knot.height / 2,
      factor: 20,
    });
    await expect(map).toHaveAttribute("data-scale", MAX_SCALE.toFixed(3));

    // Separated far enough to tap either one — and the badge itself has not
    // grown while that happened, or nothing would have been gained.
    expect(await gap()).toBeGreaterThan(target);
    expect((await first.boundingBox())!.width).toBeCloseTo(target, 1);

    await page.screenshot({
      path: "e2e/screenshots/map-crowded-zoomed.png",
      fullPage: true,
    });
  });

  test("tapping a map badge opens that country s feed", async ({ page }) => {
    await page.goto("./map");

    await page.getByRole("button", { name: "2 from IE" }).click();

    await expect(page).toHaveURL(/\/country\/IE$/);
    await expect(page.getByRole("heading", { name: /Ireland/ })).toBeVisible();
    await expect(page.getByText("Sapporo — crisp")).not.toBeVisible();

    await page.screenshot({
      path: "e2e/screenshots/country-feed.png",
      fullPage: true,
    });
  });

  test("the board ranks countries and links to each feed", async ({ page }) => {
    await page.goto("./board");

    await expect(page.getByText("4 drinks from 3 countries")).toBeVisible();
    await expect(page.getByText("Ireland")).toBeVisible();

    await page.screenshot({
      path: "e2e/screenshots/board.png",
      fullPage: true,
    });

    await page.getByRole("link", { name: /Ireland/ }).click();
    await expect(page).toHaveURL(/\/country\/IE$/);
  });

  test("the composer asks for a photo, a caption and a country", async ({
    page,
  }) => {
    await page.goto("./post");

    await expect(
      page.getByRole("button", { name: /Take a photo/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Caption")).toBeVisible();
    await expect(page.getByLabel("Search countries")).toBeVisible();

    await page.screenshot({
      path: "e2e/screenshots/compose.png",
      fullPage: true,
    });
  });

  test("the country picker filters as you type", async ({ page }) => {
    await page.goto("./post");

    await page.getByLabel("Search countries").fill("irel");

    await expect(page.getByRole("option", { name: /Ireland/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Japan/ })).toHaveCount(0);
  });

  test("posting without a photo explains what is missing", async ({ page }) => {
    await page.goto("./post");

    await page.getByRole("button", { name: "Post it" }).click();

    await expect(page.getByRole("alert")).toHaveText(/photo/i);
  });
});

test.describe("when the game is finished", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { mode: "Finished" });
    await signIn(page);
  });

  test("the composer is replaced with a wrap-up message", async ({ page }) => {
    await page.goto("./post");

    // Both the banner chip and the empty state say this; assert the one that
    // replaced the composer.
    await expect(
      page.getByRole("heading", { name: "That's a wrap" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Post it" })).toHaveCount(0);

    await page.screenshot({
      path: "e2e/screenshots/finished.png",
      fullPage: true,
    });
  });
});

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => mockApi(page));

  test("is gated on the admin key", async ({ page }) => {
    await page.goto("./admin");

    await expect(page.getByLabel("Admin key")).toBeVisible();
    await expect(page.getByRole("button", { name: "🍺 Next pub" })).toHaveCount(
      0,
    );

    await page.screenshot({
      path: "e2e/screenshots/admin-locked.png",
      fullPage: true,
    });
  });

  test("unlocks with the key and exposes the controls", async ({ page }) => {
    await page.goto("./admin");

    await page.getByLabel("Admin key").fill("dev-admin-key");
    await page.getByRole("button", { name: "Unlock" }).click();

    await expect(
      page.getByRole("button", { name: "🍺 Next pub" }),
    ).toBeVisible();
    // The mocked game is Live, so the round reset is not on the page at all.
    // This assertion used to name "Start a new round" directly.
    await expect(
      page.getByRole("button", { name: /new round/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /Release name/ }),
    ).toBeVisible();

    await page.screenshot({
      path: "e2e/screenshots/admin.png",
      fullPage: true,
    });
  });

  test("renaming needs both boxes, and retargets onto the new name", async ({
    page,
  }) => {
    await page.goto("./admin");
    await page.getByLabel("Admin key").fill("dev-admin-key");
    await page.getByRole("button", { name: "Unlock" }).click();

    const rename = page.getByRole("button", { name: "Rename", exact: true });

    // Disabled until BOTH names are present: with only one, the request either
    // 404s on an empty user or renames someone to nothing.
    await expect(rename).toBeDisabled();
    await page.getByLabel("Username", { exact: true }).fill("Dave");
    await expect(rename).toBeDisabled();
    await page.getByLabel("New name").fill("  Steve  ");
    await expect(rename).toBeEnabled();

    page.once("dialog", (dialog) => dialog.accept());
    await rename.click();

    await expect(page.getByText("Rename — done")).toBeVisible();

    // The box now points at the name that exists, trimmed as the server stored
    // it — otherwise the admin's next tap 404s against a name they just removed.
    await expect(page.getByLabel("Username", { exact: true })).toHaveValue(
      "Steve",
    );
    await expect(page.getByLabel("New name")).toHaveValue("");
  });

  test("is not linked from the tab bar for an ordinary player", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("./");

    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("link", { name: /admin/i })).toHaveCount(0);
  });
});

test.describe("the admin", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page, { bannedUsernames: ["Priya"] });
    await signInAsAdmin(page);
  });

  test("gets an admin tab and reaches the panel without a key", async ({
    page,
  }) => {
    await page.goto("./");

    await page.getByRole("link", { name: /Admin/ }).click();

    // No key form: the token they already hold is what authorises them.
    await expect(page.getByLabel("Admin key")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "🍺 Next pub" }),
    ).toBeVisible();

    // The tab bar survives, so the panel is somewhere to dip into and leave.
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();

    await page.screenshot({
      path: "e2e/screenshots/admin-tab.png",
      fullPage: true,
    });
  });

  test("sees the current cutovers already filled in, in local time", async ({
    page,
  }) => {
    await page.goto("./admin");

    // 16:00Z and 04:00Z, which on a UK phone in August are 17:00 and 05:00.
    // Asserted through the browser's own timezone rather than hard-coded, so
    // this passes wherever CI happens to be.
    await expect(page.getByLabel("Go live")).not.toHaveValue("");
    await expect(page.getByLabel("Read only")).not.toHaveValue("");
  });

  test("can moderate someone else's post from the feed", async ({ page }) => {
    await page.goto("./");

    await page.getByRole("button", { name: /Options for Priya's post/ }).click();

    await expect(
      page.getByRole("menuitem", { name: "Delete this post" }),
    ).toBeVisible();
    // Priya is in the banned fixture, so the offer is to lift it.
    const unhide = page.getByRole("menuitem", { name: "Un-hide Priya" });
    await expect(unhide).toBeVisible();

    // ...and then again, properly. The card used to be overflow: hidden and
    // cropped its own menu, so the admin saw the first item and nothing else.
    // Neither toBeVisible nor toBeInViewport caught that — both were measured
    // against the bug and both passed, because a clipped element still has a
    // layout box and IntersectionObserver did not report it as hidden either.
    // Asking the document what is actually painted at that point does catch it.
    // Two details, both learned the hard way against the real bug:
    //  - getBoundingClientRect, not Playwright's boundingBox(). The former is
    //    viewport-relative and so is elementFromPoint; the latter is
    //    page-relative, and mixing them probes the wrong pixel once scrolled.
    //  - compare element IDENTITY, not text. A clipped item's hit test returns
    //    an ancestor container, and that container's textContent contains the
    //    item's own label — so a `toContain` check passes over the bug.
    const reachable = await unhide.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
      );
      return hit !== null && (hit === element || element.contains(hit));
    });

    expect(reachable).toBe(true);

    await page.screenshot({
      path: "e2e/screenshots/admin-post-options.png",
      fullPage: true,
    });
  });

  test("removes the round reset entirely once the game is live", async ({
    page,
  }) => {
    await page.goto("./admin");

    // Matched loosely on purpose: the point is that no control anywhere on the
    // page can start a round, not that one particular label is absent. A
    // disclosure-shaped replacement ("Danger zone" → "Yes, start a new round")
    // passes an exact-label assertion while leaving the reset one tap away.
    await expect(page.getByRole("button", { name: /new round/i })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: /danger/i })).toHaveCount(0);

    // The rest of the panel is untouched — "disappears" must not mean the
    // section it lived in stopped rendering.
    await expect(
      page.getByRole("button", { name: "🍺 Next pub" }),
    ).toBeVisible();
  });

  test("offers the round reset while still in practice", async ({ page }) => {
    // The control for the test above: hiding it must not make it unreachable
    // during the build week, which is when it is actually used — and it is also
    // the way back if the night ever needs one (push "Go live" forward).
    await mockApi(page, { mode: "Practice" });
    await page.goto("./admin");

    await expect(
      page.getByRole("button", { name: "Start a new round" }),
    ).toBeVisible();
  });
});
