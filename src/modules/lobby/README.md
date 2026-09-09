# Matchmaking lobby v1

Hybrid lobby (sport → community → moments). **Not booking.** Seekers set Looking; hosts post open games; compatible lookings become a proposal (Accept/Pass). Filled open games and accepted proposals materialize through existing Organise APIs.

Migration: `20260908200000_lobby`

## TTL

Looking `expiresAt` is `min(now + 24h, windowEnd)`. A looking whose window has already ended is rejected. Open games and pending proposals are treated as expired once `windowEnd` has passed (lazy, request-time — no worker). Replacing or clearing Looking cancels that user’s pending proposals.

## Propose matching (request-time)

Evaluated on Looking / open-game writes. No background worker.

Compatible lookings share **sport + city** (case-insensitive) and have an overlapping window. Skill is soft (not required). Users already on an OPEN open-game or a PENDING proposal are skipped.

Pack until sport slots are filled:

| Sport | Default slotsNeeded | Range |
| --- | --- | --- |
| padel | 4 | 4 |
| darts | 2 | 2 |
| golf | 4 | 2–4 (host may set on the open-game post) |

A proposal is created when packed party sizes reach the sport minimum. Every member must Accept; a Pass that drops remaining slots below the minimum cancels the proposal.

Open games are **instant join** (not proposed). While Looking, compatible OPEN games notify the seeker.

## Organise conversion

On open-game fill or unanimous proposal accept, lobby calls `OrganisedGame.create` (same aggregate as Organise — no parallel match engine), auto-accepts invitees, and sets `organiseGameId`. Host later calls existing **Start**.

Blocked (game/proposal stays filled/accepted, `organiseGameId` null):

- `venue_required` — venue is optional on lobby posts; Organise requires one
- `venue_not_found`
- `unsupported_sport` — Organise is padel/golf only (darts waits)

Notes on the organised game: `source=lobby openGame=<id>` or `source=lobby proposal=<id>`. Responses expose `source: "lobby"` and `organiseGameId`.

## Privacy

`GET /api/lobby` public rows: **first name + sport + window + area** (plus open-game slot counts). No user id, handle, email, last name, or avatar. Signed-in viewers also get `viewer.looking` (own extra fields) and friends/teammates sort boost.

## Auth

Looking / post / join / kick / accept / pass / list-mine require session cookie + `requireAuth`. `GET /api/lobby` is optional-auth (privacy shape always).
