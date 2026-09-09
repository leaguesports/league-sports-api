# Golf tour / camp event

Multi-day, multi-course friend golf event. Naming is **Tour** + **Camp** (N≥2). This is **not** a single-elim Tournament.

Fourballs reuse the **existing golf scorecard** (`POST /api/golf-rounds`). Each fourball has its own golf round id so groups can score on different devices. Handicaps and scramble are **v1.1** — `format` is stored and pluggable; **v1 and v2 accept `stroke` only**.

## Migrations

| Version | Name |
| --- | --- |
| v1 | `20260909120000_golf_tour` |
| v2 | `20260909180000_golf_tour_setup_v2` |

Applied on merge via Railway `preDeployCommand` (`prisma migrate deploy`). **Do not merge until ready to migrate.**

## Setup v2 flow

Roster-first + **standing fourballs** so hosts do not rebuild pairings every round.

1. Host creates a tour (still defaults to two camps).
2. Host adds a **camp roster** (registered `userId` and/or guest display name).
3. Host creates **standing fourball templates** (tour-scoped): optional name, `campId`, up to 4 members from the roster (`rosterMemberId`) or inline guests, `sortOrder`.
4. Host adds a **round**. If templates exist, the tour **auto-prepares** one pending fourball instance per template (`standingFourballId` set).
5. Host can also call **`POST .../rounds/:roundId/prepare`** (idempotent) after adding templates later.
6. Per instance the host may:
   - **Sit out** the group (`sitOut: true`) or a player (`players[].sitOut` / `playerSitOuts`) — template unchanged.
   - **Custom this round** — `PATCH` instance `players` while pending. Does **not** write back to the standing template.
   - **Start** the instance with the existing fourball start endpoint (scorecard).
7. **Copy from previous round** — `POST .../rounds/:roundId/copy-from/:sourceRoundId` creates or edits target instances from the source round’s groups (sit-out is not copied).

**Also update standing** from a custom instance is **out / future**. Edit the template directly if the standing group should change.

The v1 per-round fourball endpoints stay working. A host can still `POST .../rounds/:roundId/fourballs` for one-off groups that are not linked to a template.

### Prepare semantics

- For each standing template, if a fourball already exists for `(roundId, standingFourballId)`, **skip**.
- Otherwise create a pending instance with the template’s `campId` and cloned players.
- Does **not** overwrite custom players on an existing instance.
- Adding a round runs the same spawn. Calling prepare again is a no-op when every template already has an instance.
- Deleting a template detaches existing instances (`standingFourballId` → `null`); it does not delete them.

### Sit-out

- Instance `sitOut: true` — the whole group is excluded from the leaderboard and from auto-complete; it cannot be started until cleared.
- Player×round `sitOut` — that seat is excluded from leaderboard averages and omitted from the default start-card players.
- The standing template is never changed.

### Copy from previous round

- Source cancelled fourballs are ignored.
- Templated source groups upsert the pending target instance with the same `standingFourballId` (create if missing).
- Untemplated source groups create a target instance unless one already exists on that round with the same camp + player identities.
- Sit-out flags are **not** copied (fresh round).
- Idempotent for a second call with the same source groups.

## Complete behavior

- **Host** `POST /api/golf-tours/:id/complete` may complete a draft or active tour at any time (including while fourballs are still pending). Idempotent if already completed.
- **Auto-complete** runs when a fourball is locked from its golf scorecard (`POST /api/golf-rounds/:id/lock`) **and** every non-cancelled, **non-sit-out** fourball on the tour is `locked`. Cancelled and sit-out fourballs are ignored. An empty tour (no playable fourballs) is **not** auto-completed.

Starting the first fourball moves the tour from `draft` → `active`. A completed tour cannot be mutated.

## Scoring / leaderboard

`GET /api/golf-tours/:id/leaderboard` is **gross stroke average per player-round**. Only **locked, non-sit-out** fourballs whose linked golf round is also **locked** count. Sit-out players on those cards are excluded from `playerRoundsCounted`.

For each player in a camp, across those locked cards:

```
avgGross = totalGrossStrokes / playerRoundsCounted
```

- `totalGrossStrokes` = sum of hole strokes on that player’s scorecard slot.
- `playerRoundsCounted` = number of locked, non-sit-out player-rounds in that camp.
- Sort: `avgGross` ascending, then `totalStrokes` ascending, then `displayName`.
- Live / pending / cancelled / sit-out fourballs are ignored, even if a live card has hole scores.

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

- **Host** mutates (CRUD tour, camps, roster, standing templates, rounds, fourballs, prepare, copy, complete).
- **Host or seated registered player** may start a fourball (so the group can open the card on their device).
- **Host, roster member, standing-template player, or seated registered player** may `GET` the tour, camp roster, and leaderboard. Outsiders get `404`.

## Frontend contract

All mutate/read routes need the session cookie. Dates are `YYYY-MM-DD`. Nested writes return `{ tour }`. Start returns the live card path for the existing golf UI.

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| `POST` | `/api/golf-tours` | `{ name, startDate, endDate, campNames? }` | `201 { tour }` — default **2** camps (`Camp A`, `Camp B`) if `campNames` omitted. `campNames` must have N≥2. |
| `GET` | `/api/golf-tours/mine` | | `200 { tours }` hosting **or** seated / rostered as a registered player |
| `GET` | `/api/golf-tours/:id` | | `200 { tour }` |
| `PATCH` | `/api/golf-tours/:id` | `{ name?, startDate?, endDate? }` | `200 { tour }` |
| `POST` | `/api/golf-tours/:id/complete` | | `200 { tour }` |
| `POST` | `/api/golf-tours/:id/camps` | `{ name, color? }` | `201 { tour }` |
| `PATCH` | `/api/golf-tours/:id/camps/:campId` | `{ name?, color? }` | `200 { tour }` |
| `GET` | `/api/golf-tours/:id/camps/:campId/roster` | | `200 { roster }` |
| `POST` | `/api/golf-tours/:id/camps/:campId/roster` | `{ displayName, isGuest, userId? }` | `201 { tour, member }` |
| `PATCH` | `/api/golf-tours/:id/camps/:campId/roster/:memberId` | `{ displayName?, isGuest?, userId? }` | `200 { tour }` |
| `DELETE` | `/api/golf-tours/:id/camps/:campId/roster/:memberId` | | `200 { tour }` |
| `POST` | `/api/golf-tours/:id/standing-fourballs` | `{ campId, name?, players?, sortOrder? }` | `201 { tour, standingFourball }` — `players[]` may use `rosterMemberId` instead of identity fields |
| `PATCH` | `/api/golf-tours/:id/standing-fourballs/:templateId` | `{ campId?, name?, players? }` | `200 { tour }` |
| `DELETE` | `/api/golf-tours/:id/standing-fourballs/:templateId` | | `200 { tour }` — instances are detached, not deleted |
| `POST` | `/api/golf-tours/:id/rounds` | `{ date, venueCmsId, label?, format? }` | `201 { tour }` — `format` defaults to `stroke`; auto-prepares instances from templates |
| `PATCH` | `/api/golf-tours/:id/rounds/:roundId` | `{ date?, venueCmsId?, label?, format? }` | `200 { tour }` |
| `POST` | `/api/golf-tours/:id/rounds/:roundId/prepare` | | `200 { tour, createdIds, fourballs }` — idempotent |
| `POST` | `/api/golf-tours/:id/rounds/:roundId/copy-from/:sourceRoundId` | | `200 { tour }` |
| `POST` | `/api/golf-tours/:id/rounds/:roundId/fourballs` | `{ campId, players? }` | `201 { tour, fourball }` — v1 one-off instance (no template) |
| `PATCH` | `/api/golf-tours/:id/fourballs/:fourballId` | `{ players?, campId?, status?, sitOut?, playerSitOuts? }` | `200 { tour }` — `status` may only be `cancelled` (pending only). `players` override is pending-only and does **not** mutate the standing template. `sitOut` / `playerSitOuts` allowed on live/locked. |
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
  "camps": [{
    "id": "…",
    "name": "Camp A",
    "color": null,
    "sortOrder": 0,
    "roster": [
      { "id": "…", "campId": "…", "userId": "…", "displayName": "Alex", "isGuest": false }
    ]
  }],
  "rounds": [{
    "id": "…",
    "date": "2026-09-12",
    "venueCmsId": "sanity-course-1",
    "label": "Saturday AM",
    "format": "stroke"
  }],
  "standingFourballs": [{
    "id": "…",
    "campId": "…",
    "name": "Morning group",
    "sortOrder": 0,
    "players": [
      { "slot": 1, "userId": "…", "displayName": "Alex", "isGuest": false }
    ]
  }],
  "fourballs": [{
    "id": "…",
    "roundId": "…",
    "campId": "…",
    "status": "pending",
    "golfRoundId": null,
    "path": null,
    "standingFourballId": "…",
    "sitOut": false,
    "players": [
      { "slot": 1, "userId": "…", "displayName": "Alex", "isGuest": false, "sitOut": false },
      { "slot": 2, "userId": null, "displayName": "Pat", "isGuest": true, "sitOut": false }
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
- Seated, **non-sit-out** fourball players are copied onto the golf card (override with `players` if needed).
- Returns `{ golfRoundId, path }` where `path` is `/golf/{golfRoundId}` — open the existing golf scorecard UI.
- Idempotent if the fourball is already `live` or `locked`.
- A sit-out instance cannot be started.

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

Players with zero locked, non-sit-out rounds in that camp are omitted.

## Out of scope

Scramble engine, handicaps, booking/payments, Frontend, SEO. Writing a custom instance back onto the standing template. In-app notifications for “fourball ready” / “tour completed” are a nice-to-have.

## Link to golf rounds

| Golf tour | Golf rounds API |
| --- | --- |
| Start fourball | `POST /api/golf-rounds` (create live card) |
| Play / lock | existing golf UI + `POST /api/golf-rounds/:id/lock` |
| Leaderboard | locked, non-sit-out cards only (`GolfRound.status = locked`) |
