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
| Photo storage | #4 | — | Next |
