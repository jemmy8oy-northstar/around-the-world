import { useState, type FormEvent } from "react";
import { useDispatch } from "react-redux";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useJoinMutation } from "../api/atwApi";
import { sessionEstablished } from "../auth/sessionSlice";
import { useSession } from "../auth/useSession";
import { problemDetail } from "../api/problemDetail";
import "./Join.css";

export default function Join() {
  const session = useSession();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [join, { isLoading }] = useJoinMutation();

  const [partyCode, setPartyCode] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (session) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const result = await join({
        joinRequest: { partyCode, username },
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

      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? "/", { replace: true });
    } catch (caught) {
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
        <label className="join__label" htmlFor="partyCode">
          Party code
        </label>
        <input
          id="partyCode"
          className="join__input join__input--code"
          value={partyCode}
          onChange={(e) => setPartyCode(e.target.value)}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="off"
          required
        />

        <label className="join__label" htmlFor="username">
          Your name
        </label>
        <input
          id="username"
          className="join__input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="What should we call you?"
          autoComplete="off"
          maxLength={32}
          required
        />

        {error && (
          <p className="join__error" role="alert">
            {error}
          </p>
        )}

        <button className="join__submit" type="submit" disabled={isLoading}>
          {isLoading ? "Joining…" : "Let's go"}
        </button>
      </form>
    </div>
  );
}
