# 16. Plans are the tabs; finding a camp is its own destination

- Status: Accepted
- Date: 2026-09-28

## Context
The nav had two tabs, **Summer** and **Days off** (CAM-29), and they had drifted into doing different jobs. `/summer` was built from the desktop artboard (Design Foundation p.8), which puts the camp finder on the Summer page: a week strip over session cards and a map. Days off, as drawn (p.7), is a plan: a dated list of closures, each saying who is covered and offering "Find a camp day". So one tab searched and the other planned, and a parent had no clear path from a day off to a camp for it.

The phone artboards already separated the two. The summer plan (p.5) is the kids × weeks grid, and each gap links to a search screen (p.6) headed "Filling week 3 for Nora", with a back link to the plan. Days off (p.7) works the same way.

Both horizons ask the same question: is this day covered, and by whom? (`docs/CONTEXT.md`). The grid is the differentiator and the directory is table stakes, and they serve different people. The directory has to work for a parent with no household yet, arriving from a search engine. The plans need a household.

## Decision
- **The tabs are Summer, Days off and Find camps.** Summer (`/summer`) and Days off (`/days-off`) are the family's plans, each in the shape that suits it: a grid for the contiguous summer, a dated list for the scattered days off. Find camps (`/camps`) is the camp finder.
- **"When" is a filter on the finder, not a page.** It is one control over the closures of a school year (ADR-0013), so a summer week and a single day off are chosen the same way. For a signed-in household it shows each option's coverage.
- **A plan's gap opens the finder with that gap already set** (`/camps?week=3&child=…`), and the finder says which gap it is filling. From the Find camps tab the same page opens with no filters set, and "Add to plan" asks which child and which day.
- **The finder moved from `/summer` to `/camps` (CAM-35).** Links made for it (`/summer?summer=` and `/summer?week=`) are sent on with a temporary redirect, not a permanent one: browsers cache a permanent redirect, and the plan may give those parameters a meaning of its own.

## Consequences
- `/summer` is a placeholder until the summer grid (CAM-11) is built, and `/` still redirects to it.
- The finder's filters (CAM-5) own what the Summer page used to: the week strip becomes the "When" filter, and it gains days off and a child filter.
- The nav has three tabs. On a phone they share one row, which leaves each about a third of 390px. A fourth tab means revisiting the phone layout, not just adding to the list.
- The desktop artboard's layout (a week strip that shows coverage, over results and a map) survives, as the finder's layout rather than as the Summer page.
