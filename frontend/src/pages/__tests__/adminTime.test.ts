import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { toLocalInputValue } from "../adminTime";

/**
 * Pinned to Europe/London on purpose, and this is the whole reason the file
 * exists.
 *
 * The first version of these tests asserted the conversion against a value
 * derived the same way, and ran in whatever zone the machine had. Both this
 * sandbox and CI are **UTC** — where local time *is* UTC, every timezone bug is
 * arithmetically invisible, and a mutation that read a naive timestamp as local
 * instead of UTC survived with the suite still green. A test for a British
 * Summer Time bug that only ever runs in UTC cannot fail.
 *
 * So the zone is fixed here rather than inherited, the party's actual date is
 * used (28 August is inside BST, UTC+1), and the expectations are literal
 * strings rather than round-trips through the code under test.
 */
const REAL_TZ = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "Europe/London";
});

afterAll(() => {
  process.env.TZ = REAL_TZ;
});

describe("toLocalInputValue, on a phone in the UK on the night", () => {
  it("shows a 16:00Z cutover as 17:00, which is what BST calls it", () => {
    expect(toLocalInputValue("2026-08-28T16:00:00Z")).toBe("2026-08-28T17:00");
  });

  it("shows the 04:00Z read-only cutover as 05:00 the next morning", () => {
    expect(toLocalInputValue("2026-08-29T04:00:00Z")).toBe("2026-08-29T05:00");
  });

  it("treats a timestamp with no designator as UTC, not as local", () => {
    // A .NET DateTime whose Kind is Unspecified serialises with no trailing Z,
    // and `new Date` then reads it as local — so a server storing UTC and a
    // client assuming local disagree by exactly the BST offset. Silently, and
    // only between March and October.
    expect(toLocalInputValue("2026-08-28T16:00:00")).toBe("2026-08-28T17:00");
  });

  it("honours an explicit non-UTC offset rather than assuming Z", () => {
    expect(toLocalInputValue("2026-08-28T17:00:00+01:00")).toBe(
      "2026-08-28T17:00",
    );
  });

  it("is still correct outside BST, where the offset is zero", () => {
    // The control for every assertion above: if the code simply added an hour
    // somewhere, this is the one that would catch it.
    expect(toLocalInputValue("2026-12-25T16:00:00Z")).toBe("2026-12-25T16:00");
  });

  it("round-trips back through the conversion the save button uses", () => {
    // The save button does `new Date(value).toISOString()`. Opening the page
    // and pressing save without touching anything must not move the cutover.
    const original = "2026-08-28T16:00:00Z";

    expect(new Date(toLocalInputValue(original)).toISOString()).toBe(
      new Date(original).toISOString(),
    );
  });

  it.each([undefined, null, "", "not a date"])(
    "gives an empty box rather than an Invalid Date for %s",
    (value) => {
      expect(toLocalInputValue(value)).toBe("");
    },
  );
});
