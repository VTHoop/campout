# 7. Geospatial: PostGIS in the database, MapLibre in the browser

- Status: Accepted
- Date: 2026-09-14

## Context
Two of the product's planner checks are geographic: "camps within N miles of home" in the directory, and "two children at camps too far apart for one drop-off run" in the grid. The Richmond metro spans four jurisdictions and roughly 40 miles corner to corner, so straight-line distance is a usable approximation.

Rendering needs a map beside the list. The map library market splits between Mapbox GL JS (proprietary licence since v2, usage-priced) and MapLibre GL (BSD fork, bring your own tiles).

## Decision
**PostGIS in the database; MapLibre GL with MapTiler tiles in the browser.**

- Locations store `geography(Point, 4326)` with a **GiST index**. Proximity search is `ST_DWithin`, which uses that index; `ST_Distance` in a `WHERE` clause does not and will table-scan.
- **Geocoding happens once, at verification time, not at query time.** A camp's address is resolved to a point when a human verifies the record, and the point is stored. Query-time geocoding would put a third-party API call on the hot path of the product's main search.
- **Distance is straight-line.** The drop-off-gap check reports miles between two locations, not drive time. Routing services cost money per request and add a network dependency to a check that runs on every grid edit.
- MapLibre GL renders; MapTiler serves tiles. The renderer is open source and the tile provider is swappable behind one config value, so a pricing change at the provider is a config edit rather than a rewrite.

## Consequences
- **+** Proximity search is one indexed query with no application-layer distance math.
- **+** No licence risk in the renderer, and no vendor lock-in on tiles.
- **−** Geocoding quality becomes part of the verification workflow — a bad point is a bad search result, so the verifier confirms the pin, not just the address.
- **−** Straight-line distance will occasionally mislead across the James River, where two points are close but the drive is not. Known limitation; say so in the UI copy for the drop-off check rather than being silently wrong.
