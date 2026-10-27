# Glossary Map

Per-context `GLOSSARY.md` files are created when terms move out of the root glossary. Until then, shared language lives in [GLOSSARY.md](./GLOSSARY.md).

Sports are **top-level plug-ins**. The session core does not own their rules. See [ADR-0004](./docs/adr/0004-session-plugins.md).

## Sports

- **Padel**: `src/sports/padel` — registered, no scoring yet
- **Golf**: `src/sports/golf` — hole events, handicap, stableford (`readme.md` there)
- **Darts**: not a plug-in yet

## Hub

- **Sessions**: `src/core/sessions` — one round, seats, lobby, capture, finish, realtime
- **Identity**: accounts and profiles (`src/core/identity`, `src/core/google-oauth`)
- **Venues**: `src/core/venue`
- **Social**: friends, communities, notifications

## Relationships

- **Client → Session**: The client posts facts. It does not send the next card.
- **Session → Sport**: Start, join, capture, finish, and record call the sport registry. The plug-in returns the next state.
- **Sport → Session**: `acceptedEventTypes` are sport events only. The core writes `participant.*` and `round.finished`.
- **Replay**: The event log plus the seats fold through the same `applyEvent` as a live command. Stored `state` is the cache of that fold.
