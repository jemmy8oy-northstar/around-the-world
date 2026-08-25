import { useEffect, useState, type FormEvent } from "react";
import {
  useAdvancePubStopMutation,
  useGetGameStateQuery,
  useReleaseUsernameMutation,
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

  const [username, setUsername] = useState("");
  const [goLiveAt, setGoLiveAt] = useState("");
  const [readOnlyAt, setReadOnlyAt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [dangerZoneOpen, setDangerZoneOpen] = useState(false);

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
  // thing. Once Live it is a mis-tap in a dark pub, so it moves behind a
  // deliberate disclosure rather than sitting next to the button used all night.
  const roundResetIsRoutine = game?.mode === "Practice";

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
          onClick={() => run("Next pub", () => advanceStop().unwrap())}
        >
          🍺 Next pub
        </button>
        {roundResetIsRoutine ? (
          <button
            className="admin__danger"
            type="button"
            onClick={() =>
              run(
                "New round",
                () => startRound({ startRoundRequest: {} }).unwrap(),
                "Start a new round? The current feed is archived and everyone starts fresh.",
              )
            }
          >
            Start a new round
          </button>
        ) : (
          <div className="admin__danger-zone">
            {dangerZoneOpen ? (
              <>
                <p className="admin__warning" role="status">
                  The game is <strong>{game?.mode}</strong>. Starting a round
                  clears the feed for everyone — nothing is deleted, but the
                  night so far is archived out of sight.
                </p>
                <button
                  className="admin__danger"
                  type="button"
                  onClick={() =>
                    run(
                      "New round",
                      () => startRound({ startRoundRequest: {} }).unwrap(),
                      "Really start a new round mid-game? Everyone's feed goes empty.",
                    )
                  }
                >
                  Yes, start a new round
                </button>
                <button
                  className="admin__secondary"
                  type="button"
                  onClick={() => setDangerZoneOpen(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                className="admin__quiet"
                type="button"
                onClick={() => setDangerZoneOpen(true)}
              >
                Danger zone
              </button>
            )}
          </div>
        )}
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
