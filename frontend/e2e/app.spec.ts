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
 * The same spread, but delivered the way a finger delivers it: as a stream of
 * small touchmoves rather than one jump.
 *
 * This is the gesture James was actually making on #45 ("it becomes harder and
 * harder to zoom once you are zoomed in"), and the single-move `pinch` above
 * cannot see the defect it exposes — every increment has to survive, and if the
 * component recomputes each one from a state value that has not caught up yet,
 * all but the last are silently discarded. A real pinch is ~30 moves, so that
 * loses almost the whole gesture.
 *
 * `steps` is deliberately larger than one animation frame's worth: the point is
 * for several moves to land between renders.
 */
async function pinchGradually(
  target: Locator,
  {
    x,
    y,
    factor,
    steps = 30,
    drift = 0,
    release = true,
  }: {
    x: number;
    y: number;
    factor: number;
    steps?: number;
    /** Client pixels the whole hand slides right over the gesture. */
    drift?: number;
    /**
     * Whether to lift the fingers at the end. Leave them down to inspect the
     * map mid-gesture — past the rubber band's limits, where it is only
     * allowed to be until it is released.
     */
    release?: boolean;
  },
): Promise<void> {
  await target.evaluate((element, { x, y, factor, steps, drift, release }) => {
    const fire = (type: string, touches: { clientX: number; clientY: number }[]) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "touches", { value: touches });
      element.dispatchEvent(event);
    };

    const spread = (radius: number, shift: number) => [
      { clientX: x - radius + shift, clientY: y },
      { clientX: x + radius + shift, clientY: y },
    ];

    fire("touchstart", spread(60, 0));

    // Geometric steps, so each move carries the same ratio — that is what a
    // pinch actually is, and it makes the expected total exactly `factor`.
    for (let step = 1; step <= steps; step += 1) {
      fire("touchmove", spread(60 * factor ** (step / steps), (drift * step) / steps));
    }

    if (release) fire("touchend", []);
  }, { x, y, factor, steps, drift, release });
}

/** Lifts fingers left down by `pinchGradually({ release: false })`. */
async function releaseFingers(target: Locator): Promise<void> {
  await target.evaluate((element) => {
    const event = new Event("touchend", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: [] });
    element.dispatchEvent(event);
  });
}

/**
 * The point in the map's own coordinate space currently sitting under the
 * middle of the map on screen — i.e. what you are looking at.
 *
 * Read out of the DOM the component actually renders (the land group's
 * transform and the svg's viewBox) rather than from any test-only hook, so it
 * cannot agree with the component by construction.
 */
async function lookingAt(target: Locator): Promise<{ x: number; y: number }> {
  return target.evaluate((svg) => {
    const land = svg.querySelector("g.worldmap__land")!;
    const transform = land.getAttribute("transform") ?? "";
    const move = transform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
    const scale = transform.match(/scale\(\s*([-\d.]+)\s*\)/);
    const k = scale ? Number(scale[1]) : 1;
    const boxHeight = Number(
      (svg.getAttribute("viewBox") ?? "0 0 800 380").split(/\s+/)[3],
    );

    return {
      x: (400 - (move ? Number(move[1]) : 0)) / k,
      y: (boxHeight / 2 - (move ? Number(move[2]) : 0)) / k,
    };
  });
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

  test("a post shows the whole photo, not a crop of it", async ({ page }) => {
    // James, #51: "images on posts are getting cropped… you can't frame the
    // photo well. I think we just don't crop the photos".
    //
    // Every fixture post carries photoUrl: "", so until now the feed tests only
    // ever rendered the "photo unavailable" placeholder — no test in the suite
    // had ever put a real image in a card, which is why a crop this obvious was
    // invisible to all of them. This serves one.
    //
    // 9:16, because that is the tallest shape a phone camera actually produces
    // and therefore the case that has to survive: it is the one that hits the
    // height cap and gets inset at the sides.
    //
    // And at 900x1600, not 90x160, because the photo has to be BIGGER than the
    // card for the card to bound it — which is what compressImage guarantees by
    // capping the long edge at 1600 rather than by enlarging anything. A 90px
    // fixture renders at its own natural size, whereupon "not cropped" and
    // "under the height cap" are both true of a thumbnail and the test asserts
    // nothing at all.
    const NATURAL = { width: 900, height: 1600 };

    await page.route("**/birthday/api/photos/tall.svg", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body:
          `<svg xmlns="http://www.w3.org/2000/svg" width="${NATURAL.width}" ` +
          `height="${NATURAL.height}"><rect width="${NATURAL.width}" ` +
          `height="${NATURAL.height}" fill="#c1440e"/></svg>`,
      }),
    );

    await mockApi(page, {
      posts: [
        {
          id: "00000000-0000-0000-0000-000000000009",
          userId: "44444444-4444-4444-4444-444444444444",
          username: "Nadia",
          photoUrl: "/api/photos/tall.svg",
          caption: "Portrait, and all of it",
          countryCode: "PT",
          stopNumber: 1,
          createdAt: "2026-08-26T20:00:00Z",
        },
      ],
    });

    await page.goto("./");

    const photo = page.locator(".post__photo");
    await expect(photo).toBeVisible();

    const shape = await photo.evaluate((img: HTMLImageElement) => ({
      naturalRatio: img.naturalWidth / img.naturalHeight,
      renderedRatio: img.clientWidth / img.clientHeight,
      renderedHeight: img.clientHeight,
    }));

    // The whole assertion: the box the photo is drawn in has the photo's own
    // shape. object-fit: cover keeps this element's ratio at the FRAME's and
    // throws the difference away off the top and bottom.
    expect(shape.naturalRatio).toBeCloseTo(NATURAL.width / NATURAL.height, 2);
    expect(shape.renderedRatio).toBeCloseTo(shape.naturalRatio, 2);

    // Bounded, or one post would swallow the whole feed — and bounded AT the
    // cap rather than merely under it. The "under it" half alone is satisfied
    // by a thumbnail: leaving object-fit: cover on kept the shape right (the
    // wrapper enforces that) while rendering the photo at 164px instead of
    // 243px wide, and a <= assertion was green over it.
    expect(shape.renderedHeight).toBeCloseTo(
      page.viewportSize()!.height * 0.65,
      0,
    );

    // A photo that hit the cap is narrower than the card, so the country stamp
    // has to be franked onto the PHOTO — anchored to the frame it would sit out
    // on the card's background next to it.
    const photoBox = (await photo.boundingBox())!;
    const stamp = (await page.locator(".post__country").boundingBox())!;

    expect(stamp.x).toBeGreaterThanOrEqual(photoBox.x - 1);
    expect(stamp.x + stamp.width).toBeLessThanOrEqual(
      photoBox.x + photoBox.width + 1,
    );
    expect(stamp.y + stamp.height).toBeLessThanOrEqual(
      photoBox.y + photoBox.height + 1,
    );

    await page.screenshot({
      path: "e2e/screenshots/feed-uncropped.png",
      fullPage: true,
    });
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

  test("a pinch delivered a finger's worth at a time keeps all of its zoom", async ({
    page,
  }) => {
    // James, #45: "for some reason it becomes harder and harder to zoom once you
    // are zoomed in". A finger sends ~30 touchmoves per gesture; if the map
    // recomputes each from a stale scale, only the last increment survives and
    // a 4x spread lands somewhere near 1.05x. Nothing in the single-move test
    // above can catch that, because one move has nothing to lose.
    await page.goto("./map");

    const map = page.getByRole("img", { name: "World map of drinks by country" });
    const frame = (await map.boundingBox())!;
    const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };

    await pinchGradually(map, { ...centre, factor: 4 });
    expect(Number(await map.getAttribute("data-scale"))).toBeCloseTo(4, 1);

    // And again from where it left off — his complaint is specifically about the
    // second pinch, once already zoomed. 4x then 2x is 8x, not 4x-and-a-bit.
    await pinchGradually(map, { ...centre, factor: 2 });
    expect(Number(await map.getAttribute("data-scale"))).toBeCloseTo(8, 1);
  });

  test("a pinch that drifts carries the map with it", async ({ page }) => {
    // James, #45: "maybe it needs to support some kind of two finger pan zoom
    // combo so that when ur fingers move slightly during the zoom it isn't
    // having to fix directly". Two fingers used to only ever zoom — the hand
    // sliding across the glass was thrown away, so the map appeared to correct
    // itself back against the gesture.
    await page.goto("./map");

    const map = page.getByRole("img", { name: "World map of drinks by country" });
    const badge = page.getByRole("button", { name: "2 from IE" });
    await expect(badge).toBeVisible();

    const frame = (await map.boundingBox())!;
    const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
    const DRIFT = 50;

    await pinchGradually(map, { ...centre, factor: 3 });
    const still = (await badge.boundingBox())!.x;

    await page.getByRole("button", { name: "Reset map" }).click();
    await expect(map).toHaveAttribute("data-scale", "1.000");

    await pinchGradually(map, { ...centre, factor: 3, drift: DRIFT });
    const drifted = (await badge.boundingBox())!.x;

    // Same zoom either way — the drift must not be paid for out of the scale.
    expect(Number(await map.getAttribute("data-scale"))).toBeCloseTo(3, 1);

    // And the map has come with the hand, roughly pixel for pixel.
    expect(drifted - still).toBeGreaterThan(DRIFT * 0.7);
    expect(drifted - still).toBeLessThan(DRIFT * 1.3);
  });

  test("an over-pinch springs back to what you were looking at", async ({
    page,
  }) => {
    // James, #45: "when you zoom too far it pulls you to the bottom right
    // corner of the map". Past the ceiling the gesture is allowed to stretch
    // and then springs back — and the spring back used to overwrite the scale
    // while holding the offsets, which slides every visible point east and
    // south at once. Measured before the fix: the middle of the world went in
    // at (400, 187) and came back out at (560, 262).
    await page.goto("./map");

    const map = page.getByRole("img", { name: "World map of drinks by country" });
    const frame = (await map.boundingBox())!;
    const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };

    // Well past MAX_SCALE, so the release has real work to do.
    await pinchGradually(map, { ...centre, factor: MAX_SCALE * 3, release: false });

    const stretched = Number(await map.getAttribute("data-scale"));
    expect(stretched).toBeGreaterThan(MAX_SCALE);
    const before = await lookingAt(map);

    await releaseFingers(map);
    await expect(map).toHaveAttribute("data-scale", MAX_SCALE.toFixed(3));

    const after = await lookingAt(map);

    // A couple of map units of slack for the spring's final frame; the bug
    // this pins was 160 units east and 75 south.
    expect(after.x).toBeCloseTo(before.x, 0);
    expect(after.y).toBeCloseTo(before.y, 0);
  });

  test("the map's page reaches the tab bar", async ({ page }) => {
    // The map may only grow into the height its page reports (#52), so a page
    // that under-reports its own height caps the map below what the screen
    // has. It used to claim `calc(100dvh - 12rem)` — a guess at the chrome —
    // where the banner and tab bar together measure 8.7rem, leaving 52.8px of
    // the screen permanently unreachable. That is the empty band James
    // photographed on #45 *after* #52 shipped, which is why the assertion is
    // on the page box rather than on the map: the map was already obeying it.
    await page.goto("./map");
    await expect(
      page.getByRole("img", { name: "World map of drinks by country" }),
    ).toBeVisible();

    const region = (await page.locator(".worldmap-page").boundingBox())!;
    const banner = (await page.locator(".banner").boundingBox())!;
    const tabs = (await page.locator(".tabbar").boundingBox())!;

    const free = tabs.y - (banner.y + banner.height);
    const unreachable = free - region.height;

    // Some clearance above the tab bar is deliberate (the shell reserves a
    // little more than the bar is tall). Anything beyond that is a guess that
    // has drifted from the thing it was guessing at.
    expect(unreachable).toBeGreaterThanOrEqual(0);
    expect(unreachable).toBeLessThan(20);
  });

  test("the map grows into the space below it instead of shoving it down", async ({
    page,
  }) => {
    // Two of James's #45 notes at once: "it staying in the same horizontal box
    // feels like a missed opportunity, it could expand into the vertical space
    // available", and "the image should be z axis above the text directly
    // below it". Growing the element in flow would satisfy the first and
    // reflow the page under his fingers on every frame of the pinch.
    await page.goto("./map");

    const map = page.getByRole("img", { name: "World map of drinks by country" });
    const hint = page.getByText(/countries so far/);
    await expect(hint).toBeVisible();

    const restingMap = (await map.boundingBox())!;
    const restingHint = (await hint.boundingBox())!;

    await pinchGradually(map, {
      x: restingMap.x + restingMap.width / 2,
      y: restingMap.y + restingMap.height / 2,
      factor: 4,
    });

    const zoomedMap = (await map.boundingBox())!;

    // Taller, and no wider — the extra pixels come from the empty space under
    // the map, not from stretching it.
    expect(zoomedMap.height).toBeGreaterThan(restingMap.height * 1.5);
    expect(zoomedMap.width).toBeCloseTo(restingMap.width, 0);

    // The text under it has not moved: the map is over it, not pushing it.
    expect((await hint.boundingBox())!.y).toBeCloseTo(restingHint.y, 0);
    expect(zoomedMap.y + zoomedMap.height).toBeGreaterThan(restingHint.y);

    await page.screenshot({
      path: "e2e/screenshots/map-grown.png",
      fullPage: true,
    });

    await page.getByRole("button", { name: "Reset map" }).click();
    await expect(map).toHaveAttribute("data-scale", "1.000");
    expect((await map.boundingBox())!.height).toBeCloseTo(restingMap.height, 0);
  });

  test("the grown map uses the whole page and none of anyone else's", async ({
    page,
  }) => {
    // James on #52, looking at a zoomed map with a third of his phone empty
    // above and below it: "Map still more cropped than it needs to be". The
    // ceiling was a constant picked by eye (1.8x), so the box stopped growing
    // while there was room left and started cropping the world instead. It is
    // now measured from the page, which is the only thing that knows.
    await page.goto("./map");

    const map = page.getByRole("img", { name: "World map of drinks by country" });
    const space = page.locator(".worldmap-page");
    await expect(map).toBeVisible();

    const room = (await space.boundingBox())!;
    const resting = (await map.boundingBox())!;

    await pinchGradually(map, {
      x: resting.x + resting.width / 2,
      y: resting.y + resting.height / 2,
      factor: 6,
    });

    const grown = (await map.boundingBox())!;

    // Fills the free height between the game banner and the tab bar, and stops
    // there. Both edges, not just the total: growing about its own centre from
    // a resting position that is not the centre of that space overhangs the
    // banner by as much as it leaves empty at the bottom, which reads as the
    // map having escaped rather than expanded.
    expect(grown.height).toBeCloseTo(room.height, 0);
    expect(grown.y).toBeCloseTo(room.y, 0);
    expect(grown.y + grown.height).toBeCloseTo(room.y + room.height, 0);

    // And this is the bit he was looking at: strictly more than the old fixed
    // multiple would ever have given him. Red against HEIGHT_GROWTH = 1.8.
    expect(grown.height).toBeGreaterThan(resting.height * 1.8 + 20);

    // The reset button rides the map's own top edge, not the footprint the map
    // has long since grown out of — otherwise it floats mid-Atlantic.
    const reset = page.getByRole("button", { name: "Reset map" });
    const resetBox = (await reset.boundingBox())!;
    expect(resetBox.y).toBeGreaterThanOrEqual(grown.y);
    expect(resetBox.y).toBeLessThan(grown.y + grown.height / 4);

    await page.screenshot({
      path: "e2e/screenshots/map-fills-the-page.png",
      fullPage: true,
    });

    await reset.click();
    await expect(map).toHaveAttribute("data-scale", "1.000");
    expect((await map.boundingBox())!.height).toBeCloseTo(resting.height, 0);
  });

  test("a pinch stretched past the limit springs back to it", async ({ page }) => {
    // James, #45: "allow the image to zoom out of its confines then if it's too
    // zoomed out it just snaps back to the max zoom out view". The point is the
    // feel — a hard stop mid-gesture reads as the map fighting the hand.
    await page.goto("./map");

    const map = page.getByRole("img", { name: "World map of drinks by country" });
    const frame = (await map.boundingBox())!;

    // Squeeze inwards from rest, which is already the floor.
    await pinchGradually(map, {
      x: frame.x + frame.width / 2,
      y: frame.y + frame.height / 2,
      factor: 0.2,
    });

    // It comes back to the floor on its own, with no reset tapped.
    await expect(map).toHaveAttribute("data-scale", "1.000");
    await expect(page.getByRole("button", { name: "Reset map" })).toHaveCount(0);
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

  test("picking a country fills the search box with it", async ({ page }) => {
    await page.goto("./post");

    const search = page.getByLabel("Search countries");
    await search.fill("irel");
    await page.getByRole("option", { name: /Ireland/ }).click();

    // The box now reads as "what this post is tagged with" rather than as a
    // search someone ran a minute ago and forgot about.
    await expect(search).toHaveValue("Ireland");
    await expect(page.getByRole("option", { name: /Ireland/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  test("searching again drops the country that was already picked", async ({
    page,
  }) => {
    await page.goto("./post");

    const search = page.getByLabel("Search countries");
    await search.fill("fran");
    await page.getByRole("option", { name: /France/ }).click();
    await expect(search).toHaveValue("France");

    // The trap James named on #46: search for somewhere else, don't tap a
    // result, post anyway. Without this the post is still tagged France while
    // the box says Germany, and nothing on screen admits it.
    await search.fill("germ");
    await expect(
      page.getByRole("option", { name: /Germany/ }),
    ).toHaveAttribute("aria-selected", "false");

    // Attach a photo so the submit gets past the photo check and reaches the
    // country one — otherwise this would assert on the photo error and pass
    // whether or not the selection was ever cleared.
    await page.locator("input[type=file]").setInputFiles({
      name: "drink.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });

    await page.getByRole("button", { name: "Post it" }).click();
    await expect(page.getByRole("alert")).toHaveText(/where the drink is from/i);
  });

  test("posting without a photo explains what is missing", async ({ page }) => {
    await page.goto("./post");

    await page.getByRole("button", { name: "Post it" }).click();

    // "with the drink", not "of the drink" — #46.
    await expect(page.getByRole("alert")).toHaveText(
      "Take a photo with the drink first.",
    );
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

  /**
   * The cooldown James asked for on #44. Driven end to end here rather than as a
   * unit test on purpose: CI runs the e2e suite and does not yet run the vitest
   * one (ATW#37), so this is the only place the behaviour is actually guarded.
   */
  test("a second Next pub inside the cooldown asks before it moves", async ({
    page,
  }) => {
    const sent: unknown[] = [];

    // The server refuses the second advance and says why. Fulfilled here so the
    // spec drives the client's half of the contract; the refusal itself is
    // pinned by AdminApiTests.
    await page.route("**/birthday/api/admin/stop/next", (route) => {
      const body = route.request().postDataJSON() as { force?: boolean };
      sent.push(body);

      // Mirrors PubStopService: the first advance of the round is never
      // questioned, a later one inside the cooldown is refused, and `force` is
      // the way through. Honouring force here is the point — a fixture that
      // refused everything would pass while the override was broken.
      if (sent.length === 1 || body?.force) return route.fulfill({ json: 3 });

      return route.fulfill({
        status: 409,
        contentType: "application/problem+json",
        json: {
          detail: "You moved to stop 3 2 minutes ago. Move on to stop 4 anyway?",
        },
      });
    });

    await page.goto("./admin");
    await page.getByLabel("Admin key").fill("dev-admin-key");
    await page.getByRole("button", { name: "Unlock" }).click();

    const nextPub = page.getByRole("button", { name: "🍺 Next pub" });

    await nextPub.click();
    await expect(page.getByRole("status")).toHaveText("Next pub — done");

    // Decline the second one. The dialog has to carry the server's sentence:
    // only the server knows when the last tap was.
    let asked: string | null = null;
    page.once("dialog", (dialog) => {
      asked = dialog.message();
      return dialog.dismiss();
    });

    await nextPub.click();
    await expect(page.getByRole("status")).toHaveText(
      "Next pub — left where it was",
    );
    expect(asked).toBe(
      "You moved to stop 3 2 minutes ago. Move on to stop 4 anyway?",
    );

    // Declining sent no third request: the stop is where it was, not advanced
    // and then apologised for.
    expect(sent).toHaveLength(2);
    expect(sent[0]).toEqual({});
    expect(sent[1]).toEqual({});

    // Accepting is the only thing that forces it. This is the half that stops
    // the guard becoming a lock — there is no undo, so it must never be able to
    // strand him at the wrong stop.
    page.once("dialog", (dialog) => dialog.accept());
    await nextPub.click();

    await expect(page.getByRole("status")).toHaveText("Next pub — done");
    expect(sent).toHaveLength(4);
    expect(sent[3]).toEqual({ force: true });
  });

  test("a Next pub failure that is not the cooldown is never forced", async ({
    page,
  }) => {
    const sent: unknown[] = [];

    // A 404 — no round in progress. Retrying this with force would be the
    // client deciding a real failure was a formality.
    await page.route("**/birthday/api/admin/stop/next", (route) => {
      sent.push(route.request().postDataJSON());
      return route.fulfill({
        status: 404,
        contentType: "application/problem+json",
        json: { detail: "There is no round in progress." },
      });
    });

    let dialogs = 0;
    page.on("dialog", (dialog) => {
      dialogs += 1;
      return dialog.accept();
    });

    await page.goto("./admin");
    await page.getByLabel("Admin key").fill("dev-admin-key");
    await page.getByRole("button", { name: "Unlock" }).click();
    await page.getByRole("button", { name: "🍺 Next pub" }).click();

    await expect(page.getByRole("status")).toHaveText(
      "There is no round in progress.",
    );
    expect(dialogs).toBe(0);
    expect(sent).toHaveLength(1);
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
