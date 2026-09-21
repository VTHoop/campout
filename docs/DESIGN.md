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
| Navigation and information architecture | **Undecided.** The artboards show a nav bar with Find camps / Summer / Days off. Nobody agreed to that. Do not build it, and do not treat it as a decision. |
| Dark mode | Not drawn. `globals.css` already declares `color-scheme: light dark`. |

**When the first UI ticket lands, the tokens below move into `src/app/globals.css` as a Tailwind v4 `@theme` block, and that becomes the source of truth.** This file then keeps the reasoning and the patterns, not the values. Two copies of a hex code is one too many.

## The idea

**The summer chart.** The reference is the paper of a Richmond school year: the district calendar PDF, the rec-centre schedule on the wall. Ruled lines are structure, not decoration. Shadows are avoided; a 1px rule does the work.

**The date leads every card**, where other camp directories lead with a photo. Three reasons, and they compound: parents shop by week, it is the same unit as the planner grid, and we have no photos — a stock one would imply an endorsement AGENTS.md §2 forbids.

## Colour

| Token | Value | Use |
|---|---|---|
| `paper` | `#EEF1F0` | Page ground. Cool chalk, deliberately not cream. |
| `surface` | `#FFFFFF` | Card and panel face. |
| `tint` | `#E4EAE9` | Date-block body, inline info panels. |
| `ink` | `#14302E` | Text, headings, date-block tab. The near-black. |
| `ink-muted` | `#4C6563` | Meta, captions, help text. |
| `rule` | `#C4CFCD` | Every border and divider. |
| `blueprint` | `#1D5B79` | Links and the primary action. |
| `marigold` | `#E3A324` | Attention fill. **Never text** — 2.1:1 on paper. |
| `marigold-wash` | `#FBF1DC` | Background of an attention panel, with `ink` text on it. |
| `brick` | `#A23B29` | Conflict state only. Never brand, never decoration. |

Contrast: `ink` on `paper` is ~12:1, `blueprint` on `paper` ~7:1, `ink-muted` on `paper` ~5.8:1. `ink` on `marigold` is ~8:1, which is why marigold is a fill you put ink on rather than a colour you set text in.

### Category hues

Six hues at one darkness so none looks more important than another. They appear as a **9px dot beside the category word** — never as a filled badge, which would read as a mark of approval (AGENTS.md §2). The label text stays `ink-muted`; only the dot carries hue.

`sports #1D5B79` · `stem #5A4B8C` · `arts #A93A68` · `outdoors #2C8778` · `academic #8C6310` · `faith-based #6B5648`

## Type

Two families, both from Google Fonts.

- **Bricolage Grotesque** — display. Weights 600/700, letter-spacing `-0.015em` to `-0.03em` as size grows.
- **Instrument Sans** — everything a parent reads twice. Weights 400/500/600.

| Role | Size / line-height | Weight |
|---|---|---|
| Display | 52 / 1.02 | 700 |
| Heading | 26 / 1.1 | 700 |
| Title (camp name) | 20 / 1.25 | 600 |
| Body | 15 / 1.55 | 400 |
| UI and data | 14 / 1.4 | 500–600 |
| Caption | 12 / 1.4 | 400 |

**Every date, price, age range and distance sets `font-variant-numeric: tabular-nums`.** Columns of data that do not line up look broken.

## Space, radius, rule

Spacing scale: `4 8 12 16 24 32 48 64`. **Touch targets are 44px minimum** — this is used one-handed at 9pm.

Radius says what a thing is: `0` week tab and grid cell · `6` chip, pill, control · `10` card and panel · `50%` category dot.

Rules carry weight instead of shadows: `1px rule` separates, `2px ink` divides a section.

## The session card

A horizontal card, `radius 10`, `1px rule` border, white on paper. Two parts.

**The date block** — a fixed-width left column (112px desktop, 78px phone) with its own right border.

- Top strip: `ink` background, `paper` text, 11–12px/600. It carries **why school is closed** — `Week 3` in summer, `Yom Kippur` or `Teacher day` or `Thanksgiving` the rest of the year. One component for every kind of time off (ADR-0013).
- Body: `tint` background, centred. Month in 11–12px `ink-muted`, then the day or range in Bricolage 20–27px/700 tabular, then the weekday span in 10–11px `ink-muted`.
- A partial span (`Mon–Wed`, `Mon–Thu`) sets the weekday line in `brick` at 600. It is the first hint that a week is not fully covered.

**The body**, in this order:

1. Camp name — Title. Provider and location beneath in 13px `ink-muted`.
2. `1px rule`.
3. Facts row, 14px/600 tabular, wrapping: hours · ages · price · distance. Distance sets `ink-muted` weight 500 — it is ours, not the camp's.
4. Category: dot plus word, 13px `ink-muted`.
5. Attention panel, only when there is something to say (see below).
6. Actions.
7. `1px rule`.
8. Provenance: 12px `ink-muted`, `Verified Sep 3, 2026 by PH, from …` plus a **See what we read** link.

### Rules the card must keep

- **A missing fact is stated, not hidden.** `Hours not stated` / `Price not stated` in italic `ink-muted`. Blank reads as free, or as all day. This mirrors the optional fields on `Session`.
- **`Add to plan` is the primary button** (filled `blueprint`). Registration is a secondary outlined link, labelled `Register on the camp's site`, or `Call 804-378-1616` where there is no URL. Campout never takes a payment, so it must never look like it could.
- **Nothing on the card ranks a camp.** No stars, no scores, no "popular", no "top pick". The card says what the camp told us and the day we checked.
- The provenance line is permanent, not a tooltip. A parent who shows up to a camp that moved has lost a workday.

## State signals

Every state is **a fill, a glyph and a word.** Remove the colour and it still reads (AGENTS.md §2).

| State | Fill | Glyph |
|---|---|---|
| Covered | `#2C8778` solid | check |
| Covered by family | white, 2px `#2C8778` border | none — the word carries it |
| No coverage | 45° hatch, `marigold` on `#F2CE83` | dash |
| Overlap | `brick` solid | cross |
| Ends early | white, 2px `ink` border | clock |

An inline attention panel is `marigold-wash` with a `1px marigold` border, an icon and one sentence of `ink` at 12px. Use it for a real consequence — *"Runs Monday to Thursday. Friday is still uncovered for Nora."* — never for decoration.

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

Desktop directory is three columns: a 272px filter rail, a ~552px list column, and the map filling the rest. Both side columns have a `1px rule` border. The week strip is a full-width band beneath the header.

Accessibility is not a pass at the end. Real `<button>`, `<a href>`, `<input>` + `<label>`, `<fieldset>`/`<legend>` for filter groups, `aria-label` on every icon-only control, visible keyboard focus, and no interactive `div`s.

## Undecided

- **Navigation and IA.** Deferred on purpose. The artboards show one; it is illustration, not a decision.
- **Dark mode.** Every token needs a counterpart. Not drawn.
- **Photography.** There is none, and the card is built to not need any.
- **The palette and the typefaces themselves.** Proposed, and expected to move while the MVP is built.
