# League Sports (Sport Hub)

A multi-sport hub that gives fans, players, and pros tools around play, discovery, and competition.

## Language

**Sport Hub**:
The product: one platform of tools for people with different relationships to sport (fans, players, pros), not a single-sport league manager.
_Avoid_: League racing, sim racing league (legacy readme wording)

**Sport**:
A playable vertical in the hub today: Padel, Golf, or Darts. Each Sport owns its Scorecard and sport-only play. Hub-wide features (identity, venues, lobby, teams) are not Sports.
_Avoid_: Treating Scorecards, Organise, or Competition as owners of sport code

**Padel**:
The racket-sport vertical. Its Scorecard is still named Match in code and `/api/matches`.
_Avoid_: Match as a generic word for other sports

**Golf**:
The golf vertical: golf Scorecard (round), handicap, and GolfTour.
_Avoid_: Folding golf-only tour play into Tournament

**Darts**:
The darts vertical: darts Scorecard (501) and turns. Lobby can match darts; OrganisedGame cannot start darts yet.
_Avoid_: Assuming Organise supports every Sport

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
A Sport-owned record of play that is live while in progress and locked when finished. Not a hub context — each Sport has its own Scorecard shape.
_Avoid_: Match (ambiguous), game (ambiguous with OrganisedGame)

**Match**:
Legacy/code name for the **padel** Scorecard (`/api/matches` today). Prefer saying Padel Scorecard in new language; rename is planned without breaking the HTTP surface in this pass.
_Avoid_: Using Match for golf, darts, team fixtures, or organised games

**OrganisedGame**:
A host-scheduled social game (padel or golf) that can be started into a live Scorecard. Distinct from Lobby matchmaking and from TeamMatch.
_Avoid_: Event (unless we explicitly promote it into Discovery Event), booking

**Lobby**:
Matchmaking for seekers and hosts (Looking, open games, proposals). Not booking. Successful paths convert into an OrganisedGame.
_Avoid_: Matchmaking service (generic), queue

**TeamMatch**:
A team-versus-team challenge that can attach a live Scorecard and complete when that Scorecard locks.
_Avoid_: Match, OrganisedGame

**Tournament**:
A competition structure over TeamMatches (brackets/slots/registrations) — not a GolfTour.
_Avoid_: Tour, league

**GolfTour**:
Golf-specific multi-round competition structure (camps, fourballs) that reuses golf Scorecards — not a Tournament.
_Avoid_: Tournament
