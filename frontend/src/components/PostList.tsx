import type { Post } from "../api/generatedApi";
import { PostCard } from "./PostCard";
import "./PostList.css";

interface PostListProps {
  posts: Post[];
  currentUserId: string;
  onDelete?: (postId: string) => void;
  /** Groups the feed under "Stop N" headings. Off for a single-country feed. */
  showStopDividers?: boolean;
}

export function PostList({
  posts,
  currentUserId,
  onDelete,
  showStopDividers = false,
}: PostListProps) {
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
              onDelete={onDelete}
            />
          </div>
        );
      })}
    </div>
  );
}
