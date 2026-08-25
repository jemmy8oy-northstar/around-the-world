# Night Flight — the design system

**Brass on ink, read at midnight.** Night Flight is the visual language of
this app's frontend. The night it describes is a trip around the world done one
pub at a time, and the things on screen are the things in a travel wallet —
a ticket stub, a route, a customs stamp, a wallet of photographs. So the
palette is a departure board seen after dark: deep ink navy, warm brass, and
the vermilion of an air-mail border.

Brass on ink is not decoration. It is the highest-legibility warm pairing
there is, which is why instrument panels and departure boards have used it for
a century — and this app is read on a phone, in a dark pub, by someone several
drinks into the evening.

Tokens live in `frontend/src/styles/tokens.css`; primitives in
`frontend/src/components/ui/`.

> **This replaced "Iris"** — indigo→violet glass on near-black, the palette
> every generated app ships with, which is what made the app read as
> vibe-coded. Only the *values* changed: the token names, the dark-default
> mechanism and every scale survived, which is exactly why re-pointing one file
> rotated the whole app.

## Principles

1. **Warm glass, not white glass** — surfaces are translucent panes
   (`--bg-card` + backdrop blur + hairline border), and the overlay is **cream,
   not white**. A white overlay over navy reads blue-grey and clinical; a warm
   one reads like lamplight. This is most of the difference between this system
   and its predecessor.
2. **One filled brass per screen** — solid `--gradient-accent` is the loudest
   thing available, so it is spent on exactly one element: the stop stub in the
   banner, or the single primary button on a form. Everything else that wants to
   be brass gets an outline or `--accent-fg` instead.
3. **Corners, not pills** — a boarding pass has corners. `--radius-md` is the
   default for cards, buttons and inputs; `--radius-pill` is reserved for
   genuinely round things (the stamp ring, the tab indicator). The 24px pill was
   the other half of the generated-app tell.
4. **Photographs win** — a post is someone's photo of a pint, and the chrome
   around it is a mount. Nothing in a card may out-shout what is inside it.
5. **Night-first** — designed on the dark theme. ⚠️ **Nothing in this app sets
   `data-theme`**, so the light theme is currently unreachable; its values are
   maintained and coherent, but they are not exercised by anything. Do not
   assume a light-mode change has been seen.
6. **Calm motion** — small, fast, eased. 150ms for state changes, 300ms for
   lifts, spring easing only for delight. Reduced-motion is respected globally.
7. **Legible always** — DM Sans for reading, Bricolage Grotesque for display.

## Tokens (`frontend/src/styles/tokens.css`)

Dark values are the `:root` default; `[data-theme='light']` overrides.
Components reference roles, never raw values.

| Scale | Tokens | Use when |
|---|---|---|
| Accent | `--accent-primary` (brass), `--accent-secondary` (vermilion), `--accent-hover`, `--accent-fg`, `--accent-soft`, `--accent-border`, `--accent-contrast`, `--gradient-accent` | The one saturated voice. `-fg` for accent-coloured text, `-soft` for tinted fills, `-contrast` for text on solid accent — **ink, not white**, because brass is a light colour. |
| Surfaces | `--bg-page`, `--bg-card`, `--glass-hover-bg`, `--gradient-opacity` | Page backdrop, glass panes, raised/hover glass. |
| Text | `--text-primary`, `--text-secondary`, `--text-muted` | Headlines/body · supporting copy · placeholders/hints. |
| Borders | `--glass-border`, `--border-strong` | Hairlines on glass; stronger for hovered inputs. |
| Status | `--success`, `--warning`, `--danger` (+ `-soft` tints), `--danger-solid`, `--danger-solid-hover`, `--danger-contrast` | Foreground tone + tinted fill per role; `-solid` only for destructive buttons, with `--danger-contrast` on top of it. |
| Focus | `--focus-ring`, `--focus-ring-width` | 2px outline offset 2 globally via `:focus-visible`; the width token is for custom in-field rings. |
| Type | `--text-xs…display` (8 sizes), `--weight-*`, `--leading-*`, `--tracking-display`, `--tracking-label`, `--font-main`, `--font-display` | Sizes are a ~1.25 ratio; top two are fluid clamps. `--tracking-label` is the uppercase micro-label tracking used by stop labels, section headings and field labels. |
| Spacing | `--space-1…10` (4→128px, 4px grid) | All padding/gaps. Never invent an in-between px value. |
| Radius | `--radius-sm/md/lg/xl/pill` (8/12/16/24/999) | Inputs, cards, buttons `md`; `sm` for stamps and stubs; `pill` only for round things. |
| Elevation | `--shadow-1/2/3`, `--shadow-glow` | Resting · cards · overlays · accent glow (primary CTA hover only). Tinted warm-black so cards lift off the navy rather than punching a hole in it. |
| Glass | `--blur-glass` (12px), `--blur-glass-heavy` (20px) | Card blur; heavy for fixed nav. |
| Motion | `--duration-fast/base/slow`, `--ease-standard`, `--ease-spring`, `--theme-transition` | State changes · lifts · theme cross-fade. |

### Choosing a body font

`--font-main` is load-bearing at `--text-xs` (12px), where timestamps and
captions live. **Measure the word-space before you swap it.** Manrope was the
first pick here and its space is 2px at 12px against DM Sans's and Inter's 3px,
so "Photo unavailable" rendered as "Photounavailable" — visible in a
screenshot, invisible to every test in the suite.

## Primitives (`frontend/src/components/ui/`)

`Button`, `Card`, `Badge`, `Input`, importable from the barrel.

⚠️ **Nothing in the app imports them.** Every page and component hand-rolls its
own markup and BEM classes against the tokens instead, so `.admin__primary`,
`.compose__submit` and `.join__submit` each re-implement `.ui-button--primary`.
They are fully tokenised, so they rotate with the rest of the system and are
not *wrong* — they are simply unused. Adopting them or deleting them is a real
decision and neither has been made; do not assume the app renders them.

## Do / Don't

- **Do** reference role tokens — **don't** hand-roll `rgba()` or hex in
  components. The two literals in `PostCard.css` are deliberate and commented:
  they sit on a scrim over an unknown photograph, so they must *not* follow the
  theme.
- **Do** keep one filled-brass element per screen — **don't** put two gradient
  beams side by side.
- **Don't** paint `--accent-contrast` on anything that is not the accent. It was
  on `--danger-solid` in two places, which read as white-on-crimson only
  because the accent happened to be indigo at the time.
- **Don't** remove focus outlines; build custom rings from `--focus-ring` /
  `--accent-soft` / `--focus-ring-width` like `Input` does.
- **Don't** introduce new spacing/radius/duration values — extend the token
  scales instead if genuinely needed.
