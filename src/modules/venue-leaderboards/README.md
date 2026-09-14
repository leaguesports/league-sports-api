# Venue leaderboards v1

Signed-in venue boards for locked padel, golf, and darts. Frontend hides empty tabs.

Migration: `20260912120000_venue_leaderboard`.

## Boards

| `board` | Window | Rule |
| --- | --- | --- |
| `records` | all-time only | **Golf:** best locked **18-hole** gross and net per tee (snapshot `teeId` / `teeName`). Net only when a net total was computed. **Padel/darts:** most wins all-time; best win-streak record when streak ≥ 2. No most-improved. |
| `potm` | current calendar month | Timezone **`Africa/Johannesburg`**. Padel/darts: most wins. Golf: best net average if any player has **≥3** locked 18-hole rounds with net; otherwise most locked rounds. Top 5 + `#1` (`first`). Tie-break: more events, then earlier first win/event. |
| `grinder` | `month` or `all` | Most locked events at the venue. Appear only with **≥3** events. |
| `streak` | current (all-time consecutive) | Padel/darts only. Current consecutive wins at the venue. Appear only if streak **≥2**. |

Guests (`isGuest` / missing `userId`) never appear.

## Gates

- **Signed-in session required** (401 otherwise). Venue GETs stay public; this route does not.
- Profile flag `appearOnVenueLeaderboards` (boolean, **default true**). When `false`, the user is excluded from every board.
- Toggle: `PUT /api/me/preferences` `{ "appearOnVenueLeaderboards": false }`.
- Public row: `userId`, `displayName` (first name + last initial), `avatarUrl?`, `stats`. **No email. No handicap index.** Golf records may include the net **score number**.

## API (Frontend)

```
GET /api/venues/:idOrCmsId/leaderboards?board=records|potm|grinder|streak&window=month|all
```

- `:idOrCmsId` is the internal venue UUID **or** Sanity/cms id (same as other venue routes).
- `board` is required.
- `window` is required for meaning on **grinder**. Other boards ignore it and return their locked window (`records`/`streak` → `all`, `potm` → current `YYYY-MM`).
- Empty boards are **200** with empty lists (`entries: []`, `first: null`, record lists `[]`) — not 404.
- Unknown venue → 404 `{ "error": "Venue not found" }`.
- Invalid query → 400 `{ "error": string }`.
- Unauthenticated → 401 `{ "error": "Unauthorized" }`.

### Response

```json
{
  "venue": { "id": "…", "cmsId": "sanity-court-1", "name": "Padel Club" },
  "board": "potm",
  "window": "month",
  "windowKey": "2026-09",
  "timezone": "Africa/Johannesburg",
  "computedAt": "2026-09-12T10:00:00.000Z",
  "first": {
    "rank": 1,
    "userId": "…",
    "displayName": "Alex P.",
    "avatarUrl": null,
    "stats": { "wins": 4, "events": 5 }
  },
  "entries": [],
  "records": {
    "golf": { "bestGrossByTee": [], "bestNetByTee": [] },
    "padel": { "mostWins": [], "bestWinStreak": [] },
    "darts": { "mostWins": [], "bestWinStreak": [] }
  }
}
```

`records` is present only when `board=records`. `stats` shapes:

- POTM padel/darts: `{ wins, events }`
- POTM golf (net): `{ netAverage, events, netRounds }`
- POTM golf (fallback) / Grinder: `{ events }`
- Streak / record streak: `{ streak }`
- Golf tee record: `{ score, eventId, lockedAt }` — `score` is gross or net

## Lock hooks + nightly reconcile

On padel / golf / darts **lock** (and capture-finished) `onScorecardLocked` upserts `VenueLeaderboardEventFact` rows when a venue is present, then recomputes snapshots for that venue. Ingest errors are logged and **do not fail the lock**.

Nightly (or anytime) rebuild from locked scorecards:

```bash
yarn leaderboards:reconcile
yarn leaderboards:reconcile sanity-court-1
```

Ops: Railway cron / one-off `yarn leaderboards:reconcile`. Rebuilds facts from locked padel matches, golf rounds, and darts matches, then writes snapshots.

## Cache

Per `venueCmsId + board + windowKey`:

1. In-memory TTL (30s)
2. Durable `VenueLeaderboardSnapshot` row
3. Live compute from facts if no snapshot yet

Lock ingest invalidates the in-memory cache for that venue.

## Friends who’ve played at this venue (thin v1)

Intersection of the viewer’s **accepted friends** (same graph as Organise invites) and users with a **locked** padel / golf / darts event at this venue. Guests never appear (facts are signed-in only). `appearOnVenueLeaderboards === false` uses the **same Profile switch** as the boards — no second privacy flag.

```
GET /api/venues/:idOrCmsId/friends-played
```

- Signed-in session required (401 otherwise). Same `:idOrCmsId` resolution as leaderboards.
- Sorted by most recent lock at this venue (`lastPlayedAt` desc).
- `friends` is capped at **6**; `total` is the uncapped count for “+N more”.
- `summary` is optional: golf 18-hole `bestGross` / `bestNet` at this venue when present; otherwise `null` (Frontend can say “Beat their score”).
- No migration — reads `VenueLeaderboardEventFact` + existing friendships.

### Verify

```bash
# Replace COOKIE and VENUE with a signed-in session cookie and a venue cms id (or internal UUID).
curl -sS -H "Cookie: token=$COOKIE" \
  "http://localhost:3000/api/venues/$VENUE/friends-played"
```

Privacy: `PUT /api/me/preferences` `{ "appearOnVenueLeaderboards": false }` hides that user from this list and from boards.

Frontend UI is out of scope for this API.

## Out of scope

Frontend, TV, inventing scores, ClubMaster, most improved, start-match flow, moments, invites nag.
