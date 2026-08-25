import { useGetGameStateQuery } from "../api/atwApi";
import "./GameBanner.css";

/**
 * The persistent header: which pub stop the group is on, and what mode the game
 * is in. Practice and Finished are called out explicitly — during the build week
 * everything is postable but must not look like the real night, and once the
 * game is over the app has to say so rather than silently rejecting posts.
 */
export function GameBanner() {
  const { data: game } = useGetGameStateQuery();

  if (!game) return null;

  return (
    <header className="banner">
      <div className="banner__stop">
        <span className="banner__stop-label">Stop</span>
        <span className="banner__stop-number">
          {game.currentStopNumber ?? 1}
        </span>
      </div>

      <div className="banner__title">Around the World</div>

      {game.mode === "Practice" && (
        <span className="banner__mode banner__mode--practice">Practice</span>
      )}
      {game.mode === "Finished" && (
        <span className="banner__mode banner__mode--finished">
          That's a wrap
        </span>
      )}
    </header>
  );
}
