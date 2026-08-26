import { useState } from "react";
import type { Post } from "../api/generatedApi";
import { countryFlag, countryName } from "../countries/countries";
import { resolveServerUrl } from "../api/basePath";
import { PostActionsMenu, type PostAction } from "./PostActionsMenu";
import "./PostCard.css";

interface PostCardProps {
  post: Post;
  canDelete: boolean;
  /** The admin, who can act on anyone's post rather than only their own. */
  canModerate?: boolean;
  /** Admin-only: this author is currently hidden from everyone else. */
  authorIsShadowBanned?: boolean;
  onDelete?: (postId: string) => void;
  onShadowBan?: (username: string, shadowBan: boolean) => void;
}

export function PostCard({
  post,
  canDelete,
  canModerate = false,
  authorIsShadowBanned = false,
  onDelete,
  onShadowBan,
}: PostCardProps) {
  const [photoFailed, setPhotoFailed] = useState(false);

  const moderation: PostAction[] = [];

  if (canModerate && post.id) {
    moderation.push({
      label: "Delete this post",
      destructive: true,
      confirm: `Delete ${post.username}'s post? It disappears from the feed for everyone.`,
      onSelect: () => onDelete?.(post.id!),
    });
  }

  if (canModerate && post.username && !canDelete) {
    // Not offered on your own post: shadow-banning yourself would hide you from
    // everyone while looking completely normal from your side, which is a trap
    // rather than a feature.
    moderation.push(
      authorIsShadowBanned
        ? {
            label: `Un-hide ${post.username}`,
            onSelect: () => onShadowBan?.(post.username, false),
          }
        : {
            label: `Shadow ban ${post.username}`,
            destructive: true,
            confirm: `Shadow ban ${post.username}? Their posts vanish for everyone else. They will not be told.`,
            onSelect: () => onShadowBan?.(post.username, true),
          },
    );
  }

  return (
    <article
      className={`post${authorIsShadowBanned ? " post--shadow-banned" : ""}`}
    >
      <div className="post__photo-frame">
        {post.photoUrl && !photoFailed ? (
          <img
            className="post__photo"
            // The API returns "/api/photos/{key}" when the bucket is private
            // (PublicBaseUrl empty), which is the configured setup. That path
            // is root-relative and this app is not at the root — without the
            // prefix every photo in the feed 404s. resolveServerUrl passes a
            // real bucket URL through untouched.
            src={resolveServerUrl(post.photoUrl)}
            alt={
              post.caption || `A drink from ${countryName(post.countryCode)}`
            }
            loading="lazy"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          // Storage may not be configured yet, and a photo can 404. A labelled
          // placeholder keeps the feed readable instead of showing a broken image.
          <div
            className="post__placeholder"
            role="img"
            aria-label="Photo unavailable"
          >
            <span className="post__placeholder-flag">
              {countryFlag(post.countryCode)}
            </span>
            <span className="post__placeholder-text">Photo unavailable</span>
          </div>
        )}

        <span className="post__country">
          {countryFlag(post.countryCode)} {countryName(post.countryCode)}
        </span>
      </div>

      <div className="post__body">
        <div className="post__meta">
          <span className="post__author">{post.username}</span>

          {authorIsShadowBanned && (
            <span className="post__hidden-badge">Hidden</span>
          )}

          {post.createdAt && (
            <time className="post__time" dateTime={post.createdAt}>
              {new Date(post.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          )}

          <PostActionsMenu
            actions={moderation}
            label={`Options for ${post.username}'s post`}
          />
        </div>

        {post.caption && <p className="post__caption">{post.caption}</p>}

        {canDelete && post.id && (
          <button
            className="post__delete"
            type="button"
            onClick={() => onDelete?.(post.id!)}
          >
            Delete
          </button>
        )}
      </div>
    </article>
  );
}
