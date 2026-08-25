**TL;DR** Postgres is back — re-checked from outside, 15/15 green, so step 1 is done. Both questions answered. I'm starting the UI rotation and the admin user now; nothing here needs a reply.

**Do this** (your original four, 1 now cleared):

1. ~~Get Postgres back~~ ✅ confirmed up 07:31Z
2. `kubectl exec -n data pg-postgresql-0 -- psql -U postgres -c "CREATE DATABASE around_the_world;"`
3. OCI bucket + S3 key → `around-the-world-secrets` in `balenthiran`
4. Approve [oke-fleet#6](https://github.com/jemmy8oy-northstar/oke-fleet/pull/6) — the click that deploys it

**Your questions**

1. **"Start a new round" does not disappear after go-live — no.** No mode check exists anywhere. It stays clickable all night behind a browser confirm, and it archives everyone's photos — one mis-tap in a pub. **I'm gating it** behind a deliberate danger-zone disclosure once Live. Say if you'd rather it vanish entirely.

2. **BST in, UTC stored — correct today.** Seed is `16:00Z`/`04:00Z` = **17:00 Fri → 05:00 Sat BST** ✓, and the admin box reads your phone's local time, so typing 17:00 means 17:00 BST.
   ⚠️ **But the page never shows the current values — both boxes start blank**, which I suspect is why you asked. Prefilling them, labelled BST.

<details>
<summary>Evidence for both answers</summary>

**Round gating.** `RoundService.StartNewRoundAsync` has no reference to `GameMode`, `ResolveMode` or `AllowsPosting` — it unconditionally closes the open round, creates a new one and repoints `GameSettings.ActiveRoundId`. The frontend matches: in `Admin.tsx` the "Start a new round" button has no `disabled` attribute and no conditional render, and `game.mode` is read only to print it as a status string. By contrast "Save cutovers" *is* disabled on empty input, so the absence is specific to this button rather than a general lack of guards.

**Timezones.** Mode is derived from the clock, never stored: `DomainGameState.ResolveMode` compares `utcNow` against `GoLiveAt`/`ReadOnlyAt`. `GameOptions` seeds them as `DateTimeKind.Utc` at 16:00 and 04:00 — the doc comments say 17:00/05:00 BST and, unusually for this codebase, the prose and the fact agree. The admin page sends `new Date(value).toISOString()`, and `datetime-local` yields a naive string that `Date` interprets in the browser's zone, so a UK phone converts BST→UTC correctly. The failure mode I checked for and did *not* find was a hand-appended `"Z"`, which would have been silently an hour out.

**The gap.** `GET /game` already returns `goLiveAt` and `readOnlyAt` in its payload, so the data is on the client already — `Admin.tsx` simply initialises both inputs to `useState("")` and never reads them back. So it is a display omission, not a missing endpoint, and cheap to close.
</details>
