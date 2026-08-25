import { useState } from "react";
import type { Post } from "../api/generatedApi";
import { countryFlag, countryName } from "../countries/countries";
import "./PostCard.css";

interface PostCardProps {
  post: Post;
  canDelete: boolean;
  onDelete?: (postId: string) => void;
}

export function PostCard({ post, canDelete, onDelete }: PostCardProps) {
  const [photoFailed, setPhotoFailed] = useState(false);

  return (
    <article className="post">
      <div className="post__photo-frame">
        {post.photoUrl && !photoFailed ? (
          <img
            className="post__photo"
            src={post.photoUrl}
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
          {post.createdAt && (
            <time className="post__time" dateTime={post.createdAt}>
              {new Date(post.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          )}
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
