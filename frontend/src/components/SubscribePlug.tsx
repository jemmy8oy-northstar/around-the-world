import { markPending } from "../youtube/pendingChannelVisit";
import "./SubscribePlug.css";

interface SubscribePlugProps {
  /** Empty switches the plug off entirely — the server's kill switch. */
  channelUrl: string | undefined;
  /**
   * Called instead of parking the tap when a session already exists, so the
   * visit is recorded immediately rather than on the next join.
   */
  onVisit?: () => void;
}

/**
 * The birthday ask: go and subscribe. Tapping it is recorded against the player
 * and earns the badge beside their name in the feed.
 *
 * It is a real anchor, not a button with a handler — a phone must be able to
 * long-press it, open it in the YouTube app, and come back. `onClick` still
 * fires on a plain tap, so the visit is recorded either way.
 */
export function SubscribePlug({ channelUrl, onVisit }: SubscribePlugProps) {
  if (!channelUrl) return null;

  return (
    <aside className="plug">
      <p className="plug__ask">
        Subscribe to my YouTube and I'll count that as my birthday present 🎁
      </p>

      <a
        className="plug__link"
        href={channelUrl}
        target="_blank"
        rel="noreferrer noopener"
        onClick={() => (onVisit ? onVisit() : markPending())}
      >
        ▶︎ Subscribe
      </a>

      <p className="plug__reward">
        Everyone who does gets a 👑 next to their name all night.
      </p>
    </aside>
  );
}
