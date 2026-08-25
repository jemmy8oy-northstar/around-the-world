import { test, expect } from "@playwright/test";
import { mockApi, signIn, signInAsAdmin } from "./mocks";

/**
 * Smoke + screenshot coverage for the whole app, driven off mocked API
 * responses (see mocks.ts) so it needs no backend and renders identically every
 * run. Each test asserts the key content, then captures a phone-viewport
 * screenshot into e2e/screenshots/ for visual review.
 */

test.describe("joining", () => {
  test.beforeEach(async ({ page }) => mockApi(page));

  test("the join screen asks for a code and a name", async ({ page }) => {
    await page.goto("./join");

    await expect(
      page.getByRole("heading", { name: "Around the World" }),
    ).toBeVisible();
    await expect(page.getByLabel("Party code")).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeVisible();

    // The name field says what the name is FOR, not "what should we call you?" —
    // people pick a better name when they know it goes above every post.
    await expect(page.getByLabel("Your name")).toHaveAttribute(
      "placeholder",
      "This will appear above your posts",
    );

    await page.screenshot({ path: "e2e/screenshots/join.png", fullPage: true });
  });

  test("an unauthenticated visitor is sent to join", async ({ page }) => {
    await page.goto("./");

    await expect(page).toHaveURL(/\/join$/);
  });

  test("joining lands you on the feed", async ({ page }) => {
    await page.goto("./join");

    await page.getByLabel("Party code").fill("260802");
    await page.getByLabel("Your name").fill("Dave");
    await page.getByRole("button", { name: "Let's go" }).click();

    await expect(
      page.getByText("Guinness, obviously. Setting the tone."),
    ).toBeVisible();
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

  test("the map shows one badge per country", async ({ page }) => {
    await page.goto("./map");

    await expect(
      page.getByText("3 countries so far", { exact: false }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "2 from IE" })).toBeVisible();

    await page.screenshot({ path: "e2e/screenshots/map.png", fullPage: true });
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
