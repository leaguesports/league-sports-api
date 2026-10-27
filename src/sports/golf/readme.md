Golf session plug-in (`id: "golf"`). Scoring maths is in `scoring.ts`. The session core does not know these rules.

## Setup

`config.tees` is required: 1 to 8 tees. Each tee has an `id` and an optional `name` (max 40 characters). `par`, `rating`, and `slope` are optional and must be sent together (`par` 27–90, `rating` 20–100, `slope` 55–155). Without them, or without a handicap index on the seat, that player is gross only.

`holesPlayed` is `"18"` (default), `"front9"`, or `"back9"`. `startHole` defaults to 1, or 10 for a back nine, and must sit in the round. `handicapAllowance` defaults to 1 and is from 0 to 1.

An optional `holes` snapshot is `{ n, par, si }` for every hole in the round. Hole numbers and stroke indexes must be unique, and the set must be exactly that layout: 1–18, 1–9, or 10–18. `startHole` does not rotate the set.

Public setup is the tee list as `{ id, name? }`. Rating numbers stay off it.

## Seats

Up to 4. A player sends `{ teeId, handicapIndex? }`. `teeId` must be one of the setup tees. `handicapIndex`, when sent, is from -10 to 54.

## Events

`acceptedEventTypes` is `hole.scored` and `hole.cleared`.

`hole.scored` data is `{ participantId, hole, strokes }`. Strokes are 1–15. `hole.cleared` data is `{ participantId, hole }`. The target `participantId` must be a joined seat. Any joined player may score for any joined player. The writer's seat is the envelope's `participantId`, not a field in `data`. A client that sends `scoredBy` or `seq` in `data` is rejected.

State keeps the latest score per participant and hole: `{ participantId, hole, strokes, scoredBy, seq }`. `scoredBy` is the writer. Clearing a hole removes that one score.

On every event, including a participant joining or leaving, the plug-in derives `players` and `standings` from the scores, the setup, and the current seats. Standings rank by stableford, higher first. A tie shares the position and is not split. Players without a stableford score are listed after those who have one.

`round.finished` copies `standings` onto `state.result` with the event's `seq`. Later folds do not rewrite `result`.
