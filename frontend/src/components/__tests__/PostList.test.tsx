import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PostList } from "../PostList";
import type { Post } from "../../api/generatedApi";

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: crypto.randomUUID(),
    userId: "user-1",
    username: "Dave",
    photoUrl: "/api/photos/x.jpg",
    caption: "a drink",
    countryCode: "IE",
    stopNumber: 1,
    createdAt: "2026-08-26T20:00:00Z",
    ...overrides,
  };
}

describe("PostList", () => {
  it("groups the feed under one divider per stop", () => {
    render(
      <PostList
        currentUserId="user-1"
        showStopDividers
        posts={[
          post({ stopNumber: 3, caption: "c" }),
          post({ stopNumber: 3, caption: "b" }),
          post({ stopNumber: 1, caption: "a" }),
        ]}
      />,
    );

    // Two posts at stop 3 must share one heading, not get one each.
    expect(screen.getByText("🍺 Stop 3")).toBeInTheDocument();
    expect(screen.getByText("🍺 Stop 1")).toBeInTheDocument();
    expect(screen.getAllByText(/🍺 Stop/)).toHaveLength(2);
  });

  it("omits dividers when not asked for them", () => {
    render(
      <PostList
        currentUserId="user-1"
        posts={[post(), post({ stopNumber: 2 })]}
      />,
    );

    expect(screen.queryByText(/🍺 Stop/)).not.toBeInTheDocument();
  });

  it("offers delete only on your own posts", async () => {
    const onDelete = vi.fn();
    render(
      <PostList
        currentUserId="user-1"
        onDelete={onDelete}
        posts={[post({ userId: "user-1" }), post({ userId: "someone-else" })]}
      />,
    );

    const buttons = screen.getAllByRole("button", { name: "Delete" });
    expect(buttons).toHaveLength(1);

    await userEvent.click(buttons[0]);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
