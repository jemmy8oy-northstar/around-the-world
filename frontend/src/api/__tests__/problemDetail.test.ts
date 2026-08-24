import { describe, it, expect } from "vitest";
import { problemDetail } from "../problemDetail";

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
