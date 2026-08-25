import type { Post } from "../api/generatedApi";
import { PostCard } from "./PostCard";
import "./PostList.css";

interface PostListProps {
  posts: Post[];
  currentUserId: string;
  /** The admin sees an options menu on every post, not just their own. */
  canModerate?: boolean;
  /** Admin-only: usernames currently hidden from everyone else. */
  shadowBannedUsernames?: string[];
  onDelete?: (postId: string) => void;
  onShadowBan?: (username: string, shadowBan: boolean) => void;
  /** Groups the feed under "Stop N" headings. Off for a single-country feed. */
  showStopDividers?: boolean;
}

export function PostList({
  posts,
  currentUserId,
  canModerate = false,
  shadowBannedUsernames,
  onDelete,
  onShadowBan,
  showStopDividers = false,
}: PostListProps) {
  // Compared lower-cased because the ban list carries the name as it was
  // claimed ("Dave") while a post carries the same stored value — matching on
  // the raw string works today and would break silently the moment either side
  // changes how it cases a name.
  const banned = new Set(
    (shadowBannedUsernames ?? []).map((name) => name.toLowerCase()),
  );
  let lastStop: number | null = null;

  return (
    <div className="postlist">
      {posts.map((post) => {
        const stop = post.stopNumber ?? 1;
        const needsDivider = showStopDividers && stop !== lastStop;
        lastStop = stop;

        return (
          <div key={post.id}>
            {needsDivider && (
              <div className="postlist__divider">
                <span className="postlist__divider-label">🍺 Stop {stop}</span>
              </div>
            )}
            <PostCard
              post={post}
              canDelete={post.userId === currentUserId}
              canModerate={canModerate}
              // Gated on canModerate as well as the list itself: the list is
              // admin-only server-side, but if it ever reached an ordinary
              // client the badge would announce a ban that is supposed to be
              // undetectable.
              authorIsShadowBanned={
                canModerate && banned.has((post.username ?? "").toLowerCase())
              }
              onDelete={onDelete}
              onShadowBan={onShadowBan}
            />
          </div>
        );
      })}
    </div>
  );
}
