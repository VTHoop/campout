# 15. shadcn/ui components, restyled on Campout tokens

- Status: Accepted
- Date: 2026-09-25

## Context
AGENTS.md §2 and the stack table name shadcn/ui as the component layer and forbid raw form controls, but no component had been added until the week picker (CAM-30) needed buttons. Adding the first one brings four runtime dependencies and a `cn` helper, and decides how shadcn's defaults meet `docs/DESIGN.md`.

## Decision
- **Components are copied into `src/components/ui/`** in shadcn's usual way (`components.json` records the setup) and owned by us from then on.
- **Runtime dependencies:** `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot` — the ones shadcn's Button needs. Further Radix primitives are added per component, when a component needs one.
- **Restyled onto our tokens, not shadcn's palette.** No shadows (DESIGN.md: a 1px rule does the work), 44px targets via `min-h-touch`/`size-touch`, the `text-ui` role, and the variants we use. The shadcn variable names (`primary`, `ring`, …) are already aliased onto our palette in `globals.css`.
- **`cn` knows our type roles.** tailwind-merge reads an unknown `text-*` as a colour, so `text-ui` beside `text-ink` would be silently dropped. `src/lib/utils.ts` extends its `font-size` group with the `--text-*` token names; a new type role is added there too.
- **The `@/*` alias is declared in the root `tsconfig.json` and in Vitest**, because shadcn components import through it and Next reads aliases from the root config only.

## Consequences
- A shadcn component can be dropped in with the CLI or by hand, but it is not done until it is on our tokens: check it for shadows, sizes below `min-h-touch`, and colours outside the palette.
- Radix's own semantics come with its primitives. Where they conflict with an agreed accessibility contract (e.g. ToggleGroup's `role="radio"` against a picker specified with `aria-pressed`), the contract wins and we compose from Button instead.
