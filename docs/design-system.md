# Iris — the design system

**Indigo light through dark glass.** Iris is the visual language of this
template's frontend: glass surfaces floating on a near-black night backdrop,
one indigo→violet beam of accent colour, and calm, legible type. Named for
the flower (indigo-violet), the iris of an eye behind glass, and the goddess
who crosses between night and day — the system ships both themes, dark first.

Live showcase: run `npm run dev` in `frontend/` and open **`/design`**.
Tokens live in `frontend/src/styles/tokens.css`; primitives in
`frontend/src/components/ui/`.

## Principles

1. **Glass over paint** — surfaces are translucent panes (`--bg-card` +
   backdrop blur + hairline border), never opaque slabs. Depth comes from
   layering, not heavy shadows.
2. **One beam of colour** — indigo→violet (`--gradient-accent`) is the only
   saturated voice, reserved for the primary action and identity moments.
   Everything else is neutral glass; status colours whisper as soft tints.
3. **Night-first** — designed on the dark theme, verified on light. Every
   themed token has both values; nothing may look "inverted-as-an-afterthought".
4. **Calm motion** — small, fast, eased. 150ms for state changes, 300ms for
   lifts, spring easing only for delight moments. Reduced-motion is respected
   globally.
5. **Legible always** — Inter for reading, Outfit for display. Text roles
   (`primary/secondary/muted`) must keep contrast in both themes; focus is
   always visible via `--focus-ring`.

## Tokens (`frontend/src/styles/tokens.css`)

Dark values are the `:root` default; `[data-theme='light']` overrides.
Components reference roles, never raw values.

| Scale | Tokens | Use when |
|---|---|---|
| Accent | `--accent-primary`, `--accent-secondary`, `--accent-hover`, `--accent-fg`, `--accent-soft`, `--accent-border`, `--accent-contrast`, `--gradient-accent` | The one saturated voice. `-fg` for accent-coloured text, `-soft` for tinted fills, `-contrast` for text on solid accent. |
| Surfaces | `--bg-page`, `--bg-card`, `--glass-hover-bg`, `--gradient-opacity` | Page backdrop, glass panes, raised/hover glass. |
| Text | `--text-primary`, `--text-secondary`, `--text-muted` | Headlines/body · supporting copy · placeholders/hints. |
| Borders | `--glass-border`, `--border-strong` | Hairlines on glass; stronger for hovered inputs. |
| Status | `--success`, `--warning`, `--danger` (+ `-soft` tints), `--danger-solid`, `--danger-solid-hover` | Foreground tone + tinted fill per role; `-solid` only for destructive buttons. |
| Focus | `--focus-ring` | 2px outline, offset 2 — applied globally via `:focus-visible`. |
| Type | `--text-xs…display` (8 sizes), `--weight-*`, `--leading-*`, `--tracking-display`, `--font-main`, `--font-display` | Sizes are a ~1.25 ratio; top two are fluid clamps. Display font only for h1–h4-level moments. |
| Spacing | `--space-1…10` (4→128px, 4px grid) | All padding/gaps. Never invent an in-between px value. |
| Radius | `--radius-sm/md/lg/xl/pill` (8/12/16/24/999) | Inputs `md`, tiles `lg`, cards/nav `xl`, buttons/badges `pill`. |
| Elevation | `--shadow-1/2/3`, `--shadow-glow` | Resting · hover lift · overlays · accent glow (primary CTA hover only). |
| Glass | `--blur-glass` (12px), `--blur-glass-heavy` (20px) | Card blur; heavy for fixed nav. |
| Motion | `--duration-fast/base/slow`, `--ease-standard`, `--ease-spring`, `--theme-transition` | State changes · lifts · theme cross-fade. |

## Primitives (`frontend/src/components/ui/`)

Import from the barrel: `import { Button, Card, Badge, Input } from './components/ui'`.

### Button
`variant`: `primary | secondary | ghost | danger` · `size`: `sm | md | lg` ·
`loading` (spinner + disables + `aria-busy`) · `disabled` · all native button
props. Primary = the gradient beam (one per view, ideally); secondary = glass;
ghost = quiet inline actions; danger = destructive only.

### Card
`Card` (`hover` prop enables lift) + optional `CardHeader` / `CardBody` /
`CardFooter` with hairline separators. Use `hover` only when the whole card is
clickable/interactive.

### Badge
`variant`: `neutral | accent | success | warning | danger`. Soft tint + role
colour text. Status at a glance — not buttons, not links.

### Input
`label` (required — always visible), `helperText`, `error` (string; switches
the field to the danger role, sets `aria-invalid`, announces via `role="alert"`),
plus all native input props. Helper/error text is wired with `aria-describedby`.

## Do / Don't

- **Do** build new surfaces from `Card`/`.glass` — **don't** hand-roll
  `rgba()` backgrounds or hex colours in components.
- **Do** use one primary button per view — **don't** put two gradient beams
  side by side.
- **Do** check both themes before shipping — the navbar toggle flips
  everything live.
- **Don't** remove focus outlines; if a control needs a custom ring, build it
  from `--focus-ring` / `--accent-soft` like `Input` does.
- **Don't** introduce new spacing/radius/duration values — extend the token
  scales instead if genuinely needed.
