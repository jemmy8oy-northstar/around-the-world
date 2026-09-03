import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import sessionReducer from "../../auth/sessionSlice";
import type { StoredSession } from "../../auth/tokenStorage";

/**
 * The admin panel — the key gate and every admin action.
 *
 * ATW#9 made these mandatory ("Vitest + RTL tests for the key gate and each
 * admin action") and they were deliberately held: until #63 there was no CI job
 * running this suite, so they would have looked like protection while gating
 * nothing. #63 merged, `ci.yml` on `dev` runs `npm run test`, so they now do.
 *
 * The RTK Query hooks are mocked rather than driven through a real store: every
 * assertion here is about what the SCREEN does with a result, and a real store
 * would put a fetch mock between the test and the thing being tested. What each
 * mutation was called WITH is asserted, because "the button ran something" is
 * the version of this suite that passes over a shadow-ban that unbans.
 */

const advanceStop = vi.fn();
const startRound = vi.fn();
const updateCutovers = vi.fn();
const setShadowBan = vi.fn();
const releaseUsername = vi.fn();
const renameUser = vi.fn();
const gameState = vi.fn();

vi.mock("../../api/atwApi", () => ({
  useGetGameStateQuery: () => gameState(),
  useAdvancePubStopMutation: () => [advanceStop],
  useStartNewRoundMutation: () => [startRound],
  useUpdateCutoversMutation: () => [updateCutovers],
  useSetShadowBanMutation: () => [setShadowBan],
  useReleaseUsernameMutation: () => [releaseUsername],
  useRenameUserMutation: () => [renameUser],
}));

// eslint-disable-next-line import/first
import Admin from "../Admin";

const ADMIN_KEY_STORAGE = "atw.adminKey";

/** A mutation trigger: `fn(args).unwrap()` resolves. */
const resolves = (value: unknown = undefined) =>
  vi.fn(() => ({ unwrap: () => Promise.resolve(value) }));

/** A mutation trigger whose `.unwrap()` rejects with `error`. */
const rejects = (error: unknown) =>
  vi.fn(() => ({ unwrap: () => Promise.reject(error) }));

function session(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    accessToken: "a",
    refreshToken: "r",
    userId: "u",
    username: "Dave",
    isAdmin: false,
    ...overrides,
  };
}

function renderAdmin(current: StoredSession | null = null) {
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session: { session: current } },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    </Provider>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  gameState.mockReturnValue({ data: { mode: "Practice", roundName: "R", currentStopNumber: 1 } });
  for (const fn of [advanceStop, startRound, updateCutovers, setShadowBan, releaseUsername, renameUser]) {
    fn.mockReset();
    fn.mockReturnValue(resolves()());
  }
  advanceStop.mockImplementation(() => ({ unwrap: () => Promise.resolve() }));
  startRound.mockImplementation(() => ({ unwrap: () => Promise.resolve() }));
  updateCutovers.mockImplementation(() => ({ unwrap: () => Promise.resolve() }));
  setShadowBan.mockImplementation(() => ({ unwrap: () => Promise.resolve() }));
  releaseUsername.mockImplementation(() => ({ unwrap: () => Promise.resolve() }));
  renameUser.mockImplementation(() => ({ unwrap: () => Promise.resolve("Dave") }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────── the key gate ───────────────────────────

describe("the key gate", () => {
  it("shows the key form, and NONE of the controls, to someone with no key", () => {
    renderAdmin(null);

    expect(screen.getByLabelText("Admin key")).toBeInTheDocument();
    // The control for every unlock test below. Without this, a gate that
    // rendered the panel behind the form would pass all of them.
    expect(screen.queryByRole("button", { name: /Next pub/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Shadow ban" })).not.toBeInTheDocument();
  });

  it("unlocks on submit and remembers the key in sessionStorage", async () => {
    renderAdmin(null);

    await userEvent.type(screen.getByLabelText("Admin key"), "hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Unlock" }));

    expect(screen.getByRole("button", { name: /Next pub/ })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(ADMIN_KEY_STORAGE)).toBe("hunter2");
  });

  it("stays unlocked across a remount, because the key is in sessionStorage", () => {
    window.sessionStorage.setItem(ADMIN_KEY_STORAGE, "hunter2");
    renderAdmin(null);

    expect(screen.queryByLabelText("Admin key")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next pub/ })).toBeInTheDocument();
  });

  it("locking clears the key, so the next visitor gets the form again", async () => {
    window.sessionStorage.setItem(ADMIN_KEY_STORAGE, "hunter2");
    renderAdmin(null);

    await userEvent.click(screen.getByRole("button", { name: "Lock" }));

    expect(screen.getByLabelText("Admin key")).toBeInTheDocument();
    expect(window.sessionStorage.getItem(ADMIN_KEY_STORAGE)).toBeNull();
  });

  it("lets the admin straight in on their own token, with no key and no Lock button", () => {
    // His PR #23 decision: the admin arrives by tapping a tab and is already
    // authorised, so a second secret would be theatre. Lock is absent because
    // there is nothing key-shaped to clear — it would strand them.
    renderAdmin(session({ isAdmin: true }));

    expect(screen.queryByLabelText("Admin key")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next pub/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lock" })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(ADMIN_KEY_STORAGE)).toBeNull();
  });

  it("does NOT let an ordinary signed-in player in", () => {
    // isAdmin only decides what the app draws — but drawing it for the wrong
    // person is still how a guest finds the delete buttons.
    renderAdmin(session({ isAdmin: false }));

    expect(screen.getByLabelText("Admin key")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next pub/ })).not.toBeInTheDocument();
  });
});

// ─────────────────────────── Next pub ───────────────────────────

describe("Next pub", () => {
  const unlocked = () => {
    window.sessionStorage.setItem(ADMIN_KEY_STORAGE, "k");
    renderAdmin(null);
  };

  it("advances without a confirmation when the server allows it", async () => {
    unlocked();
    await userEvent.click(screen.getByRole("button", { name: /Next pub/ }));

    expect(advanceStop).toHaveBeenCalledTimes(1);
    expect(advanceStop).toHaveBeenCalledWith({ advanceStopRequest: {} });
    expect(await screen.findByRole("status")).toHaveTextContent("Next pub — done");
  });

  it("turns the 409 cooldown into the server's own question, then forces on yes", async () => {
    // The cooldown exists because the stop cannot be moved back. The question
    // is the SERVER's sentence because only the server knows when the last tap
    // was — a second phone on the same key would otherwise be guessed about.
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    advanceStop
      .mockImplementationOnce(() => ({
        unwrap: () => Promise.reject({ status: 409, data: { detail: "Stop 3 was advanced 40s ago. Again?" } }),
      }))
      .mockImplementationOnce(() => ({ unwrap: () => Promise.resolve() }));

    unlocked();
    await userEvent.click(screen.getByRole("button", { name: /Next pub/ }));

    expect(confirm).toHaveBeenCalledWith("Stop 3 was advanced 40s ago. Again?");
    expect(advanceStop).toHaveBeenNthCalledWith(2, { advanceStopRequest: { force: true } });
    expect(await screen.findByRole("status")).toHaveTextContent("Next pub — done");
  });

  it("leaves the stop where it was when the cooldown question is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    advanceStop.mockImplementation(() => ({
      unwrap: () => Promise.reject({ status: 409, data: { detail: "Again?" } }),
    }));

    unlocked();
    await userEvent.click(screen.getByRole("button", { name: /Next pub/ }));

    expect(advanceStop).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Next pub — left where it was");
  });

  it("NEVER re-sends with force when the failure is not the cooldown", async () => {
    // The load-bearing one. A retry-with-force on a 500 or a "the round has
    // ended" turns one broken attempt into a second, forced attempt at the same
    // broken thing — and force is the flag that skips the guard.
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    advanceStop.mockImplementation(() => ({
      unwrap: () => Promise.reject({ status: 500, data: { detail: "The round has ended." } }),
    }));

    unlocked();
    await userEvent.click(screen.getByRole("button", { name: /Next pub/ }));

    expect(await screen.findByRole("status")).toHaveTextContent("The round has ended.");
    expect(advanceStop).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
    expect(advanceStop).not.toHaveBeenCalledWith({ advanceStopRequest: { force: true } });
  });
});

// ─────────────────────────── the round reset ───────────────────────────

describe("Start a new round", () => {
  it("is not rendered once the game is live — a control you cannot see cannot be fat-fingered", () => {
    window.sessionStorage.setItem(ADMIN_KEY_STORAGE, "k");
    gameState.mockReturnValue({ data: { mode: "Live", roundName: "R", currentStopNumber: 3 } });
    renderAdmin(null);

    expect(screen.queryByRole("button", { name: "Start a new round" })).not.toBeInTheDocument();
    // The paired positive control: it is the MODE that hides it, not a broken render.
    expect(screen.getByRole("button", { name: /Next pub/ })).toBeInTheDocument();
  });

  it("is rendered in Practice, and asks before archiving everyone's photos", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    window.sessionStorage.setItem(ADMIN_KEY_STORAGE, "k");
    renderAdmin(null);

    await userEvent.click(screen.getByRole("button", { name: "Start a new round" }));

    expect(confirm).toHaveBeenCalledWith(
      "Start a new round? The current feed is archived and everyone starts fresh.",
    );
    expect(startRound).toHaveBeenCalledWith({ startRoundRequest: {} });
  });

  it("does nothing at all when the confirmation is declined", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    window.sessionStorage.setItem(ADMIN_KEY_STORAGE, "k");
    renderAdmin(null);

    await userEvent.click(screen.getByRole("button", { name: "Start a new round" }));

    expect(startRound).not.toHaveBeenCalled();
  });
});

// ─────────────────────────── cutovers ───────────────────────────

describe("Cutovers", () => {
  it("seeds both boxes from the game state, so the screen that owns them can read them", async () => {
    window.sessionStorage.setItem(ADMIN_KEY_STORAGE, "k");
    gameState.mockReturnValue({
      data: {
        mode: "Practice",
        roundName: "R",
        currentStopNumber: 1,
        goLiveAt: "2026-08-28T18:00:00Z",
        readOnlyAt: "2026-08-29T04:00:00Z",
      },
    });
    renderAdmin(null);

    // Both boxes used to start blank — the one screen that owns the cutovers
    // was also the only place you could not read them.
    await waitFor(() => expect(screen.getByLabelText("Go live")).toHaveValue("2026-08-28T18:00"));
    expect(screen.getByLabelText("Read only")).toHaveValue("2026-08-29T04:00");
  });

  it("cannot be saved until both are set", () => {
    window.sessionStorage.setItem(ADMIN_KEY_STORAGE, "k");
    renderAdmin(null);

    expect(screen.getByRole("button", { name: "Save cutovers" })).toBeDisabled();
  });

  it("sends both as ISO instants, not the local strings the boxes hold", async () => {
    window.sessionStorage.setItem(ADMIN_KEY_STORAGE, "k");
    renderAdmin(null);

    await userEvent.type(screen.getByLabelText("Go live"), "2026-08-28T18:00");
    await userEvent.type(screen.getByLabelText("Read only"), "2026-08-29T04:00");
    await userEvent.click(screen.getByRole("button", { name: "Save cutovers" }));

    const sent = updateCutovers.mock.calls[0][0].updateCutoversRequest;
    expect(sent.goLiveAt).toBe(new Date("2026-08-28T18:00").toISOString());
    expect(sent.readOnlyAt).toBe(new Date("2026-08-29T04:00").toISOString());
    // datetime-local carries no timezone, so the value that leaves must be an
    // instant. A local string reaching the server is the whole bug class here.
    expect(sent.goLiveAt).toMatch(/Z$/);
  });
});

// ─────────────────────────── people ───────────────────────────

describe("People", () => {
  const unlockedWithUsername = async (name = "Sam") => {
    window.sessionStorage.setItem(ADMIN_KEY_STORAGE, "k");
    renderAdmin(null);
    await userEvent.type(screen.getByLabelText("Username"), name);
  };

  it("disables every per-user action until a username is typed", () => {
    window.sessionStorage.setItem(ADMIN_KEY_STORAGE, "k");
    renderAdmin(null);

    for (const name of ["Shadow ban", "Unban", "Rename", "Release name (dead phone)"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("shadow-bans with isShadowBanned TRUE", async () => {
    await unlockedWithUsername();
    await userEvent.click(screen.getByRole("button", { name: "Shadow ban" }));

    expect(setShadowBan).toHaveBeenCalledWith({
      username: "Sam",
      shadowBanRequest: { isShadowBanned: true },
    });
  });

  it("unbans with isShadowBanned FALSE — the flag, not just the call", async () => {
    // Ban and unban are the same mutation with one boolean between them, so a
    // test that only asserts "setShadowBan ran" passes over an unban that bans.
    await unlockedWithUsername();
    await userEvent.click(screen.getByRole("button", { name: "Unban" }));

    expect(setShadowBan).toHaveBeenCalledWith({
      username: "Sam",
      shadowBanRequest: { isShadowBanned: false },
    });
  });

  it("releases a name behind a confirmation that says what it costs", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    await unlockedWithUsername();
    await userEvent.click(screen.getByRole("button", { name: "Release name (dead phone)" }));

    expect(confirm).toHaveBeenCalledWith(
      'Release "Sam"? They\'ll be logged out and the name can be claimed again.',
    );
    expect(releaseUsername).toHaveBeenCalledWith({ username: "Sam" });
  });

  it("renames, then points the box at the name the SERVER stored", async () => {
    // The server trims. If the box kept the typed value, the next action would
    // 404 against a name that stopped existing one click ago.
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renameUser.mockImplementation(() => ({ unwrap: () => Promise.resolve("Samantha") }));

    await unlockedWithUsername();
    await userEvent.type(screen.getByLabelText("New name"), "  Samantha  ");
    await userEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect(renameUser).toHaveBeenCalledWith({
      username: "Sam",
      renameUserRequest: { newUsername: "  Samantha  " },
    });
    await waitFor(() => expect(screen.getByLabelText("Username")).toHaveValue("Samantha"));
    expect(screen.getByLabelText("New name")).toHaveValue("");
  });

  it("surfaces the server's sentence when an action fails, not a generic one", async () => {
    releaseUsername.mockImplementation(() => ({
      unwrap: () => Promise.reject({ status: 404, data: { detail: "No such player." } }),
    }));
    vi.spyOn(window, "confirm").mockReturnValue(true);

    await unlockedWithUsername();
    await userEvent.click(screen.getByRole("button", { name: "Release name (dead phone)" }));

    expect(await screen.findByRole("status")).toHaveTextContent("No such player.");
  });
});
