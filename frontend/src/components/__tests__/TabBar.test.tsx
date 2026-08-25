import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { TabBar } from "../TabBar";
import sessionReducer from "../../auth/sessionSlice";
import type { StoredSession } from "../../auth/tokenStorage";

function renderWith(session: StoredSession | null) {
  const store = configureStore({
    reducer: { session: sessionReducer },
    preloadedState: { session: { session } },
  });

  return render(
    <Provider store={store}>
      <MemoryRouter>
        <TabBar />
      </MemoryRouter>
    </Provider>,
  );
}

function session(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    accessToken: "a",
    refreshToken: "r",
    userId: "u",
    username: "Dave",
    isAdmin: false,
    ...overrides,
  };
}

describe("TabBar", () => {
  it("shows the four player tabs and no admin tab", () => {
    renderWith(session());

    expect(screen.getByRole("link", { name: /Feed/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Board/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Admin/ })).not.toBeInTheDocument();
  });

  it("adds the admin tab for the admin", () => {
    renderWith(session({ username: "james", isAdmin: true }));

    expect(screen.getByRole("link", { name: /Admin/ })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("keeps the admin tab hidden when there is no session at all", () => {
    renderWith(null);

    expect(screen.queryByRole("link", { name: /Admin/ })).not.toBeInTheDocument();
  });

  it("widens the grid to fit the tabs it actually renders", () => {
    const { container: player } = renderWith(session());
    expect(container(player)).toHaveStyle({ "--tabbar-columns": "4" });

    const { container: admin } = renderWith(session({ isAdmin: true }));
    // A fifth tab in a grid hard-coded to four columns overflows the bar off
    // the side of the screen, which is invisible in a unit test and obvious on
    // a phone.
    expect(container(admin)).toHaveStyle({ "--tabbar-columns": "5" });
  });
});

function container(root: HTMLElement) {
  return root.querySelector(".tabbar") as HTMLElement;
}
