import { describe, it, expect, vi, afterEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import { basePath, resolveServerUrl } from "../basePath";
import { atwApi } from "../atwApi";

/**
 * These tests exist because the first production deploy 404'd every single API
 * call, and the whole suite — unit and e2e — was green over it.
 *
 * The app is served at balenthiran.co.uk/birthday/. `baseUrl: "/"` in
 * emptyApi.ts made the client request balenthiran.co.uk/api/... — the site
 * root, which is the portfolio. Nothing caught it because the e2e mocks match
 * `**\/api/game`, a glob that is satisfied by BOTH the right URL and the wrong
 * one, so the mock answered a request the real server never would.
 *
 * So the assertion here is deliberately on the FULL path of the request that
 * actually leaves the client, not on a helper's return value in isolation.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * Node's `Request` rejects a relative URL, and every URL this client builds is
 * relative — that is the entire subject of these tests. Resolving against a
 * throwaway origin keeps the real Request behaviour (headers, clone) while
 * letting the relative path through, so the assertions can read `.pathname`.
 */
function acceptRelativeUrls() {
  const NodeRequest = globalThis.Request;
  vi.stubGlobal(
    "Request",
    class extends NodeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) {
        super(
          typeof input === "string"
            ? new URL(input, "http://test.invalid").toString()
            : input,
          init,
        );
      }
    },
  );
}

describe("basePath", () => {
  it("is Vite's base, which is the subpath the app is deployed under", () => {
    // If this ever becomes "/" the deployment is broken, not the test.
    expect(basePath).toBe("/birthday/");
  });
});

describe("resolveServerUrl", () => {
  it("prefixes the deployment base onto a root-relative API path", () => {
    // This is the shape the backend returns for a private bucket.
    expect(resolveServerUrl("/api/photos/abc123")).toBe(
      "/birthday/api/photos/abc123",
    );
  });

  it("does not double the slash when the path has none", () => {
    expect(resolveServerUrl("api/photos/abc123")).toBe(
      "/birthday/api/photos/abc123",
    );
  });

  it("passes an absolute bucket URL straight through", () => {
    // PhotoStorage__PublicBaseUrl configured: prefixing would destroy it.
    const bucket = "https://objectstorage.uk-london-1.example.com/x/abc123";
    expect(resolveServerUrl(bucket)).toBe(bucket);
  });

  it("passes a protocol-relative URL straight through", () => {
    expect(resolveServerUrl("//cdn.example.com/abc123")).toBe(
      "//cdn.example.com/abc123",
    );
  });

  it("leaves an empty value alone rather than returning the base path", () => {
    // A post with no photo must stay falsy so PostCard renders the placeholder
    // instead of an <img> pointed at the app itself.
    expect(resolveServerUrl("")).toBe("");
  });
});

describe("the URL an API call actually requests", () => {
  /** Drives the real store + real baseQuery, capturing what fetch is handed. */
  async function urlRequestedBy(
    dispatch: (store: ReturnType<typeof makeStore>) => Promise<unknown>,
  ): Promise<string> {
    const seen: string[] = [];
    acceptRelativeUrls();
    vi.stubGlobal("fetch", (request: Request) => {
      seen.push(new URL(request.url).pathname);
      return Promise.resolve(
        new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    const store = makeStore();
    await dispatch(store);
    return seen[0];
  }

  function makeStore() {
    return configureStore({
      reducer: { [atwApi.reducerPath]: atwApi.reducer },
      middleware: (getDefault) => getDefault().concat(atwApi.middleware),
    });
  }

  it("sends join to /birthday/api/auth/join, not /api/auth/join", async () => {
    const url = await urlRequestedBy((store) =>
      store.dispatch(
        atwApi.endpoints.join.initiate({
          joinRequest: { partyCode: "260802", username: "james" },
        }),
      ),
    );

    expect(url).toBe("/birthday/api/auth/join");
  });

  it("sends the game state query under the base path too", async () => {
    const url = await urlRequestedBy((store) =>
      store.dispatch(atwApi.endpoints.getGameState.initiate()),
    );

    expect(url).toBe("/birthday/api/game");
  });
});
