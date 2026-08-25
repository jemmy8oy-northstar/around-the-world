# The design system, as this app wears it

**This app does not have its own design system any more.** It wears the org's
one — [`jemmy8oy-northstar/design-system`](https://github.com/jemmy8oy-northstar/design-system),
`casual` theme, light by default: warm off-white paper, coral primary, teal for
positive, sand-tinted neutrals, and depth from soft shadows.

The token layer is **vendored verbatim** into
`frontend/src/styles/design-system/` (pinned to `design-system@aa178dd`, all
seven files byte-identical). It is vendored rather than installed because the
package publishes `dist/` and is not on a registry the app can `npm i` from —
the same constraint snip-it hit. **Do not hand-edit anything in that
directory**: re-copy it from upstream and re-check the hashes, or the copy
stops being diffable and becomes undocumented drift.

`frontend/src/styles/tokens.css` is **the mapping**, not a palette. It binds
the design system's role contract (`--color-primary`, `--color-surface`, …) to
the variable names ~700 lines of this app's component CSS already use
(`--accent-primary`, `--bg-card`, …). That indirection is why a whole-app
retheme touched no layout rule.

> **Two looks were rejected before this one, both as "vibe coded".** *Iris* was
> indigo→violet glass on near-black — the palette every generated app ships
> with. *Night Flight* was brass on ink navy: a different palette, but still a
> dark page, still a gradient, still translucent cards. **The common factor was
> never the hue.** So the fix was not a third palette; it was adopting the
> system that already existed.

## Principles

1. **No gradients. No glass. No glow.** These are not discouraged, they are
   **absent**: `--gradient-accent`, `--gradient-opacity`, `--blur-glass`,
   `--blur-glass-heavy` and `--shadow-glow` were deleted rather than
   re-pointed, and the `body::before` ambient wash is gone. If you are about to
   add one back, that is the third time.
2. **One filled coral per screen** — a solid `--accent-primary` fill is the
   loudest thing available, so it is spent on exactly one element: the stop
   stub in the banner, or the single primary button on a form. Anything else
   that wants to be coral gets an outline or `--accent-fg`.
3. **Surfaces are solid.** A card is white on warm paper with a hairline and a
   soft shadow. Depth comes from elevation, not from blur.
4. **Photographs win** — a post is someone's photo of a pint, and the chrome
   around it is a mount. Nothing in a card may out-shout what is inside it.
5. **Light-first, and dark is one attribute.** `<html data-theme="casual">` in
   `index.html` is what activates the theme; adding `data-mode="dark"` flips the
   whole app to the system's dark mode. There is **no second palette in this
   repo** to keep in step — which is the point, because the previous file
   carried a hand-written light theme that nothing could ever reach, so half of
   it had rotted where no screenshot could show it.
6. **Calm motion** — the design system's durations and `--ease-out`.
   `--ease-spring` is the one local addition (the contract has no overshoot
   curve). Reduced-motion is respected globally.
7. **Measured, not eyeballed.** Every colour and metric decision in this file
   that could be measured, was — see below.

## What was measured, and why it is written down

These are the four numbers that decided how the mapping is written. Each one
was invisible to the whole test suite, and each was found by measuring rather
than by looking.

| Thing | Measurement | What it forced |
|---|---|---|
| Status text on its own tint | `--color-warning` on `--color-warning-subtle` = **1.75:1** (success 3.50, danger 3.07) | `--success/--warning/--danger` are darkened toward `--color-text` by a measured 75/55/75% → 5.06 / 4.21 / 4.47 |
| Accent-coloured text | `--color-primary` on the page = **2.60:1** | `--accent-fg` reaches `--coral-700` (4.56:1 on page, 4.45:1 on the tint) |
| Plus Jakarta Sans word-space | **2px at 12px**, where Nunito, DM Sans, Manrope and Inter are all 3px | `word-spacing: 0.08em` on `body` — "Another Guinness. No notes." rendered with the space after the stop closed up |
| Form-control typography | `getComputedStyle` on the country search box said **Arial** | `button, input, textarea, select { font-family/word-spacing/letter-spacing: inherit }` — the UA stylesheet resets all three |

The first two are **gaps in the role contract, not bugs in it**: the design
system gives a *fill* role and a *tint* role for each status, and no
"status text on its own tint" role — and no "primary text" role at all. They
are raised upstream rather than only patched here.

⚠️ **One measured failure is deliberately NOT fixed here.** `--color-on-primary`
(white) on `--color-primary` (coral 500) is **2.76:1** — that is the design
system's own primary button, rendered exactly as its showcase renders it.
Deviating would make this app not match the reference it was asked to follow,
and the brand's button colour is not this repo's decision. Raised upstream.

## Tokens (`frontend/src/styles/tokens.css`)

Components reference these roles, never a raw value and never a design-system
primitive directly.

| Scale | Tokens | Use when |
|---|---|---|
| Accent | `--accent-primary` (coral), `--accent-secondary` (teal), `--accent-hover`, `--accent-fg`, `--accent-soft`, `--accent-border`, `--accent-contrast` | The one saturated voice. `-fg` for accent-coloured **text**, `-soft` for tinted fills, `-contrast` for text on a solid accent fill. |
| Surfaces | `--bg-page`, `--bg-card`, `--glass-hover-bg` | Page · card · hover. `glass` in the name is a leftover; renaming it edits every component for no visual change. |
| Text | `--text-primary`, `--text-secondary`, `--text-muted` | Headlines/body · supporting copy · placeholders/hints. |
| Borders | `--glass-border`, `--border-strong` | Hairlines; stronger for hovered inputs. |
| Status | `--success`, `--warning`, `--danger` (+ `-soft` tints), `--danger-solid`, `--danger-solid-hover`, `--danger-contrast` | Foreground tone + tinted fill. `-solid` is the only *fill* of the three and is for destructive buttons, with `--danger-contrast` on top. |
| Map | `--map-land`, `--map-border` | The world map's continents and coastlines. Opaque mixes over `--color-bg`, so they survive a mode flip. |
| Focus | `--focus-ring`, `--focus-ring-width` | 2px outline offset 2 globally via `:focus-visible`; the width token is for custom in-field rings. |
| Type | `--text-xs…display`, `--weight-*`, `--leading-*`, `--tracking-display`, `--tracking-label`, `--font-main`, `--font-display` | `--font-display` is the design system's own token (Nunito); `--font-main` aliases `--font-ui` (Plus Jakarta Sans). `--tracking-label` is the uppercase micro-label tracking. |
| Spacing | `--space-1…10` (4→128px, 4px grid) | All padding/gaps. **Deliberately not the design system's `--space-*`** — both are 4px-based but index differently (ours 5 = 24px, theirs 20px), so aliasing them would silently resize every gap. |
| Radius | `--radius-sm/md/lg/xl` from the design system, `--radius-pill` aliasing `--radius-full` | Cards/buttons/inputs `md`; `sm` for stamps and stubs; `pill` only for round things. |
| Elevation | `--shadow-1/2/3` → the system's `sm/md/lg` | Resting · cards · overlays. |
| Motion | `--duration-fast/base/slow`, `--ease-standard`, `--ease-spring`, `--theme-transition` | State changes · lifts. |

### Swapping a font

`--font-main` is load-bearing at `--text-xs` (12px), where timestamps and
captions live. **Measure the word-space before you swap it** — see the table
above, and `frontend/tmp-shots/space.spec.ts` in the rotation PR for how
(two independent methods, because the canvas one quantises to whole pixels).

## Primitives (`frontend/src/components/ui/`)

`Button`, `Card`, `Badge`, `Input`, importable from the barrel.

⚠️ **Nothing in the app imports them.** Every page hand-rolls its own BEM
classes against the tokens instead, so `.admin__primary`, `.compose__submit`
and `.join__submit` each re-implement `.ui-button--primary`. They are fully
tokenised, so they rotated with everything else and are not *wrong* — they are
unused. The design system now publishes real `Button`/`Card`/`Badge`/`Input`
components, so the honest options are *adopt the upstream ones* or *delete
these*; both are decisions nobody has made. Do not assume the app renders them.

## Do / Don't

- **Do** reference role tokens — **don't** hand-roll `rgba()` or hex in
  components. The two literals in `PostCard.css` are deliberate and commented:
  they sit on a scrim over an unknown photograph, so they must *not* follow the
  theme. The `theme-color` literal in `index.html` is the third, and is
  unavoidable — that element is parsed before any stylesheet exists.
- **Do** keep one filled-coral element per screen.
- **Don't** paint `--accent-contrast` on anything that is not the accent. It sat
  on `--danger-solid` in two places and read correctly only because the accent
  happened to be indigo at the time. A token borrowed from another role is a bug
  waiting for the palette to move — and this palette has now moved twice.
- **Don't** remove focus outlines; build custom rings from `--focus-ring` /
  `--accent-soft` / `--focus-ring-width` like `Input` does.
- **Don't** introduce new spacing/radius/duration values — extend the scales.
- **Don't** edit `styles/design-system/**`. Re-vendor from upstream instead.
