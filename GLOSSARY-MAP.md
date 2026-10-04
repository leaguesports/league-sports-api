# Glossary Map

Per-context `GLOSSARY.md` files are created when terms move out of the root glossary. Until then, shared language lives in [GLOSSARY.md](./GLOSSARY.md).

Sports are **top-level segments**. Hub contexts do **not** own sport scorecard modules.

## Sports

- **Padel**: padel Scorecard (`match` today), pairings, padel rules
- **Golf**: golf Scorecard (`golf-round`), handicap, GolfTour (`golf-tours`)
- **Darts**: darts Scorecard (`darts`), turns

## Hub contexts

- **Identity**: accounts, sessions, profiles; includes `google-oauth` when touched
- **Discovery**: venues, venue-leaderboards (projection of locked Scorecards), future Event
- **Organise**: one Lobby; OrganisedGame that *starts* by calling into Padel or Golf (darts not organisable yet)
- **Competition**: teams, TeamMatch, Tournament — sport is a parameter; start/complete call into the Sport
- **Social**: friends, communities, notifications
- **Platform**: parked — badges, preferences, integrations, roadmap, intents, openf1, pools, training

## Relationships

- **Organise → Sport**: Starting an OrganisedGame asks Padel or Golf to create a live Scorecard
- **Competition → Sport**: Starting a TeamMatch asks the Sport to create a live Scorecard; `ScorecardLocked` completes TeamMatch (and GolfTour fourballs)
- **Lobby → OrganisedGame**: Filled open games / accepted proposals materialize as OrganisedGame (darts blocked until Organise supports it)
- **Sport → Hub consumers**: `ScorecardLocked` is published on the hub Domain Event bus (leaderboards, TeamMatch, GolfTour)
- **Discovery ↔ Organise / Competition**: Venue (and later Event) anchors where play is found and often where it is scheduled
