import { useEffect, useRef, useState, type FormEvent } from "react";
import { useDispatch } from "react-redux";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  useGetGameStateQuery,
  useJoinMutation,
  useRecordChannelVisitMutation,
} from "../api/atwApi";
import { sessionEstablished } from "../auth/sessionSlice";
import { useSession } from "../auth/useSession";
import { problemDetail } from "../api/problemDetail";
import { SubscribePlug } from "../components/SubscribePlug";
import { clearPending, isPending } from "../youtube/pendingChannelVisit";
import "./Join.css";

/**
 * The API answers a name that needs the host code with 403, and that is the only
 * 403 this endpoint can produce — a taken name is 409 and a malformed one is
 * 400. So it is safe to key the extra field off the status alone rather than
 * string-matching the message, which would break the first time the copy moved.
 */
function needsHostCode(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { status?: unknown }).status === 403
  );
}

export default function Join() {
  const session = useSession();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [join, { isLoading }] = useJoinMutation();
  const [recordChannelVisit] = useRecordChannelVisitMutation();
  // Anonymous, and already fetched here for the countdown — the channel URL
  // rides along on it rather than needing an endpoint of its own.
  const { data: game } = useGetGameStateQuery();

  const [username, setUsername] = useState("");
  const [hostCode, setHostCode] = useState("");
  const [askForHostCode, setAskForHostCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hostCodeRef = useRef<HTMLInputElement>(null);

  // Focus the code field the moment it appears, so the host starts typing
  // instead of hunting for what just changed on the screen.
  useEffect(() => {
    if (askForHostCode) hostCodeRef.current?.focus();
  }, [askForHostCode]);

  if (session) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const result = await join({
        // Sent only once the API has asked for it. A guest never types a code
        // and never sends one.
        joinRequest: { username, partyCode: askForHostCode ? hostCode : null },
      }).unwrap();

      dispatch(
        sessionEstablished({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          userId: result.userId ?? "",
          username: result.username,
          isAdmin: result.isAdmin === true,
        }),
      );

      // They tapped the plug before they had a name to attribute it to. Now
      // they have one, so cash it in — and never let this fail the join.
      if (isPending()) {
        try {
          await recordChannelVisit().unwrap();
          clearPending();
        } catch {
          // Left pending: the next join from this device tries again.
        }
      }

      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? "/", { replace: true });
    } catch (caught) {
      if (needsHostCode(caught)) setAskForHostCode(true);

      setError(
        problemDetail(caught) ?? "That didn't work — give it another go.",
      );
    }
  }

  return (
    <div className="join">
      <div className="join__mark" aria-hidden="true">
        🌍
      </div>
      <h1 className="join__title">Around the World</h1>
      <p className="join__blurb">
        A drink from a different country at every stop. Photograph it, caption
        it, tag where it's from.
      </p>

      <form className="join__form" onSubmit={onSubmit}>
        <label className="join__label" htmlFor="username">
          Your name
        </label>
        <input
          id="username"
          className="join__input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="This will appear above your posts"
          autoComplete="off"
          maxLength={32}
          required
          autoFocus
        />

        {/* Never rendered for a guest. It appears only after the API refuses a
            name as the host's, which is the one case a code is still read. */}
        {askForHostCode && (
          <>
            <label className="join__label" htmlFor="hostCode">
              Host code
            </label>
            <input
              id="hostCode"
              ref={hostCodeRef}
              className="join__input join__input--code"
              value={hostCode}
              onChange={(e) => setHostCode(e.target.value)}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="off"
              required
            />
          </>
        )}

        {error && (
          <p className="join__error" role="alert">
            {error}
          </p>
        )}

        <button className="join__submit" type="submit" disabled={isLoading}>
          {isLoading ? "Joining…" : "Let's go"}
        </button>
      </form>

      <SubscribePlug channelUrl={game?.youTubeUrl} />
    </div>
  );
}
