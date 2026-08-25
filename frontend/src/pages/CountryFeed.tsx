import { Link, useParams } from "react-router-dom";
import { useGetPostsQuery, useDeletePostMutation } from "../api/atwApi";
import { PostList } from "../components/PostList";
import { EmptyState } from "../components/EmptyState";
import { useSession } from "../auth/useSession";
import { useModeration } from "../auth/useModeration";
import { countryFlag, countryName } from "../countries/countries";
import "./CountryFeed.css";

export default function CountryFeed() {
  const { countryCode = "" } = useParams();
  const session = useSession();
  const { data: posts, isLoading } = useGetPostsQuery({ country: countryCode });
  const [deletePost] = useDeletePostMutation();
  const { canModerate, shadowBannedUsernames, onShadowBan } = useModeration();

  return (
    <div className="countryfeed">
      <div className="countryfeed__header">
        <Link className="countryfeed__back" to="/map">
          ← Map
        </Link>
        <h1 className="countryfeed__title">
          {countryFlag(countryCode)} {countryName(countryCode)}
        </h1>
      </div>

      {isLoading && (
        <EmptyState icon="⏳" title="Loading" message="Fetching drinks…" />
      )}

      {!isLoading && !posts?.length && (
        <EmptyState
          icon="🥃"
          title="Nothing from here yet"
          message={`No one has had a drink from ${countryName(countryCode)}.`}
        />
      )}

      {!isLoading && !!posts?.length && (
        <PostList
          posts={posts}
          currentUserId={session?.userId ?? ""}
          canModerate={canModerate}
          shadowBannedUsernames={shadowBannedUsernames}
          onDelete={(postId) => deletePost({ postId })}
          onShadowBan={onShadowBan}
        />
      )}
    </div>
  );
}
