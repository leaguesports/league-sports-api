A session is a single round / game.

`POST /api/sessions` starts a live session from `{ sport, config, venueId?, name?, sportData?, invited? }`. The sport plug-in validates `config` and builds the starting state. The server then opens one lobby with an 8-character join code and seats the creator (`role: creator`, `status: joined`) with a participant token. `createdBy` is set from the signed-in user when the session cookie is present, and left empty otherwise. Invites are `{ name, sportData? }`. The client cannot set an account id on an invite. `config` is limited to 4000 characters. The invite list is limited to 16 names. Start is rate-limited per address.

`GET /api/sessions/join/:code` is public and rate-limited. It returns the sport, status, open spots, the public setup, and participants as `{ id, name, status, role }`. Golf setup is the tee list (`id` and `name`). `POST /api/sessions/:id/join` must send the same join code. It claims an invite (`{ claimPid, joinCode }`) or adds a player (`{ name, sportData?, joinCode }`). A player who has left can take that same name again. The seat keeps its id and gets a new token. `POST /api/sessions/:id/leave` uses the `X-Session-Token` header. `POST /api/sessions/:id/token` gives a signed-in player a new token for their joined seat. Core participant events are `participant.invited`, `participant.claimed`, `participant.joined`, and `participant.left`, written with the next `seq`.

Padel allows up to 4 players until that sport picks a fixed format. Golf allows up to 4. A golf player needs a `teeId` from the setup `tees` list. A course can list up to 8 tees. `handicapIndex`, when sent, is from -10 to 54.

`RecordSession` stores a finished session with no lobby and status `closed`. It uses the same plug-in to validate setup, build state, and fold events. Event `seq` is assigned by the server, starting at 1. It does not create participant rows.

`SessionRepository.closeSession` sets status to `closed` and deletes the linked lobby. The foreign key is `Session.lobbyId`, so deleting the lobby clears it.

Sport rules live in `src/sports/<sport>/session.ts` and are registered by id (`golf`, `padel`). Start and record call the registry and do not branch on sport. Rate limits for start, join, and join lookup are stored in `SessionRateHit` so every server shares one count.
