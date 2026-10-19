A session is a single round / game.

`POST /api/sessions` starts a live session from `{ sport, config, venueId?, name?, sportData?, invited? }`. The sport plug-in validates `config` and builds the starting state. The server then opens one lobby with a join code and seats the creator (`role: creator`, `status: joined`) with a one-time participant token. `createdBy` is set from the signed-in user when the session cookie is present, and left empty otherwise.

`GET /api/sessions/join/:code` is public and rate-limited. It returns the sport, status, open spots, and participants as `{ id, name, status, role }` only. `POST /api/sessions/:id/join` claims an invite (`{ claimPid }`) or adds a player (`{ name, sportData }`). `POST /api/sessions/:id/leave` uses the `X-Session-Token` header. Core participant events are `participant.invited`, `participant.claimed`, `participant.joined`, and `participant.left`, written with the next `seq`.

Padel's lineup cap is a placeholder of 2–4 until that sport picks a fixed format. Golf is 1–4, and a golf player needs a `teeId` from the setup's `tees` list. `handicapIndex`, when sent, is from -10 to 54.

`RecordSession` stores a finished session with no lobby and status `closed`. It uses the same plug-in to validate setup, build state, and fold events. Event `seq` is assigned by the server, starting at 1.

`SessionRepository.closeSession` sets status to `closed` and deletes the linked lobby. The foreign key is `Session.lobbyId`, so deleting the lobby clears it.

Sport rules live in `src/sports/<sport>/session.ts` and are registered by id (`golf`, `padel`). Start and record call the registry and do not branch on sport.
