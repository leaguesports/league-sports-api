# Golf rounds + handicaps

Live / locked golf scorecards. Handicap math is **estimated WHS-style**, **not official WHS certified**. Missing Handicap Index or missing tee ratings never blocks play — the round stays gross-only.

## Formula (v1)

Course Handicap (round half up, `.5` toward +∞):

```
CH = HI × (Slope / 113) + (CourseRating − Par)
```

Playing Handicap v1 is 100%:

```
PH = CH
```

Net:

- Stroke indexes present on every hole → allocate PH strokes (hardest SI first; extras wrap). Hole net = hole gross − strokes received. Round net = sum of hole nets.
- Stroke indexes missing → no per-hole nets; round net = gross − PH.
- Plus handicaps (negative PH) apply negative strokes to the easiest holes so net = gross − PH still holds.

## Profile

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/auth/me` | — | Includes `golfHandicapIndex` (`number \| null`, 1 decimal, −10.0…54.0) |
| `PATCH` | `/api/auth/me` | `{ golfHandicapIndex: number \| null }` | Same payload as profile |
| `GET` | `/api/me/profile` | — | Same document as `/api/auth/me` |
| `PATCH` | `/api/me/profile` | `{ golfHandicapIndex: number \| null }` | Clears HI when `null` |

## Round create — tee ratings from the client (Sanity)

`POST /api/golf-rounds` and `POST /api/golf-rounds/capture` accept ratings as top-level fields **or** a nested `tee` object. All optional.

```json
{
  "teeName": "White",
  "teeId": "tee-white",
  "courseRating": 71.2,
  "slopeRating": 129,
  "teePar": 72,
  "tee": {
    "id": "tee-white",
    "courseRating": 71.2,
    "slopeRating": 129,
    "par": 72
  }
}
```

Nested `tee` wins when both are sent. If `teePar` / `tee.par` is omitted, the server sums `course.holes[].par`. Slope must be an integer 55–155; course rating 25–90 (9- or 18-hole).

Server looks up `golfHandicapIndex` for each **seated `userId`** and computes CH/PH. Guests and players without HI stay gross-only.

## Snapshot fields

Returned on create, get, lock, capture, and locked history.

| Field | Where | When |
| --- | --- | --- |
| `teeName` | round | always (required at create) |
| `teeId` | round | when the client sent it |
| `courseRating` | round | when the client sent it |
| `slopeRating` | round | when the client sent it |
| `teePar` | round | client value or sum of hole pars |
| `handicapDisclaimer` | round | always |
| `players[].handicapIndexUsed` | player | HI + CR + slope + par present |
| `players[].courseHandicap` | player | same |
| `players[].playingHandicap` | player | same (equals CH in v1) |
| `players[].grossTotal` | player | after lock / capture |
| `players[].netTotal` | player | after lock / capture, when PH was snapshotted |
| `score.holes[].strokes` | hole | gross (unchanged) |
| `score.holes[].netStrokes` | hole | lock / capture, when PH **and** stroke indexes exist |

HI/CH/PH are snapshotted at create (or capture) and are not recalculated from the live profile on lock.

## Migration

`20260909200000_golf_handicap`

Applied on merge via Railway `preDeployCommand` (`prisma migrate deploy`).

## Out of scope

Scramble / best ball, tour-camp pairing UI, inventing Sanity tee content, Frontend.
