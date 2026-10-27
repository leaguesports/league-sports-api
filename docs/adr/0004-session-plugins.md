# Sessions are the round, sports are the fold

**Status:** accepted. Supersedes the scorecard-per-sport part of [ADR-0003](./0003-sport-segments-and-hub.md). Sports stay top-level segments. The hub stays shared.

A round is one session. The client publishes facts (`POST /api/sessions/:id/events`). The sport plug-in (`src/sports/<sport>`) validates the payload and folds it into the next state. The session core owns seats, tokens, sequence numbers, the lobby, finish, and realtime. It does not branch on sport.

We kept an event log plus a stored state cache. Replay builds the card from the log and the seats, through the same `applyEvent` the live commands use. The writer and `seq` travel on the event envelope. `data` stays the client payload. `clientEventId` is a column, unique per seat, so a retry does not depend on sport fields.

We rejected a scorecard module per sport. That cloned the round lifecycle (seats, lock, history) once for golf, padel, and darts, and the rules were the only part that differed. We rejected putting sport fields into the capture command. The first golf events had already started to: idempotency compared hole and strokes, and the writer was stamped into `data` as `scoredBy`.

Plug-ins declare sport event types only. `participant.*` and `round.finished` stay on the session core. `validateEvent` receives the writer's seat so a later sport can restrict who may post. Tours, leaderboards, and notifications subscribe when a session starts or finishes. They are not new commands inside the session module.
