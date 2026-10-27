Sport plug-ins. The session core owns a round: seats, tokens, sequence numbers, the lobby, and realtime. A plug-in owns the rules for one sport.

Register a plug-in by id in `src/sports/registry.ts`. The session commands call that registry and do not branch on sport.

A plug-in implements `SportSessionPlugin`:

- `validateSetup` / `publicSetup` / `buildStartingState` — the opening config and state
- `validateJoin` — the `sportData` a seat must send
- `participants.max` — how many seats the round holds
- `acceptedEventTypes` — sport events only. Do not list `participant.*` or `round.finished`
- `validateEvent` — reject a payload this sport will not apply. The core has already checked the token, that the seat is joined, and that the session is live. `writerId` is the seat that posted the event
- `applyEvent` — pure. Return the next state. The writer and `seq` are on the event envelope (`participantId` and `seq`), not inside `data`

`applyEvent` always receives the current seats. Use them to derive the card. A recorded round passes the seats the caller supplied, which may be empty.

Core events still arrive at `applyEvent`. Accept them and leave sport facts unchanged, then derive the card again so a new or departed seat shows up.

Golf rules: [golf/readme.md](./golf/readme.md). Padel is registered and has no scoring yet.
