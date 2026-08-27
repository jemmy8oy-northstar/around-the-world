import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostCard } from "../PostCard";
import type { Post } from "../../api/generatedApi";

const BASE: Post = {
  id: "p1",
  userId: "u1",
  username: "Dave",
  photoUrl: "/api/photos/x.jpg",
  caption: "Guinness, obviously",
  countryCode: "IE",
  stopNumber: 1,
  createdAt: "2026-08-26T20:00:00Z",
};

describe("PostCard", () => {
  it("shows the country by name and flag, not the raw code", () => {
    render(<PostCard post={BASE} canDelete={false} />);

    expect(screen.getByText(/Ireland/)).toBeInTheDocument();
  });

  it("crowns an author who tapped through to the channel", () => {
    render(
      <PostCard post={{ ...BASE, authorVisitedChannel: true }} canDelete={false} />,
    );

    // Found by its accessible name, not by the emoji — a bare 👑 tells a screen
    // reader "crown", which explains nothing.
    expect(
      screen.getByRole("img", { name: "Subscribed to the channel" }),
    ).toBeInTheDocument();
  });

  it("does not crown an author who did not", () => {
    render(<PostCard post={BASE} canDelete={false} />);

    expect(
      screen.queryByRole("img", { name: "Subscribed to the channel" }),
    ).not.toBeInTheDocument();
  });

  it("falls back to a labelled placeholder when the photo fails to load", () => {
    render(<PostCard post={BASE} canDelete={false} />);

    fireEvent.error(screen.getByRole("img", { name: /Guinness, obviously/ }));

    // Storage may not be configured yet, and a photo can 404 — a broken image
    // icon would make the whole feed look broken.
    expect(
      screen.getByRole("img", { name: "Photo unavailable" }),
    ).toBeInTheDocument();
  });

  it("shows the placeholder when there is no photo url at all", () => {
    render(<PostCard post={{ ...BASE, photoUrl: "" }} canDelete={false} />);

    expect(
      screen.getByRole("img", { name: "Photo unavailable" }),
    ).toBeInTheDocument();
  });

  it("renders without a caption", () => {
    render(<PostCard post={{ ...BASE, caption: "" }} canDelete={false} />);

    expect(screen.getByText("Dave")).toBeInTheDocument();
  });
});
