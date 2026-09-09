import { GolfPlayerInput } from "../entities/golf-player";

function normalizedUserId(userId: unknown): string | null {
  if (typeof userId !== "string") {
    return null;
  }

  const value = userId.trim();
  return value.length === 0 ? null : value;
}

function withSessionUser(
  player: GolfPlayerInput,
  sessionUserId: string,
): GolfPlayerInput {
  return { ...player, userId: sessionUserId, isGuest: false };
}

function stripNonSessionUserIds(
  players: GolfPlayerInput[],
  sessionUserId: string | null,
): GolfPlayerInput[] {
  return players.map((player) => {
    const id = normalizedUserId(player.userId);
    if (sessionUserId && id === sessionUserId) {
      return withSessionUser(player, sessionUserId);
    }
    if (id !== null) {
      return {
        ...player,
        displayName: player.displayName,
        isGuest: true,
        userId: null,
      };
    }
    return { ...player, userId: null };
  });
}

export function bindSessionUserIdToPlayers(
  players: GolfPlayerInput[],
  sessionUserId: string,
): GolfPlayerInput[] {
  const bound = players.map((player) => ({ ...player }));

  let alreadyBound = false;
  for (let index = 0; index < bound.length; index++) {
    const player = bound[index];
    if (normalizedUserId(player.userId) === sessionUserId) {
      bound[index] = withSessionUser(player, sessionUserId);
      alreadyBound = true;
    }
  }

  if (!alreadyBound) {
    for (let index = 0; index < bound.length; index++) {
      const player = bound[index];
      if (player.isGuest === true) {
        continue;
      }
      if (normalizedUserId(player.userId) !== null) {
        continue;
      }
      bound[index] = withSessionUser(player, sessionUserId);
      break;
    }
  }

  return bound;
}

/** Sanitize create payload: only the session user may be stamped as a userId. */
export function sanitizePlayersForCreate(
  players: GolfPlayerInput[],
  sessionUserId: string | null,
): GolfPlayerInput[] {
  const stripped = stripNonSessionUserIds(players, sessionUserId);
  if (!sessionUserId) {
    return stripped;
  }
  return bindSessionUserIdToPlayers(stripped, sessionUserId);
}
