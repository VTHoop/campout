# Design

**Everything in this file is proposed, not settled.** It is the current best guess at how Campout looks, drawn before any UI existed. Expect to change it while the MVP is built — that is the intent, not a failure. Nothing here outranks a product rule in [AGENTS.md](../AGENTS.md) §2; where they disagree, AGENTS.md wins and this file is wrong.

Artboards: <https://claude.ai/artifact/AEidqSDU9ixBcwpaVYJY8F> — **humans only.** An agent cannot open a claude.ai artifact, which is the whole reason this file exists. If you change the design, change it here too or the next agent will not see it.

## Status

| Area | State |
|---|---|
| Color, type, spacing | Proposed. Iterate freely. |
| Session card anatomy | Layout proposed. The **field rules** are not — they come from AGENTS.md §2 and `docs/data/camp-record-spec.md`. |
| Filters and sort | Proposed, except the sort options, which are a product rule. |
| State signals | Proposed shapes; the **rule** that state is never colour alone is from AGENTS.md §2. |
| Navigation and information architecture | **Built from the artboards, iterating (CAM-29).** Summer and Days off tabs; Home and Find camps not yet. See *Navigation* below. |
| Dark mode | Not drawn. `globals.css` already declares `color-scheme: light dark`. |

**The values live in [`src/app/globals.css`](../src/app/globals.css) — its `@theme` block is the source of truth.** This file keeps the reasoning and the patterns: what each token is for and why. Two copies of a hex code is one too many, so the tables below name tokens, not values. Change a value there; change its reasoning here.

`globals.css` has three layers: the Campout tokens in `@theme`, the shadcn/ui variable contract (`--background`, `--primary`, …) aliased onto them in `:root`, and an `@theme inline` block exposing those aliases as utilities. A dark palette, when drawn, is one block overriding the colour tokens; the aliases follow.

## The idea

**The summer chart.** The reference is the paper of a Richmond school year: the district calendar PDF, the rec-centre schedule on the wall. Ruled lines are structure, not decoration. Shadows are avoided; a 1px rule does the work.

**The date leads every card**, where other camp directories lead with a photo. Three reasons, and they compound: parents shop by week, it is the same unit as the planner grid, and we have no photos — a stock one would imply an endorsement AGENTS.md §2 forbids.

## Colour

Each token is a Tailwind colour: `bg-paper`, `text-ink`, `border-rule`.

| Token | Use |
|---|---|
| `paper` | Page ground. Cool chalk, deliberately not cream. |
| `surface` | Card and panel face. |
| `tint` | Date-block body, inline info panels. |
| `ink` | Text, headings, date-block tab. The near-black. |
| `ink-muted` | Meta, captions, help text. |
| `rule` | Every border and divider. |
| `blueprint` | Links and the primary action. |
| `marigold` | Attention fill. **Never text** — 1.9:1 on paper. |
| `marigold-wash` | Background of an attention panel, with `ink` text on it. |
| `marigold-hatch` | Ground beneath the `marigold` hatch of an uncovered day. A fill, never text. |
| `brick` | Conflict state only. Never brand, never decoration. |

The shadcn names alias these: `background` → `paper`, `foreground` → `ink`, `card` → `surface`, `border` and `input` → `rule`, `ring` and `primary` → `blueprint` (with `surface` text), `muted` → `tint`, `muted-foreground` → `ink-muted`, `destructive` → `brick`. Use the Campout name in our own markup; the aliases exist so shadcn components render right.

Contrast, WCAG, measured at the current values: `ink` on `paper` 12.4:1, `blueprint` on `paper` 6.5:1, `ink-muted` on `paper` 5.5:1 (5.1:1 on `tint`), `brick` on `surface` 6.6:1, `surface` on `blueprint` 7.4:1. `ink` on `marigold` is 6.4:1, which is why marigold is a fill you put ink on rather than a colour you set text in. **Change a colour, re-measure every pair it appears in** — every text pair must stay at or above 4.5:1.

### Category hues

Tokens `category-sports` … `category-faith-based`. Six hues at one darkness so none looks more important than another. They appear as a **9px dot beside the category word** — never as a filled badge, which would read as a mark of approval (AGENTS.md §2). The label text stays `ink-muted`; only the dot carries hue.

## Type

Two families, both from Google Fonts, self-hosted through `next/font/google` in `src/app/layout.tsx` (no `<link>` to Google). `font-display` is Bricolage; `font-sans` is Instrument Sans and the page default.

- **Bricolage Grotesque** — display. Weights 600/700, letter-spacing `-0.015em` to `-0.03em` as size grows.
- **Instrument Sans** — everything a parent reads twice. Weights 400/500/600.

Each role is a `text-*` token carrying size, line-height and default weight: `text-display`, `text-heading`, `text-title` (camp name), `text-body`, `text-ui` (UI and data, 500 by default; step to 600 with `font-semibold`), `text-caption`. The two display roles also carry their letter-spacing.

**Every date, price, age range and distance uses the `tabular-nums` utility.** Columns of data that do not line up look broken.

## Space, radius, rule

Spacing is a 4px step, and the scale is `4 8 12 16 24 32 48 64` — Tailwind steps `1 2 3 4 6 8 12 16`. Reach for those and not the steps between. **Touch targets are 44px minimum** (`min-h-touch`) — this is used one-handed at 9pm.

Radius says what a thing is: `rounded-none` week tab and grid cell · `rounded-control` chip, pill, control · `rounded-card` card and panel · `rounded-full` category dot.

Rules carry weight instead of shadows: a hairline `rule` separates (`border border-rule`), a section rule in `ink` divides a section (`border-2 border-ink`). The widths are Tailwind's own `border` and `border-2`; there is no third.

## The session card

A horizontal card: `rounded-card`, a hairline `rule` border, `surface` on `paper`. Two parts.

Some sizes below — 13px, the date block's 10–12px and 20–27px, its 112px/78px column — fall between steps of the scales above and have no token yet. They are the proposal, not values to hard-code: the card ticket maps each onto an existing token or adds one to `globals.css`.

**The date block** — a fixed-width left column (112px desktop, 78px phone) with its own right border.

- Top strip: `ink` background, `paper` text, 11–12px/600. It carries **why school is closed** — `Week 3` in summer, `Yom Kippur` or `Teacher day` or `Thanksgiving` the rest of the year. One component for every kind of time off (ADR-0013).
- Body: `tint` background, centred. Month in 11–12px `ink-muted`, then the day or range in Bricolage 20–27px/700 tabular, then the weekday span in 10–11px `ink-muted`.
- A partial span (`Mon–Wed`, `Mon–Thu`) sets the weekday line in `brick` at 600. It is the first hint that a week is not fully covered.

**The body**, in this order:

1. Camp name — `text-title`. Provider and location beneath in 13px `ink-muted`.
2. Hairline `rule`.
3. Facts row, `text-ui` at 600, `tabular-nums`, wrapping: hours · ages · price · distance. Distance sets `ink-muted` weight 500 — it is ours, not the camp's.
4. Category: dot plus word, 13px `ink-muted`.
5. Attention panel, only when there is something to say (see below).
6. Actions.
7. Hairline `rule`.
8. Provenance: `text-caption` in `ink-muted`, `Verified Sep 3, 2026 by PH, from …` plus a **See what we read** link.

### Rules the card must keep

- **A missing fact is stated, not hidden.** `Hours not stated` / `Price not stated` in italic `ink-muted`. Blank reads as free, or as all day. This mirrors the optional fields on `Session`.
- **`Add to plan` is the primary button** (filled `blueprint`). Registration is a secondary outlined link, labelled `Register on the camp's site`, or `Call 804-378-1616` where there is no URL. Campout never takes a payment, so it must never look like it could.
- **Nothing on the card ranks a camp.** No stars, no scores, no "popular", no "top pick". The card says what the camp told us and the day we checked.
- The provenance line is permanent, not a tooltip. A parent who shows up to a camp that moved has lost a workday.

## State signals

Every state is **a fill, a glyph and a word.** Remove the colour and it still reads (AGENTS.md §2).

| State | Fill | Glyph |
|---|---|---|
| Covered | `category-outdoors` green, solid | check |
| Covered by family | `surface`, 2px `category-outdoors` border | none — the word carries it |
| No coverage | 45° hatch, `marigold` on `marigold-hatch` | dash |
| Overlap | `brick` solid | cross |
| Ends early | `surface`, 2px `ink` border | clock |

*Covered* borrows `category-outdoors` rather than restating its value; if the coverage grid wants the two to diverge, it adds a state token then.

An inline attention panel is `marigold-wash` with a hairline `marigold` border, an icon and one sentence of `ink` in `text-caption`. Use it for a real consequence — *"Runs Monday to Thursday. Friday is still uncovered for Nora."* — never for decoration.

## Filters

- **The week picker is the signature control**: a strip of small tiles, one per week, each showing the week number over its Monday. Selected is `ink` fill with `paper` text; unselected is white with a `rule` border. It is a small copy of the planner grid, so a parent learns the grid before opening it. Six-column grid on desktop, horizontally scrolling row on phone.
- Every filter **states its unit in the label** — "Within 10 miles", "Up to $450" — so nobody guesses whether 10 means miles or minutes.
- **Counts sit beside each category and go to zero** rather than disappearing. A filter that vanishes looks like a bug.
- Selected state is a fill **plus** `aria-pressed`, never colour alone.
- Sort offers **distance, start date, price. Nothing else** — Campout does not rank, so there is nothing else to sort by (AGENTS.md §2).
- Applied filters appear as removable chips with an `aria-label`led dismiss button, plus `Clear all`.

## Copy

- Sentence case everywhere. No ALL-CAPS labels, no tracked-out eyebrows.
- A button says what happens: `Add to plan`, `Register on the camp's site`. Never `Submit`.
- An action keeps its name through the flow. `Add to plan` produces "In Nora's plan".
- Empty states give a direction, not a mood: *"Week 5 is the Fourth of July, and most Richmond camps take it off."* followed by the fastest thing to try.
- Never imply vetting, safety screening, endorsement or quality. `Verified Sep 3, 2026` means we checked these facts were accurate that day, and the UI says it in those terms.

## Layout

**Mobile first — the phone is the hard case, at ~390px.** Page gutter 16px, cards full width.

Desktop directory is three columns: a 272px filter rail, a ~552px list column, and the map filling the rest. Both side columns have a hairline `rule` border. The week strip is a full-width band beneath the header.

Accessibility is not a pass at the end. Real `<button>`, `<a href>`, `<input>` + `<label>`, `<fieldset>`/`<legend>` for filter groups, `aria-label` on every icon-only control, visible keyboard focus, and no interactive `div`s.

## Navigation

The artboards are the anchor; we build from them and change course as we learn. Current nav (`src/components/site-nav.tsx`), rendered by the root layout on every page, including the 404 page:

- An `ink` bar holding the `Campout` wordmark (Bricolage, `paper`, links to `/summer`) and two tabs: **Summer** (`/summer`) and **Days off** (`/days-off`). `/` redirects to `/summer` with a temporary redirect, since Home will claim it.
- **Below `lg`:** wordmark on its own row, the tabs beneath as two full-width buttons at least `min-h-touch` tall. Current is a `paper` fill with `ink` text; the other is `rule` text, outlined in `ink-muted`.
- **From `lg`:** one bar, the tabs inline after the wordmark. Current is underlined in `paper`. `lg` rather than `md` for now, so tablets get the phone layout; that may move.
- On the `ink` bar, text is `paper` (12.4:1) or, for an inactive tab, `rule` (8.8:1). `rule` is otherwise the border colour; it is set as text only here, where the prototype's muted label needs a light tone that isn't full `paper`. The `ink-muted` outline is 2.2:1: it's decoration, and the label identifies the tab.
- The current tab carries `aria-current="page"`. Focus is a `paper` outline, because the `ring` token (`blueprint`) disappears on `ink`.
- Not yet built: the Home control (household and ZIP) at the right of the desktop bar, and Find camps.

## Undecided

- **Dark mode.** Every token needs a counterpart. Not drawn.
- **Photography.** There is none, and the card is built to not need any.
- **The palette and the typefaces themselves.** Proposed, and expected to move while the MVP is built.
