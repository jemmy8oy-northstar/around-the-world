# Build log

A running record of how this build actually went — decisions that worked, ones
that didn't, friction hit along the way, and things worth changing in
`web-template` afterwards. Appended to as each slice lands, not reconstructed at
the end.

Format: newest entry at the bottom, so it reads chronologically.

---

## 2026-08-24 — Session 1 (Claude, interactive)

### Context

Project kicked off from a prior ChatGPT/Gemini design conversation. Deadline is
tight: the party code `260802` decodes as DD-MM-YY to **26 Aug 2026**, i.e. two
days out, even though the brief said "one week". Flagged to James, awaiting
confirmation; every timestamp was made admin-editable so a wrong guess costs a
tap rather than a redeploy.

### What went well

- **The template was genuinely ready.** `around-the-world` came pre-scaffolded
  with `AroundTheWorld.*` naming already applied and helm values already
  project-named. Zero rename work. This is the single biggest time saver and
  validates the `dotnet new` template investment.
- **Reference chain in the template made the layer rules obvious.**
  `IStatus → Status → DomainStatus → IStatusService → StatusService → StatusRoutes`
  is a complete worked example of the 7-project architecture. Writing the game
  equivalents was mechanical rather than interpretive.
- **`docs/specs/backend-srp.md` paid for itself immediately.** The auth slice
  decomposed cleanly into `PartyCodeValidator` / `UsernameClaimService` /
  `SessionIssuer` / `RefreshTokenRedeemer` under a thin `AuthService`
  orchestrator, because the doc already answered "how small is small".
- **Deriving game mode from timestamps instead of storing it** removed a
  Kubernetes `CronJob`, a scheduled-job library, and a redeploy from the design.
  Pure function of two instants → unit-testable with no host, then re-verified
  through the real HTTP pipeline with an injected clock.

### Friction / things that cost time

- **`gh repo view --json owner --jq .owner.login` returns the *org*
  (`jemmy8oy-northstar`), not a user.** `CLAUDE.md`'s mandatory notification
  rule tells Claude to assign that value — which fails, because an org can't be
  an assignee. Used `jemmy8oy` instead. **→ template fix needed.**
- **`dotnet ef migrations add` on macOS emits a literal `bin\Debug` directory**
  (Windows separator taken literally), which `.gitignore`'s `bin/` rule does not
  match, so build output nearly got committed. Added an explicit ignore rule.
  **→ worth adding to the template's `.gitignore`.**
- **Interface-typed properties on response models break OpenAPI codegen.** First
  cut of `IAuthSession` had a nested `IUser User`. That produces an empty schema
  in the OpenAPI document and an untyped field in the generated RTK Query
  client, and AutoMapper can't construct an interface either. Flattened to
  `UserId` + `Username`. **→ worth a line in `backend-architecture.md`: response
  DataModels must be flat or reference concrete DataModels, never interfaces.**
- **`Jwt:Secret` and the build-time OpenAPI generator conflict.** The generator
  boots the host outside the Development environment, so
  `appsettings.Development.json` never loads and a fail-fast on the missing
  signing key would break `dotnet build`. Resolved with a random ephemeral
  per-process key plus a loud warning — a misconfigured deploy logs everyone out
  on restart (visible) rather than signing with a known placeholder (silent and
  dangerous). **→ same class of problem as the existing DB connection-string
  warning; the template should document the pattern.**

### Template drift spotted (docs vs reality)

| Doc says | Reality |
|---|---|
| Frontend styling is SCSS with co-located `.scss` files | Everything is plain `.css` + `tokens.css` |
| Frontend tests are Vitest + RTL | Only Playwright is installed; no Vitest, no RTL |
| Route handlers are named static methods returning typed results | The shipped `StatusRoutes` uses an inline lambda and `Results.Ok` |

Followed the *rules* for new code rather than the shipped example.

### Decisions taken (see `docs/spec.md` §9 for the full table)

Country = the drink's origin, not GPS · reset = new round, never truncate ·
`d3-geo` directly rather than `react-simple-maps` · aggregated country badges
rather than per-post pins · client-side image resize · `FileSystemPhotoStorage`
fallback so local dev and CI need no OCI credentials.

### Status at end of entry

| Slice | Issue | PR | State |
|---|---|---|---|
| Spec + `/birthday` ingress | #1 | #11 | Raised |
| Schema, rounds, game state | #2 | #12 | Raised — 49 tests green |
| Auth | #3 | #13 | Raised — 73 tests green |
| Photo storage | #4 | #14 | Raised — 105 tests green |
| Posts, aggregation, admin | #5 | #15 | Raised — 142 tests green |
| Frontend (shell, feed, map, board, admin) | #6–#9 | #16 | Raised — 52 unit + 16 e2e green |
| Deployment config | #10 | #17 | Raised |

### Deployment findings

- **The template's subpath deployment does not work for the backend.** The
  ingress routes `/{app}/api` to the service *without* rewriting the prefix
  away, so ASP.NET — whose routes are `/api/...` — 404s on every request. The
  frontend half works because its nginx serves from a matching subdirectory;
  the backend half has no equivalent. Fixed with a configurable `PathBase`
  applied before routing. **This is the textbook "works on localhost, 404s in
  the cluster" failure and it would have bitten on the night. → template fix
  needed.**
- Consequently the frontend must call `/birthday/api/...`, not `/api/...`. The
  RTK base URL is now `import.meta.env.BASE_URL` and the Vite dev proxy strips
  the prefix, so dev and cluster agree.
- **The Helm chart could not express an empty-string env var.** `{{- if .value }}`
  tests truthiness, so `value: ""` (a legitimately unset optional endpoint)
  rendered as a name with no value at all. Changed to `hasKey`. **→ template fix
  needed.**
- Docs corrected in place, per the standing rule: the SCSS/Vitest claims, the
  `gh repo view --json owner` assignee rule (returns the org, which cannot be
  assigned), and the localhost port.

### Frontend findings

- **Screenshots caught three bugs that typechecking, unit tests and e2e all
  passed straight over.** Worth stating plainly, because it changes how to work:
  every one of these was a *rendered layout* problem, invisible to any assertion
  that was not a picture.
  1. The bottom tab bar rendered at **351px of a 390px viewport**. Cause: the
     template's `index.css` carries `nav { width: 90% !important }` inside a
     `max-width: 768px` media query, written for its own marketing Navbar — and
     it matched this app's `<nav>` tab bar. Element selectors plus `!important`
     in a global stylesheet do not survive a second component. Fixed by deleting
     the marketing CSS this project never used. **→ template fix needed.**
  2. Capping an `aspect-ratio` box with `max-height` makes it shrink its
     **width** to preserve the ratio, leaving a dead band down the side of every
     feed card. Replaced with an explicit height plus `object-fit: cover`.
  3. The composer's full-width 4:5 capture area pushed the country picker and
     the Post button below the fold — the core action of the whole app needed a
     scroll on every phone.
- **Diagnosing by probe beat guessing.** For each of the above I ran a scripted
  Playwright evaluation dumping bounding boxes and computed styles rather than
  squinting at the image. The tab-bar width in particular looked like a
  containing-block problem and was not.
- **The seeded test photos mattered.** The first screenshot pass used a
  336-byte 100×100 grey JPEG, which made the feed impossible to judge.
  Generating plausible portrait drink images made the real layout problems
  obvious immediately.
- **`FakeTimeProvider` refuses to move backwards**, so the test host takes its
  start instant as a constructor argument rather than being rewound.
- **The e2e suite runs on WebKit**, not Chromium — Playwright's iPhone 13
  descriptor defaults to it, which is right, because every guest on the night
  will be on mobile Safari.
- **Two OpenAPI contract fixes worth taking back to the template.** .NET 10
  describes `int32` as `["integer","string"]` by default (it will read a number
  from a JSON string), and that union propagates into every integer field of the
  generated TypeScript client. Setting `NumberHandling = Strict` plus
  `JsonStringEnumConverter` turned `GameMode` from a bare `number` into a
  `"Practice" | "Live" | "Finished"` union and every int into `number`.
- **The generated client cannot express multipart.** It hands its `body` object
  to `fetchBaseQuery`, which JSON-serialises it — the photo would have arrived
  as `{}`. The upload endpoint is hand-written in `customApi.ts`, which is what
  `.agents/rules/project.md` already prescribes for exactly this case.
- **Refresh needs a mutex.** Refresh tokens are single-use server-side, so a
  screen firing three queries at once on an expired token would burn three and
  log the user out. Fifteen lines, no dependency.

### Late findings (posts/admin slice)

- **A bespoke `IClock` was the wrong abstraction and the integration tests caught
  it.** Tokens were issued on the injected clock but validated by the JWT bearer
  handler on the *system* clock, so every authenticated request 401'd with the
  token "not yet valid". Replaced `IClock`/`SystemClock` with .NET's built-in
  `TimeProvider` (and `FakeTimeProvider` in tests) — one clock, shared by the app
  and the auth handler. **→ the template should use `TimeProvider`, not roll its
  own clock interface.**
- **Setting `JwtBearerOptions.TimeProvider` is not sufficient.** The token
  handler's lifetime check reads `DateTime.UtcNow` directly unless an explicit
  `LifetimeValidator` is supplied. This is a genuine trap and cost the most time
  in this slice.
- **`FakeTimeProvider` refuses to move backwards**, so the test host takes its
  start instant as a constructor argument rather than being rewound.
- First attempt at releasing a username mangled `UsernameNormalised` to free the
  unique index — which overflowed the 32-char column and would have shown up in
  admin lists. Replaced with a `ReleasedAt` column and a **filtered** unique
  index, so a released name is reclaimable while the user row (and their posts)
  survive.
