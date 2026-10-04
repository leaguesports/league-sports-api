# Glossary Map

Per-context `GLOSSARY.md` files are created when terms move out of the root glossary. Until then, shared language lives in [GLOSSARY.md](./GLOSSARY.md).

## Contexts

- **Identity**: accounts, sessions, profiles; includes `google-oauth` when touched
- **Discovery**: finding venues and events; includes venue-leaderboards (venue-scoped boards fed by `ScorecardLocked`)
- **Scorecards**: live/locked play records by sport (`match` padel, `golf-round`, `darts`, `scorecards` seam)
- **Organise**: scheduling social play and lobby matchmaking (`organised-games`, `lobby`) — second on-disk move after Scorecards
- **Competition**: teams, team matches, tournaments, golf tours
- **Social**: friends, communities, notifications
- **Platform**: parked until claimed — badges, preferences, integrations, roadmap, intents, openf1, pools, training

## Relationships

- **Organise → Scorecards**: Starting an OrganisedGame creates a live Scorecard (padel or golf today)
- **Competition → Scorecards**: Starting a TeamMatch (or tour fourball flow) attaches a live Scorecard; `ScorecardLocked` completes competition state
- **Lobby (Organise) → OrganisedGame**: Filled open games / accepted proposals materialize as OrganisedGame
- **Scorecards → other contexts**: `ScorecardLocked` is published for in-process handlers (leaderboards, team match completion, golf tour fourballs)
- **Discovery ↔ Organise / Competition**: Venue (and later Event) anchors where play is found and often where it is scheduled
