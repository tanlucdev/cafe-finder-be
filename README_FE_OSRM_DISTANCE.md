# FE Handoff: OSRM Route Distance

## Goal

Replace the current cafe card distance display that uses straight-line distance with route distance from OSRM when the user enables location.

Before this work:

- Web showed distance from PostGIS `ST_Distance`, which is straight-line distance.
- Google Maps showed driving route distance, so values looked different. Example: Cafe Slow could show around `920m` or `1.19km` straight-line while routing is around `2km+`.

Backend now supports route distance through OSRM.

## Current Backend Setup

Backend repo:

```txt
/Users/nguyentanluc/tanlucdev/cafe/be
```

OSRM public demo server now used for fallback-friendly demo/staging:

```txt
https://router.project-osrm.org
```

Self-hosted local OSRM still works if needed:

```txt
http://localhost:5001
```

Backend local server:

```txt
http://localhost:3001/api
```

OSRM data:

```txt
/Users/nguyentanluc/tanlucdev/cafe/be/osrm-data
```

`osrm-data/` is ignored in git because it is about `4.5GB`.

Port note:

- `5000` was already used by macOS `ControlCenter`.
- Use `5001`.

## Backend Env

`.env` has:

```env
OSRM_BASE_URL="https://router.project-osrm.org"
OSRM_PROFILE="driving"
OSRM_TIMEOUT_MS=2500
OSRM_MAX_DESTINATIONS=20
OSRM_MIN_INTERVAL_MS=1000
OSRM_CACHE_TTL_MS=300000
OSRM_CACHE_MAX_ENTRIES=500
```

The route distance service caches successful OSRM table responses and rate-limits outgoing OSRM requests. When rate limit, timeout, or OSRM failure happens, `/cafes/nearby` falls back to straight-line distance with `distance_mode: "straight"`.

`.env.example` was updated too.

## Backend Endpoint

Use:

```txt
GET /api/cafes/nearby?lat={lat}&lng={lng}&radius={radiusKm}&distanceMode=route
```

Example:

```bash
curl "http://localhost:3001/api/cafes/nearby?lat=10.8003328&lng=106.68641195&radius=5&distanceMode=route"
```

If OSRM works, response item has:

```json
{
  "distance_km": 2.01,
  "duration_min": 4,
  "distance_mode": "route",
  "straight_distance_km": "1.19"
}
```

If OSRM is unavailable, backend falls back to straight-line distance:

```json
{
  "distance_km": "1.19",
  "distance_mode": "straight"
}
```

## Backend Files Changed

```txt
src/cafes/route-distance.service.ts
src/cafes/cafes.service.ts
src/cafes/cafes.controller.ts
src/cafes/cafes.module.ts
.env.example
.gitignore
CLAUDE.md
test/route-distance.service.test.ts
```

Tests pass:

```txt
npm test
23 tests pass
```

## Restart Commands

For self-hosted local OSRM, from backend repo:

```bash
osrm-routed --algorithm mld --port 5001 osrm-data/vietnam-latest.osrm
```

In another terminal:

```bash
npm run start:dev
```

Quick OSRM direct test:

```bash
curl "http://localhost:5001/table/v1/driving/106.6885,10.7898;106.68641195,10.8003328?sources=0&annotations=distance,duration"
```

Expected shape:

```json
{
  "code": "Ok",
  "distances": [[0, 2579.7]],
  "durations": [[0, 222.5]]
}
```

## FE Repo To Update

Main FE appears to be:

```txt
/Users/nguyentanluc/tanlucdev/cafe/fe-uiux
```

There is another older FE:

```txt
/Users/nguyentanluc/tanlucdev/cafe/fe
```

Prior screenshots look like `fe-uiux`; update `fe-uiux` first.

## FE Files Likely Needed

```txt
fe-uiux/src/lib/api.ts
fe-uiux/src/types/cafe.ts
fe-uiux/src/components/cafe/CafeCard.tsx
fe-uiux/src/components/cafe/CafeList.tsx
fe-uiux/src/app/[locale]/(main)/cafe/[slug]/_components/CafeDetailInfo.tsx
```

Search terms:

```bash
rg -n "getNearbyCafes|distanceKm|distance_km|formatDistance|duration" /Users/nguyentanluc/tanlucdev/cafe/fe-uiux/src
```

## FE API Changes

In `fe-uiux/src/lib/api.ts`, update `RawCafe` to accept backend route fields:

```ts
duration_min?: number | string
durationMin?: number | string
distance_mode?: "straight" | "route"
distanceMode?: "straight" | "route"
straight_distance_km?: number | string
straightDistanceKm?: number | string
```

Map them in `mapApiCafe`:

```ts
durationMin
distanceMode
straightDistanceKm
```

In `getNearbyCafes`, call:

```ts
`/cafes/nearby?lat=${lat}&lng=${lng}&radius=${radiusKm}&distanceMode=route`
```

Keep fallback behavior if API fails.

## FE Type Changes

In `fe-uiux/src/types/cafe.ts`, add to `Cafe`:

```ts
durationMin?: number
distanceMode?: "straight" | "route"
straightDistanceKm?: number
```

## FE Display Rule

Cards/list:

- If `distanceMode === "route"`:
  - show route distance from `distanceKm`
  - if `durationMin` exists, show duration too
  - suggested text: `Quận 3 • 2.0 km • 4 phút`
- If `distanceMode !== "route"`:
  - show straight-line distance as approximate
  - suggested text: `Quận 3 • ~1.2 km`

Do not show `straightDistanceKm` in normal card UI unless debugging.

## Important UX Note

OSRM is not Google Maps:

- OSRM uses OpenStreetMap.
- No realtime traffic.
- Route distance should be much closer than straight-line distance, but may still differ from Google Maps.

For Cafe Slow sample from local test:

```json
{
  "distance_km": 2.01,
  "duration_min": 4,
  "distance_mode": "route",
  "straight_distance_km": "1.19"
}
```

## Suggested FE Verification

1. Start OSRM.
2. Start backend.
3. Start FE.
4. Enable location.
5. Network tab should show:

```txt
/api/cafes/nearby?...&distanceMode=route
```

6. Cafe cards should display route distance and duration.
7. If OSRM stopped, UI should still work with fallback approximate distance.

## Next Session Prompt

Use this prompt for FE session:

```txt
Read /Users/nguyentanluc/tanlucdev/cafe/be/README_FE_OSRM_DISTANCE.md first.
Update /Users/nguyentanluc/tanlucdev/cafe/fe-uiux so nearby search calls backend with distanceMode=route, maps duration_min/distance_mode/straight_distance_km, updates Cafe types, and displays route distance + duration on cafe cards/lists/details. Keep fallback display for straight-line distance. Verify with local backend http://localhost:3001/api and OSRM http://localhost:5001.
```
