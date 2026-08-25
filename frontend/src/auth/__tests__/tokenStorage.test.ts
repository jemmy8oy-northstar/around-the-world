import { describe, it, expect, beforeEach } from "vitest";
import { readSession, writeSession, clearSession } from "../tokenStorage";

const VALID = {
  accessToken: "access",
  refreshToken: "refresh",
  userId: "a3f",
  username: "Dave",
  isAdmin: false,
};

describe("tokenStorage", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips a session so a reload stays logged in", () => {
    writeSession(VALID);
    expect(readSession()).toEqual(VALID);
  });

  it("returns null when nothing is stored", () => {
    expect(readSession()).toBeNull();
  });

  it("round-trips the admin flag", () => {
    writeSession({ ...VALID, username: "james", isAdmin: true });
    expect(readSession()?.isAdmin).toBe(true);
  });

  it("reads a session stored before the admin flag existed as not an admin", () => {
    // Anyone who joined during the practice week has a session with no isAdmin
    // at all. `undefined` must land as false rather than leaking into a
    // truthiness check and drawing a tab whose buttons all 403.
    window.localStorage.setItem(
      "atw.session",
      JSON.stringify({
        accessToken: "a",
        refreshToken: "r",
        userId: "u",
        username: "Dave",
      }),
    );

    expect(readSession()?.isAdmin).toBe(false);
  });

  it("clears", () => {
    writeSession(VALID);
    clearSession();
    expect(readSession()).toBeNull();
  });

  it.each([
    ["not json at all"],
    [JSON.stringify({ accessToken: "a" })],
    [JSON.stringify({ refreshToken: "r", username: "D" })],
    [JSON.stringify({ accessToken: "a", refreshToken: "r" })],
    [JSON.stringify(null)],
  ])(
    "treats a half-written entry as logged out rather than wedging the app",
    (raw) => {
      window.localStorage.setItem("atw.session", raw);
      expect(readSession()).toBeNull();
    },
  );
});
