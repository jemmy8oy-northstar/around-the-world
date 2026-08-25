import { describe, it, expect, vi, beforeEach } from "vitest";
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

function openMenuFor(name: string | RegExp) {
  return userEvent.click(screen.getByRole("button", { name }));
}

describe("moderating from the feed", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("gives an ordinary player no options menu at all", () => {
    render(
      <PostList
        currentUserId="user-1"
        posts={[post({ userId: "someone-else", username: "Sam" })]}
      />,
    );

    // The control for everything below: the menu must be the admin's alone, or
    // every guest would be handed a delete button for other people's photos.
    expect(
      screen.queryByRole("button", { name: /Options for/ }),
    ).not.toBeInTheDocument();
  });

  it("gives the admin an options menu on someone else's post", async () => {
    render(
      <PostList
        currentUserId="admin-1"
        canModerate
        posts={[post({ userId: "someone-else", username: "Sam" })]}
      />,
    );

    await openMenuFor("Options for Sam's post");

    expect(
      screen.getByRole("menuitem", { name: "Delete this post" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Shadow ban Sam" }),
    ).toBeInTheDocument();
  });

  it("deletes someone else's post through the same callback as your own", async () => {
    const onDelete = vi.fn();
    const target = post({ userId: "someone-else", username: "Sam" });

    render(
      <PostList
        currentUserId="admin-1"
        canModerate
        onDelete={onDelete}
        posts={[target]}
      />,
    );

    await openMenuFor("Options for Sam's post");
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Delete this post" }),
    );

    expect(onDelete).toHaveBeenCalledWith(target.id);
  });

  it("shadow bans the author of the post that was tapped", async () => {
    const onShadowBan = vi.fn();

    render(
      <PostList
        currentUserId="admin-1"
        canModerate
        onShadowBan={onShadowBan}
        posts={[
          post({ userId: "u-2", username: "Sam" }),
          post({ userId: "u-3", username: "Priya" }),
        ]}
      />,
    );

    await openMenuFor("Options for Priya's post");
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Shadow ban Priya" }),
    );

    // Naming the author in the callback rather than trusting menu order is the
    // difference between banning the person you tapped and banning whoever
    // happens to be first in the feed.
    expect(onShadowBan).toHaveBeenCalledWith("Priya", true);
  });

  it("offers to lift the ban on someone already hidden, and marks the post", async () => {
    const onShadowBan = vi.fn();

    render(
      <PostList
        currentUserId="admin-1"
        canModerate
        shadowBannedUsernames={["Sam"]}
        onShadowBan={onShadowBan}
        posts={[post({ userId: "u-2", username: "Sam" })]}
      />,
    );

    expect(screen.getByText("Hidden")).toBeInTheDocument();

    await openMenuFor("Options for Sam's post");
    await userEvent.click(screen.getByRole("menuitem", { name: "Un-hide Sam" }));

    expect(onShadowBan).toHaveBeenCalledWith("Sam", false);
  });

  it("matches the ban list to the author however each side cased the name", () => {
    render(
      <PostList
        currentUserId="admin-1"
        canModerate
        shadowBannedUsernames={["sam"]}
        posts={[post({ userId: "u-2", username: "Sam" })]}
      />,
    );

    expect(screen.getByText("Hidden")).toBeInTheDocument();
  });

  it("does not offer to shadow ban yourself", async () => {
    render(
      <PostList
        currentUserId="admin-1"
        canModerate
        posts={[post({ userId: "admin-1", username: "james" })]}
      />,
    );

    await openMenuFor("Options for james's post");

    // Hiding yourself from everyone else looks completely normal from your own
    // side — it is the one ban whose effect the person applying it cannot see.
    expect(
      screen.queryByRole("menuitem", { name: /Shadow ban/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete this post" }),
    ).toBeInTheDocument();
  });

  it("does not mark a post as hidden for an ordinary player", () => {
    render(
      <PostList
        currentUserId="user-9"
        shadowBannedUsernames={["Sam"]}
        posts={[post({ userId: "u-2", username: "Sam" })]}
      />,
    );

    // Defence in depth: the list is admin-gated server-side, but if it ever
    // reached an ordinary client the badge must not announce the ban.
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("closes the menu on Escape", async () => {
    render(
      <PostList
        currentUserId="admin-1"
        canModerate
        posts={[post({ userId: "u-2", username: "Sam" })]}
      />,
    );

    await openMenuFor("Options for Sam's post");
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
