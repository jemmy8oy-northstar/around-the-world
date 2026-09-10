import { useEffect, useState, type FormEvent } from "react";
import {
  useAdvancePubStopMutation,
  useGetGameStateQuery,
  useReleaseUsernameMutation,
  useRenameUserMutation,
  useSetShadowBanMutation,
  useStartNewRoundMutation,
  useUpdateCutoversMutation,
} from "../api/atwApi";
import { problemDetail } from "../api/problemDetail";
import { AppShell } from "../components/AppShell";
import { useSession } from "../auth/useSession";
import { toLocalInputValue } from "./adminTime";
import "./Admin.css";

const ADMIN_KEY_STORAGE = "atw.adminKey";

/**
 * The control panel. The admin reaches it from their own tab and is already
 * authorised by their token; anyone else needs the shared key, which is held in
 * sessionStorage rather than localStorage so it does not linger on a phone that
 * gets handed round.
 */
export default function Admin() {
  const session = useSession();
  const [adminKey, setAdminKey] = useState(
    () => window.sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? "",
  );
  const [unlocked, setUnlocked] = useState(
    () => !!window.sessionStorage.getItem(ADMIN_KEY_STORAGE),
  );

  // The admin's own token already opens every route here, so asking them for a
  // second secret would be theatre — and the one they would have to type is the
  // one nobody remembers at the sixth pub.
  //
  // Wrapped in the shell because they arrive by tapping a tab: without it the
  // tab bar vanishes on the one page whose whole purpose is to be dipped into
  // and left again, stranding them on a back button.
  if (session?.isAdmin) {
    return (
      <AppShell>
        <AdminPanel onLock={null} />
      </AppShell>
    );
  }

  if (!unlocked) {
    return (
      <form
        className="admin admin--locked"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          window.sessionStorage.setItem(ADMIN_KEY_STORAGE, adminKey);
          setUnlocked(true);
        }}
      >
        <h1 className="admin__title">Admin</h1>
        <input
          className="admin__input"
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="Admin key"
          aria-label="Admin key"
          autoComplete="off"
        />
        <button className="admin__primary" type="submit">
          Unlock
        </button>
      </form>
    );
  }

  return (
    <AdminPanel
      onLock={() => {
        window.sessionStorage.removeItem(ADMIN_KEY_STORAGE);
        setUnlocked(false);
      }}
    />
  );
}

function AdminPanel({ onLock }: { onLock: (() => void) | null }) {
  const { data: game } = useGetGameStateQuery();
  const [advanceStop] = useAdvancePubStopMutation();
  const [startRound] = useStartNewRoundMutation();
  const [updateCutovers] = useUpdateCutoversMutation();
  const [setShadowBan] = useSetShadowBanMutation();
  const [releaseUsername] = useReleaseUsernameMutation();
  const [renameUser] = useRenameUserMutation();

  const [username, setUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [goLiveAt, setGoLiveAt] = useState("");
  const [readOnlyAt, setReadOnlyAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Both boxes used to start blank, so the one screen that owns the cutovers was
  // also the one place you could not read them. Seeded from the game state the
  // moment it arrives — and only then, so it does not fight the admin's typing.
  useEffect(() => {
    if (!game?.goLiveAt || !game?.readOnlyAt) return;
    setGoLiveAt((current) => current || toLocalInputValue(game.goLiveAt));
    setReadOnlyAt((current) => current || toLocalInputValue(game.readOnlyAt));
  }, [game?.goLiveAt, game?.readOnlyAt]);

  // Resetting the round archives everyone's photos. In Practice that is the
  // point — it is how the build week's test posts get cleared before the real
  // thing. It used to be hidden from go-live onwards, on the reasoning that a
  // control you cannot see cannot be fat-fingered, with "push Go live forward
  // to get back to Practice" as the escape hatch.
  //
  // The real night proved that wrong (#61): the game went live still holding
  // the build week's posts and sitting on stop 2, and the one control that
  // fixes both was the one that had just disappeared. Three taps of indirection
  // is too far away with a room full of people waiting.
  //
  // So it is always rendered now, and the fat-finger guard moved into the
  // confirmation instead: past go-live the dialog says LIVE and names what it
  // destroys. That is the same guard the Next pub cooldown relies on — a modal
  // swallows the second tap of a double-tap rather than answering itself.
  const roundResetIsLive = !!game && game.mode !== "Practice";

  async function run(
    label: string,
    action: () => Promise<unknown>,
    confirmText?: string,
  ) {
    if (confirmText && !window.confirm(confirmText)) return;

    try {
      await action();
      setMessage(`${label} — done`);
    } catch (caught) {
      setMessage(problemDetail(caught) ?? `${label} — failed`);
    }
  }

  /**
   * The stop cannot be moved back — undoing one means restarting the whole
   * round, which archives everybody's photos. So the server refuses a second
   * advance inside five minutes, and that refusal is turned into the question it
   * actually is rather than an error.
   *
   * The confirmation is asked with the SERVER's sentence, which names the stop
   * and how long ago: only the server knows when the last tap was, and a second
   * phone on the same admin key would otherwise be guessed about locally.
   *
   * A double-tap cannot get through this. The first tap advances, the second is
   * refused and opens a modal dialog — which swallows the taps that follow it
   * rather than answering itself.
   */
  async function advanceToNextPub() {
    try {
      await advanceStop({ advanceStopRequest: {} }).unwrap();
      setMessage("Next pub — done");
      return;
    } catch (caught) {
      const question = problemDetail(caught);

      // 409 is the cooldown and nothing else on this route. Anything else is a
      // real failure and must not be re-sent with force — that would turn "the
      // round has ended" into a second attempt at the same broken thing.
      if ((caught as { status?: unknown })?.status !== 409 || !question) {
        setMessage(question ?? "Next pub — failed");
        return;
      }

      if (!window.confirm(question)) {
        setMessage("Next pub — left where it was");
        return;
      }
    }

    try {
      await advanceStop({ advanceStopRequest: { force: true } }).unwrap();
      setMessage("Next pub — done");
    } catch (caught) {
      setMessage(problemDetail(caught) ?? "Next pub — failed");
    }
  }

  return (
    <div className="admin">
      <div className="admin__header">
        <h1 className="admin__title">Admin</h1>
        {onLock && (
          <button className="admin__lock" type="button" onClick={onLock}>
            Lock
          </button>
        )}
      </div>

      <div className="admin__status">
        <span>
          <strong>{game?.mode ?? "—"}</strong> · {game?.roundName ?? "—"} · Stop{" "}
          {game?.currentStopNumber ?? "—"}
        </span>
      </div>

      {message && (
        <p className="admin__message" role="status">
          {message}
        </p>
      )}

      <section className="admin__section">
        <h2 className="admin__heading">The night</h2>
        <button
          className="admin__primary"
          type="button"
          onClick={advanceToNextPub}
        >
          🍺 Next pub
        </button>
        <button
          className="admin__danger"
          type="button"
          onClick={() =>
            run(
              "New round",
              () => startRound({ startRoundRequest: {} }).unwrap(),
              roundResetIsLive
                ? "You are LIVE. Starting a new round archives every photo posted so far and puts the group back to Stop 1. There is no undo. Do it?"
                : "Start a new round? The current feed is archived and everyone starts fresh.",
            )
          }
        >
          Start a new round
        </button>
      </section>

      <section className="admin__section">
        <h2 className="admin__heading">Cutovers</h2>
        <p className="admin__hint">
          Shown and entered in your phone's timezone — UK time on the night.
        </p>
        <label className="admin__label" htmlFor="goLiveAt">
          Go live
        </label>
        <input
          id="goLiveAt"
          className="admin__input"
          type="datetime-local"
          value={goLiveAt}
          onChange={(e) => setGoLiveAt(e.target.value)}
        />
        <label className="admin__label" htmlFor="readOnlyAt">
          Read only
        </label>
        <input
          id="readOnlyAt"
          className="admin__input"
          type="datetime-local"
          value={readOnlyAt}
          onChange={(e) => setReadOnlyAt(e.target.value)}
        />
        <button
          className="admin__primary"
          type="button"
          disabled={!goLiveAt || !readOnlyAt}
          onClick={() =>
            run("Cutovers", () =>
              updateCutovers({
                updateCutoversRequest: {
                  // datetime-local has no timezone; the browser is on UK time on
                  // the night, so interpreting it locally is what's meant.
                  goLiveAt: new Date(goLiveAt).toISOString(),
                  readOnlyAt: new Date(readOnlyAt).toISOString(),
                },
              }).unwrap(),
            )
          }
        >
          Save cutovers
        </button>
      </section>

      <section className="admin__section">
        <h2 className="admin__heading">People</h2>
        <input
          className="admin__input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          aria-label="Username"
          autoComplete="off"
        />
        <div className="admin__row">
          <button
            className="admin__secondary"
            type="button"
            disabled={!username}
            onClick={() =>
              run("Shadow ban", () =>
                setShadowBan({
                  username,
                  shadowBanRequest: { isShadowBanned: true },
                }).unwrap(),
              )
            }
          >
            Shadow ban
          </button>
          <button
            className="admin__secondary"
            type="button"
            disabled={!username}
            onClick={() =>
              run("Unban", () =>
                setShadowBan({
                  username,
                  shadowBanRequest: { isShadowBanned: false },
                }).unwrap(),
              )
            }
          >
            Unban
          </button>
        </div>
        <div className="admin__row">
          <input
            className="admin__input"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="New name"
            aria-label="New name"
            autoComplete="off"
            maxLength={32}
          />
          <button
            className="admin__secondary"
            type="button"
            disabled={!username || !newUsername}
            onClick={() =>
              run(
                "Rename",
                async () => {
                  const saved = await renameUser({
                    username,
                    renameUserRequest: { newUsername },
                  }).unwrap();

                  // Point the box at the name that now exists, so the next
                  // action does not 404 against the one that just stopped
                  // existing. The server trims, so use what it stored.
                  setUsername(saved);
                  setNewUsername("");
                },
                `Rename "${username}" to "${newUsername}"? They stay logged in and keep their posts.`,
              )
            }
          >
            Rename
          </button>
        </div>
        <button
          className="admin__secondary"
          type="button"
          disabled={!username}
          onClick={() =>
            run(
              "Release name",
              () => releaseUsername({ username }).unwrap(),
              `Release "${username}"? They'll be logged out and the name can be claimed again.`,
            )
          }
        >
          Release name (dead phone)
        </button>
      </section>
    </div>
  );
}
