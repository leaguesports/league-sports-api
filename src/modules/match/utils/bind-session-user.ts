import { MatchPlayerInput } from "../entities/match-player";
import { PairingsInput } from "../entities/pairings";

function normalizedUserId(userId: unknown): string | null {
  if (typeof userId !== "string") {
    return null;
  }

  const value = userId.trim();
  return value.length === 0 ? null : value;
}

function withSessionUser(player: MatchPlayerInput, sessionUserId: string): MatchPlayerInput {
  return { ...player, userId: sessionUserId, isGuest: false };
}

/**
 * Strip account ids that are not the session user. Foreign ids become guests so
 * create cannot plant another user's id for badge evidence.
 */
function stripNonSessionUserIds(
  pairings: PairingsInput,
  sessionUserId: string | null,
): PairingsInput {
  const strip = (player: MatchPlayerInput): MatchPlayerInput => {
    const id = normalizedUserId(player.userId);
    if (sessionUserId && id === sessionUserId) {
      return withSessionUser(player, sessionUserId);
    }
    if (id !== null) {
      return {
        displayName: player.displayName,
        isGuest: true,
        userId: null,
      };
    }
    return { ...player, userId: null };
  };

  return {
    teamA: [strip(pairings.teamA[0]), strip(pairings.teamA[1])],
    teamB: [strip(pairings.teamB[0]), strip(pairings.teamB[1])],
  };
}

export function bindSessionUserIdToPairings(
  pairings: PairingsInput,
  sessionUserId: string,
): PairingsInput {
  const teamA: [MatchPlayerInput, MatchPlayerInput] = [
    pairings.teamA[0],
    pairings.teamA[1],
  ];
  const teamB: [MatchPlayerInput, MatchPlayerInput] = [
    pairings.teamB[0],
    pairings.teamB[1],
  ];
  const ordered: Array<{ team: [MatchPlayerInput, MatchPlayerInput]; index: 0 | 1 }> = [
    { team: teamA, index: 0 },
    { team: teamA, index: 1 },
    { team: teamB, index: 0 },
    { team: teamB, index: 1 },
  ];

  let alreadyBound = false;
  for (const slot of ordered) {
    const player = slot.team[slot.index];
    if (normalizedUserId(player.userId) === sessionUserId) {
      slot.team[slot.index] = withSessionUser(player, sessionUserId);
      alreadyBound = true;
    }
  }

  if (!alreadyBound) {
    for (const slot of ordered) {
      const player = slot.team[slot.index];
      if (player.isGuest === true) {
        continue;
      }
      if (normalizedUserId(player.userId) !== null) {
        continue;
      }
      slot.team[slot.index] = withSessionUser(player, sessionUserId);
      break;
    }
  }

  return { teamA, teamB };
}

/** Sanitize create payload: only the session user may be stamped as a userId. */
export function sanitizePairingsForCreate(
  pairings: PairingsInput,
  sessionUserId: string | null,
): PairingsInput {
  const stripped = stripNonSessionUserIds(pairings, sessionUserId);
  if (!sessionUserId) {
    return stripped;
  }
  return bindSessionUserIdToPairings(stripped, sessionUserId);
}
