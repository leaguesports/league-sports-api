# League Sports (Sport Hub)

A multi-sport hub that gives fans, players, and pros tools around play, discovery, and competition.

## Language

**Sport Hub**:
The product: one platform of tools for people with different relationships to sport (fans, players, pros), not a single-sport league manager.
_Avoid_: League racing, sim racing league (legacy readme wording)

**Sport**:
A playable vertical in the hub: Padel, Golf, or Darts. Each sport is a session plug-in under `src/sports`. It validates setup and folds events into state. Hub-wide features (identity, venues, the session lobby) are not Sports.
_Avoid_: Treating a sport as the owner of seats, tokens, or the round lifecycle

**Padel**:
The racket-sport vertical. Its session plug-in is registered (`src/sports/padel`) and does not score yet.
_Avoid_: Match as a generic word for other sports

**Golf**:
The golf vertical. Its session plug-in (`src/sports/golf`) owns the card: tees, hole scores, handicap, and stableford. See `src/sports/golf/readme.md`.
_Avoid_: Folding golf scoring into the session core

**Darts**:
The darts vertical. It is not a session plug-in yet.
_Avoid_: Assuming a darts scorecard module still exists beside sessions

**Fan**:
Someone engaging around sport without necessarily playing in a given activity (follow, discover, watch, support).
_Avoid_: Spectator (unless we later mean live-audience specifically)

**Player**:
Someone who participates in play (joins games, appears on scorecards, competes).
_Avoid_: User (User is the identity/account concept)

**Pro**:
A professional or high-skill participant the hub may serve with distinct tools later; not yet a hard permission boundary in the product.
_Avoid_: Treating Pro as a required account role today

**Venue**:
A real-world place where play can happen; currently a primary surface for discovery and a common anchor for organised play and locked-scorecard history.
_Avoid_: Location, club (unless we later split those concepts)

**Discovery**:
How people find venues, events, and ways to engage; venues and events are in this surface today.
_Avoid_: Search (implementation), feed (UI pattern)

**Event**:
A discoverable happening people can find in the hub (product language). Future Discovery concept — not its own aggregate yet. OrganisedGame, Tournament, and GolfTour are related happenings but are **not** called Event in code today.
_Avoid_: Using bare "event" for architecture; see Domain Event. Do not equate Event with OrganisedGame.

**Domain Event**:
A named fact that something already happened in the domain, published for other modules to react to. Architecture term only — never product copy.
_Avoid_: Event (unqualified), callback, hook (those are mechanisms)

**Scorecard**:
The derived state of a session for one sport. Live while the session is `live`. Frozen on `state.result` when the session finishes. Not a hub context and not its own module.
_Avoid_: Match (ambiguous), game (ambiguous with a scheduled game)

**Match**:
Do not use this for a round. A round is a session.
_Avoid_: Using Match for golf, darts, team fixtures, or organised games

**Session**:
One round. The client publishes events. The sport plug-in folds each event into the next state. Seats, the join code, and finish belong to the session, not to the sport.
_Avoid_: Scorecard module, a second lifecycle per sport

**OrganisedGame**:
A host-scheduled social game. Not a module in this API. A round that is being played is a Session.
_Avoid_: Event (unless we explicitly promote it into Discovery Event), booking, using it as the name of the session

**Lobby**:
The join lobby on a live session: one join code, deleted when the session finishes. The older matchmaking lobby (Looking, open games, proposals) is not a module in this API.
_Avoid_: Matchmaking service (generic), queue

**TeamMatch**:
A team-versus-team challenge. Not a module in this API. Completing a round is finishing a Session.
_Avoid_: Match, OrganisedGame, Session

**Tournament**:
A competition structure over team challenges. Not a module in this API, and not a GolfTour.
_Avoid_: Tour, league, Session

**GolfTour**:
A golf-specific multi-round competition. Not a module in this API. A single round is a golf Session.
_Avoid_: Tournament, Session
