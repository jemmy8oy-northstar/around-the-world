import { describe, it, expect } from "vitest";
import { failureMessage, problemDetail } from "../problemDetail";

describe("problemDetail", () => {
  it("extracts the API message so the user sees the real reason", () => {
    expect(
      problemDetail({ data: { detail: "That party code is not right." } }),
    ).toBe("That party code is not right.");
  });

  it.each([
    [null],
    [undefined],
    ["a string"],
    [{}],
    [{ data: null }],
    [{ data: {} }],
    [{ data: { detail: "   " } }],
    [{ data: { detail: 42 } }],
  ])("returns null for %o so the caller can fall back", (input) => {
    expect(problemDetail(input)).toBeNull();
  });
});

describe("failureMessage", () => {
  const FALLBACK = "That didn't send — try again.";

  it("prefers the API's own sentence over anything it could infer", () => {
    expect(
      failureMessage({ status: 400, data: { detail: "Pick a country." } }, FALLBACK),
    ).toBe("Pick a country.");
  });

  // The 27 Aug upload failure: nginx capped the body at 1MB and returned an
  // HTML 413, so there was no ProblemDetails to read and the screen could only
  // say "That didn't send". Naming the cause is the whole point of this branch.
  it("names an oversized photo rather than blaming the send", () => {
    expect(failureMessage({ status: 413, data: "<html>413</html>" }, FALLBACK)).toBe(
      "That photo is too big to send — try a smaller one.",
    );
  });

  it("tells a signed-out guest to join again", () => {
    expect(failureMessage({ status: 401, data: undefined }, FALLBACK)).toBe(
      "You've been signed out — join again.",
    );
  });

  it("names a dead connection, which a pub at 11pm produces often", () => {
    expect(failureMessage({ status: "FETCH_ERROR", error: "failed" }, FALLBACK)).toBe(
      "No connection — check your signal and try again.",
    );
  });

  it("appends an unrecognised status so it can be read down the phone", () => {
    expect(failureMessage({ status: 502, data: "" }, FALLBACK)).toBe(
      `${FALLBACK} (error 502)`,
    );
  });

  it.each([[null], [undefined], ["a string"], [{}], [{ status: undefined }]])(
    "falls back cleanly for %o, with no 'undefined' in the sentence",
    (input) => {
      expect(failureMessage(input, FALLBACK)).toBe(FALLBACK);
    },
  );
});
