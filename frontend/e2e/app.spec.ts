import { test, expect } from "@playwright/test";
import { mockApi, signIn } from "./mocks";

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
    await expect(
      page.getByRole("button", { name: "Start a new round" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Release name/ }),
    ).toBeVisible();

    await page.screenshot({
      path: "e2e/screenshots/admin.png",
      fullPage: true,
    });
  });

  test("is not linked from the tab bar", async ({ page }) => {
    await signIn(page);
    await page.goto("./");

    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("link", { name: /admin/i })).toHaveCount(0);
  });
});
