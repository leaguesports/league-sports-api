Padel session plug-in (`id: "padel"`). Set and match maths are in `scoring.ts`. The session core does not know these rules.

## Setup

`format` is `"best_of_3"` (default) or `"best_of_5"`. `scoring` is `"advantage"` (default) or `"golden_point"`. Both fields are optional on input; the plug-in stores the defaults. A null or array setup is rejected — it is not coerced to `{}`.

Public setup is `{ format, scoring }`.

## Seats

Up to 4. Join `sportData` is an empty object.

## Events

`acceptedEventTypes` is `match.recorded`.

`match.recorded` data is `{ teams, sets }`. Each of `teams.A` and `teams.B` has `players`: 1 or 2 names, each 1–40 characters. `sets` is a non-empty list of `{ a, b }` with integers 0–7.

A finished set is 6 win-by-2 (6–0 … 6–4), or 7–5, or 7–6. `best_of_3` needs two sets won; `best_of_5` needs three. Extra sets after the match is decided, or an unfinished set or scoreline, are rejected.

On success the state becomes `{ teams, sets, winner, setsWon, result }`. `result` copies `winner` and `setsWon` with the event's `seq`.

`round.finished` freezes `state.result` only when it is still missing (for example a live lobby finished without a recorded scoreline). A prior `match.recorded` result is left alone.
