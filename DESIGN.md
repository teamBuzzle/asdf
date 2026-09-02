# Design System: asdf

> Character direction is **assumed** from the product domain, not from an
> interview — confirm before shipping anything public. Every token below is
> extracted from `src/index.css` and the components already in the repository;
> none are invented.

Character: quiet instrumentation. A window you leave open for hours while agents
work, glanced at rather than read. It should never compete with the code and
diffs it is showing you.

## Color

The palette is the shadcn `base-nova` preset on the `neutral` base color, and
it is **achromatic on purpose**: every token is `oklch(L 0 0)` — zero chroma —
except `--destructive`. The only saturated colour in the entire product is the
one that means "this destroys something".

| Token | Light | Dark | Why |
|---|---|---|---|
| `--background` / `--foreground` | `oklch(1 0 0)` / `oklch(0.145 0 0)` | `oklch(0.145 0 0)` / `oklch(0.985 0 0)` | Pure neutral. Terminal output and syntax highlighting supply the colour; the chrome must not tint them. |
| `--muted-foreground` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | Secondary text. Status lines, paths, timestamps. |
| `--border` | `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)` | Separation is done with hairlines, not shadows. |
| `--primary` | `oklch(0.205 0 0)` | `oklch(0.985 0 0)` | Near-black in light, near-white in dark. The primary button is a value contrast, not a hue. |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | The single chromatic token. |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.556 0 0)` | Focus. Never removed. |

**Rules.**

- There is no brand hue. Do not introduce one for a single screen — that is
  exactly the drift this file exists to prevent.
- Emphasis comes from **lightness and weight**, not colour.
- `--destructive` is semantic. It marks destruction, never "important" and never
  decoration.
- A status that needs colour (an agent failed, an update is ready) is an
  **extension**: propose it here first, with its `oklch` value and its reason.
  As of today the system has no success or warning token, and nothing has needed
  one yet.

Both themes are defined. `.dark` is a real block in `src/index.css`, so any new
surface must be checked in both.

## Typography

- Family: **Geist Variable**, one family for everything. `--font-heading` is
  aliased to `--font-sans` deliberately: a second display face would add
  personality to a tool whose job is to disappear.
- Monospace is not tokenised yet. Paths and command output currently use the
  sans stack. When a terminal lands, add `--font-mono` here first.
- Scale in use: `text-2xl` (page title) · `text-sm` (body and controls) ·
  `text-xs` (recent lists, metadata). Contrast lives between title and body;
  everything below the title is one of two sizes.
- Weight: `font-medium` for section headings. Bold is not used. In an
  achromatic system weight is scarce — spend it rarely or hierarchy collapses.

## Spacing

- Base unit 4px, Tailwind's default scale.
- In use: `gap-1` `gap-2` `gap-3` `gap-6`, `p-3` `p-8`.
- Rhythm: **tight inside a group, generous between groups.** A control and its
  status line are `gap-2`; two unrelated panels are `gap-6`. Do not reach for
  values between these — the small set is the point.

## Shape and elevation

- `--radius: 0.625rem` (10px), with the shadcn ladder derived from it:
  `--radius-sm` 6px · `--radius-md` 8px · `--radius-lg` 10px.
- **Separation language: borders.** `rounded-md border` is the container idiom.
  Shadows are reserved for genuinely floating layers — dialogs, popovers,
  dropdowns — where they signal "above the page", not "emphasised".

## Motion

- `duration-100` with the Tailwind default easing, as used by `dialog` and
  `dropdown-menu`. Nothing in the chrome animates longer than 100ms.
- Progress bars use `transition-all` so a determinate bar advances smoothly.
- No entrance animation on anything that appears while the user is working. A
  panel that slides in pulls the eye away from a running agent.

## Components

Everything in `src/components/ui/**` comes from the shadcn CLI. Treat it as
vendor code: wrap it, do not edit it.

- **Button** — `default` (primary, filled `--primary`) · `outline` · `secondary`
  · `ghost` · `destructive` · `link`. One `default` button per surface. If a
  screen seems to need two primaries, one of them is `outline`.
- **Input** — full width inside its row, `transition-colors` on focus, always
  paired with a label or an `aria-label`.
- **Dialog** — for a decision the user must resolve before continuing. Not for
  information they can act on later.
- **Progress** — determinate only. If the length is unknown, use text, not a
  fake bar.

## Voice

- Tone: plain and factual. State what happened and what the user can do. No
  exclamation marks, no apologising, no "Oops".
- Buttons are verbs: `Open`, `Install and restart`. Never `OK`, never `Submit`.
- Sentence case everywhere, including buttons and headings.
- Never write user-facing text in a component. Add the key to
  `src/app/locales/en.json` and translate it across all seven locales;
  `pnpm check:locales` fails if one drifts.
