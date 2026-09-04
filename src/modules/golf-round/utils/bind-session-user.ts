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
