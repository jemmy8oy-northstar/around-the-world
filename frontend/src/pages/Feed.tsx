import { useGetPostsQuery, useDeletePostMutation } from "../api/atwApi";
import { PostList } from "../components/PostList";
import { EmptyState } from "../components/EmptyState";
import { useSession } from "../auth/useSession";
import { useModeration } from "../auth/useModeration";

export default function Feed() {
  const session = useSession();
  const { data: posts, isLoading, isError } = useGetPostsQuery({});
  const [deletePost] = useDeletePostMutation();
  const { canModerate, shadowBannedUsernames, onShadowBan } = useModeration();

  if (isLoading)
    return (
      <EmptyState
        icon="⏳"
        title="Loading"
        message="Fetching the last round…"
      />
    );

  if (isError) {
    return (
      <EmptyState
        icon="📡"
        title="Couldn't load the feed"
        message="Pull down to refresh, or try again in a moment."
      />
    );
  }

  if (!posts?.length) {
    return (
      <EmptyState
        icon="🍺"
        title="Nothing yet"
        message="Be the first — tap Post and get a drink on the board."
      />
    );
  }

  return (
    <PostList
      posts={posts}
      currentUserId={session?.userId ?? ""}
      canModerate={canModerate}
      shadowBannedUsernames={shadowBannedUsernames}
      onDelete={(postId) => deletePost({ postId })}
      onShadowBan={onShadowBan}
      showStopDividers
    />
  );
}
