# Golf tour / camp event v1

Multi-day, multi-course friend golf event. Naming is **Tour** + **Camp** (N≥2). This is **not** a single-elim Tournament.

Fourballs reuse the **existing golf scorecard** (`POST /api/golf-rounds`). Each fourball has its own golf round id so groups can score on different devices. Handicaps and scramble are **v1.1** — `format` is stored and pluggable; v1 accepts **`stroke` only**.

## Migration

`20260909120000_golf_tour`

Applied on merge via Railway `preDeployCommand` (`prisma migrate deploy`). **Do not merge until ready to migrate.**

## Complete behavior

- **Host** `POST /api/golf-tours/:id/complete` may complete a draft or active tour at any time (including while fourballs are still pending). Idempotent if already completed.
- **Auto-complete** runs when a fourball is locked from its golf scorecard (`POST /api/golf-rounds/:id/lock`) **and** every non-cancelled fourball on the tour is `locked`. Cancelled fourballs are ignored. An empty tour (no fourballs) is **not** auto-completed.

Starting the first fourball moves the tour from `draft` → `active`. A completed tour cannot be mutated.

## Scoring / leaderboard

`GET /api/golf-tours/:id/leaderboard` is **gross stroke average per player-round**. Only **locked** fourballs whose linked golf round is also **locked** count.

For each player in a camp, across those locked cards:

```
avgGross = totalGrossStrokes / playerRoundsCounted
```

- `totalGrossStrokes` = sum of hole strokes on that player’s scorecard slot.
- `playerRoundsCounted` = number of locked fourballs in that camp the player was seated in.
- Sort: `avgGross` ascending, then `totalStrokes` ascending, then `displayName`.
- Live / pending / cancelled fourballs are ignored, even if a live card has hole scores.

### Guest identity

Guests have no `userId`. Leaderboard key:

| Player | `playerKey` |
| --- | --- |
| Registered | `user:{userId}` |
| Guest | `guest:{trimmed lowercased displayName}` |

The same guest display name in two locked fourballs of **one camp** aggregates as one person. Different camps do not merge. Hosts should keep guest names stable (or unique) within a camp.

## Format enum (v1.1)

Prisma `GolfTourFormat` is currently `{ stroke }`. Round create/edit rejects `scramble` with a 400. When scramble / handicap nets ship, extend the enum and plug a scorer behind `format` — do not fork the tour aggregate.

## Auth

Session cookie + `requireAuth` on every route.

- **Host** mutates (CRUD tour, camps, rounds, fourballs, complete).
- **Host or seated registered player** may start a fourball (so the group can open the card on their device).
- **Host or seated registered player** may `GET` the tour and leaderboard. Outsiders get `404`.

## Frontend contract

All mutate/read routes need the session cookie. Dates are `YYYY-MM-DD`. Nested writes return `{ tour }`. Start returns the live card path for the existing golf UI.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/golf-tours` | `{ name, startDate, endDate, campNames? }` | `201 { tour }` — default **2** camps (`Camp A`, `Camp B`) if `campNames` omitted. `campNames` must have N≥2. |
| `GET` | `/api/golf-tours/mine` | | `200 { tours }` hosting **or** seated as a registered player |
| `GET` | `/api/golf-tours/:id` | | `200 { tour }` |
| `PATCH` | `/api/golf-tours/:id` | `{ name?, startDate?, endDate? }` | `200 { tour }` |
| `POST` | `/api/golf-tours/:id/complete` | | `200 { tour }` |
| `POST` | `/api/golf-tours/:id/camps` | `{ name, color? }` | `201 { tour }` |
| `PATCH` | `/api/golf-tours/:id/camps/:campId` | `{ name?, color? }` | `200 { tour }` |
| `POST` | `/api/golf-tours/:id/rounds` | `{ date, venueCmsId, label?, format? }` | `201 { tour }` — `format` defaults to `stroke` |
| `PATCH` | `/api/golf-tours/:id/rounds/:roundId` | `{ date?, venueCmsId?, label?, format? }` | `200 { tour }` |
| `POST` | `/api/golf-tours/:id/rounds/:roundId/fourballs` | `{ campId, players? }` | `201 { tour, fourball }` |
| `PATCH` | `/api/golf-tours/:id/fourballs/:fourballId` | `{ players?, campId?, status? }` | `200 { tour }` — `status` may only be `cancelled` (pending only) |
| `POST` | `/api/golf-tours/:id/fourballs/:fourballId/start` | `{ teeName, holesPlayed?, startingHole?, course?, players? }` | `201 { tour, fourball, golfRoundId, path }` |
| `GET` | `/api/golf-tours/:id/leaderboard` | | `200 { leaderboard }` |

### `tour` shape

```json
{
  "id": "…",
  "name": "Friends Cup",
  "startDate": "2026-09-12",
  "endDate": "2026-09-14",
  "status": "draft",
  "hostUserId": "…",
  "viewer": { "role": "host" },
  "camps": [{ "id": "…", "name": "Camp A", "color": null, "sortOrder": 0 }],
  "rounds": [{
    "id": "…",
    "date": "2026-09-12",
    "venueCmsId": "sanity-course-1",
    "label": "Saturday AM",
    "format": "stroke"
  }],
  "fourballs": [{
    "id": "…",
    "roundId": "…",
    "campId": "…",
    "status": "pending",
    "golfRoundId": null,
    "path": null,
    "players": [
      { "slot": 1, "userId": "…", "displayName": "Alex", "isGuest": false },
      { "slot": 2, "userId": null, "displayName": "Pat", "isGuest": true }
    ]
  }],
  "createdAt": "…",
  "updatedAt": "…"
}
```

`viewer.role` is `"host"` or `"player"`. `status` is `draft` \| `active` \| `completed`. Fourball `status` is `pending` \| `live` \| `locked` \| `cancelled`.

### Start fourball

Wires **venue from the tour round** and **tees/course like organise→golf start**:

- `teeName` is required (same as golf round create).
- Default `holesPlayed` is `9` with the default 9-hole par-4 course when `course` is omitted.
- Seated fourball players are copied onto the golf card (override with `players` if needed).
- Returns `{ golfRoundId, path }` where `path` is `/golf/{golfRoundId}` — open the existing golf scorecard UI.
- Idempotent if the fourball is already `live` or `locked`.

Locking that card (`POST /api/golf-rounds/:id/lock`) marks the fourball `locked` and may auto-complete the tour.

### Leaderboard shape

```json
{
  "leaderboard": {
    "tourId": "…",
    "status": "active",
    "camps": [{
      "campId": "…",
      "name": "Camp A",
      "color": null,
      "players": [{
        "playerKey": "user:…",
        "userId": "…",
        "displayName": "Alex",
        "isGuest": false,
        "avgGross": 36,
        "playerRoundsCounted": 1,
        "totalStrokes": 36
      }]
    }]
  }
}
```

Players with zero locked rounds in that camp are omitted.

## Out of scope

Scramble engine, handicaps, booking/payments, Frontend, SEO. In-app notifications for “fourball ready” / “tour completed” are a nice-to-have and not in this v1.

## Link to golf rounds

| Golf tour | Golf rounds API |
| --- | --- |
| Start fourball | `POST /api/golf-rounds` (create live card) |
| Play / lock | existing golf UI + `POST /api/golf-rounds/:id/lock` |
| Leaderboard | locked cards only (`GolfRound.status = locked`) |
