A session is a single round / game.

`POST /api/sessions` starts a live session from `{ sport, config, venueId? }`. The sport plug-in validates `config` and builds the starting state. The server then opens one lobby with a join code. `createdBy` is set from the signed-in user when the session cookie is present, and left empty otherwise.

`RecordSession` stores a finished session with no lobby and status `closed`. It uses the same plug-in to validate setup, build state, and fold events. Event `seq` is assigned by the server, starting at 1.

`SessionRepository.closeSession` sets status to `closed` and deletes the linked lobby. The foreign key is `Session.lobbyId`, so deleting the lobby clears it.

Sport rules live in `src/sports/<sport>/session.ts` and are registered by id (`golf`, `padel`). Start and record call the registry and do not branch on sport.
