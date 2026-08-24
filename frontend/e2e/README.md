# Frontend e2e / screenshot tests (Playwright)

The scaffold ships with a small Playwright suite that runs the app off **mocked
API responses** (no backend required) and captures full-page **screenshots** for
visual review. This is the Northstar standard for frontend e2e — copy the shape
into new features and add routes to `mocks.ts` as the app grows.

## Layout

| File | Purpose |
|---|---|
| `../playwright.config.ts` | Config — boots the Vite dev server, targets Chromium. |
| `mocks.ts` | One place that fulfils every API call the app makes. Add a route here when the frontend starts calling a new endpoint. |
| `home.spec.ts` | Smoke asserts + screenshots for the home page (light + dark). |
| `screenshots/` | Generated PNGs land here. **Gitignored** — see below. |

## Run locally

```bash
cd frontend
npm install
npx playwright install chromium   # one-time: downloads the browser
npm run test:e2e                  # headless; starts the dev server for you
npm run test:e2e -- --ui          # interactive runner
```

Screenshots are written to `frontend/e2e/screenshots/`; `npx playwright
show-report` opens the HTML report after a run.

## Gotchas worth knowing before you copy this

**1. `baseURL` must carry Vite's `base`.** This scaffold sets
`base: '/around-the-world/'` in `vite.config.ts`. The dev server redirects a bare
`/` to that base, so the home page works either way — but any deeper route
(`/editor`, `/settings`) served from a `baseURL` without the base lands on
Vite's *"the server is configured with a public base URL"* hint page, and your
assertions then run against the wrong document. Keep `baseURL` in
`playwright.config.ts` in sync with `base`, and navigate with **relative**
paths (`page.goto('./settings')`) — a leading slash discards the base again.

**2. Screenshot after a theme toggle needs `animations: 'disabled'`.** The
theme change is a 0.4s CSS transition, so a capture taken straight after the
click freezes a half-faded frame and dark mode looks broken when it isn't.
`animations: 'disabled'` fast-forwards finite transitions to completion.

**3. If the app also has vitest**, exclude `e2e/**` from it — otherwise vitest
collects the Playwright specs and `npm run test` fails with *"Playwright Test
did not expect test.beforeEach() to be called here"*.

## The screenshots are not committed, and they assert nothing

`page.screenshot()` is a plain **write**, not a comparison. There is no
`toHaveScreenshot` here, so **no screenshot can ever fail a build** — they exist
to be looked at. `frontend/e2e/screenshots/` is gitignored, and generated repos
inherit that.

James's call on snip-it#15: *"get rid of the committed pngs I think it wastes
git storage."* Committing them cost 4.7 MB across three repos and bought
nothing, because each e2e run rewrites them and nothing ever reads them.

## Reviewing them on a PR

`ci.yml`'s `e2e` job uploads `playwright-report/` and only `if: failure()`, so a
green run publishes nothing to look at. To get the screenshots per-PR, add this
step to that job:

```yaml
      - name: Upload e2e screenshots
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-screenshots
          path: frontend/e2e/screenshots/
          retention-days: 7
```

<!-- Corrections, 2026-08-15: this section previously described a
     frontend-e2e.yml workflow that was never added — ci.yml has the e2e job
     instead. That stale text was copied into every generated repo. -->

## If you want an actual UI-drift check

Nothing in this org has one. `page.screenshot()` cannot fail; only
`expect(page).toHaveScreenshot()` compares against a committed baseline. That
*would* be a reason to commit PNGs — a small number of deliberate baselines,
which is a different thing from dumping every render into git.
