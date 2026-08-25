import { describe, it, expect } from "vitest";
import { toLocalInputValue } from "../adminTime";

/**
 * These run in whatever timezone the machine is set to, so they assert the
 * *relationship* between the instant and the rendered value rather than a fixed
 * string — a test that only passes in Europe/London would be a test that fails
 * in CI, which is UTC.
 */
function expectedFor(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

describe("toLocalInputValue", () => {
  it("renders a UTC instant in the browser's own timezone", () => {
    expect(toLocalInputValue("2026-08-28T16:00:00Z")).toBe(
      expectedFor("2026-08-28T16:00:00Z"),
    );
  });

  it("treats a timestamp with no designator as UTC, not as local", () => {
    // The bug this exists to stop: a .NET DateTime with Kind=Unspecified
    // serialises without a trailing Z, and `new Date` would then read it as
    // local — putting the go-live box exactly one hour out for the whole of
    // British Summer Time, on an app whose entire point is one evening in
    // August.
    expect(toLocalInputValue("2026-08-28T16:00:00")).toBe(
      toLocalInputValue("2026-08-28T16:00:00Z"),
    );
  });

  it("honours an explicit non-UTC offset rather than assuming Z", () => {
    expect(toLocalInputValue("2026-08-28T17:00:00+01:00")).toBe(
      toLocalInputValue("2026-08-28T16:00:00Z"),
    );
  });

  it("round-trips back through the conversion the save button uses", () => {
    // The save button does `new Date(value).toISOString()`. Rendering an
    // instant and immediately saving it again must be a no-op, or simply
    // opening the page and pressing save would shift the cutover.
    const original = "2026-08-28T16:00:00Z";
    const shown = toLocalInputValue(original);

    expect(new Date(shown).toISOString()).toBe(
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
