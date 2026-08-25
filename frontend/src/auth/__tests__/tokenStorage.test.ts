import { describe, it, expect, beforeEach } from "vitest";
import { readSession, writeSession, clearSession } from "../tokenStorage";

const VALID = {
  accessToken: "access",
  refreshToken: "refresh",
  userId: "a3f",
  username: "Dave",
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
