import { DomainError } from "../../../lib/domain-error";
import { FriendProfile } from "../../friends/repositories/friendship.repository";
import { GolfPlayerInput } from "../../golf-round/entities/golf-player";
import { MatchPlayerInput } from "../../match/entities/match-player";
import { PairingsInput } from "../../match/entities/pairings";
import { OrganisedGame } from "../entities/organised-game";

export type SeatedProfile = Pick<FriendProfile, "userId" | "displayName">;

function guest(displayName: string): MatchPlayerInput {
  return { displayName, isGuest: true, userId: null };
}

function named(profile: SeatedProfile): MatchPlayerInput {
  return {
    displayName: profile.displayName,
    isGuest: false,
    userId: profile.userId,
  };
}

/**
 * Host always A1. Accepted invitees fill A2, B1, B2 in invite order.
 * Remaining padel slots are guests so CreateMatch's four-player rule holds.
 */
export function pairingsFromAccepted(
  game: OrganisedGame,
  host: SeatedProfile,
  accepted: SeatedProfile[],
): PairingsInput {
  if (host.userId !== game.hostUserId) {
    throw new DomainError("Host must be seated");
  }

  const seats: MatchPlayerInput[] = [named(host)];
  for (const profile of accepted) {
    if (seats.length >= 4) break;
    if (profile.userId === host.userId) continue;
    seats.push(named(profile));
  }
  while (seats.length < 4) {
    seats.push(guest(`Guest ${seats.length + 1}`));
  }

  return {
    teamA: [seats[0]!, seats[1]!],
    teamB: [seats[2]!, seats[3]!],
  };
}

/**
 * Host always slot 1. Accepted invitees fill slots 2–4. Golf allows 1–4 so
 * remaining seats are omitted (no guest fill).
 */
export function golfPlayersFromAccepted(
  game: OrganisedGame,
  host: SeatedProfile,
  accepted: SeatedProfile[],
): GolfPlayerInput[] {
  if (host.userId !== game.hostUserId) {
    throw new DomainError("Host must be seated");
  }

  const players: GolfPlayerInput[] = [
    {
      slot: 1,
      displayName: host.displayName,
      isGuest: false,
      userId: host.userId,
    },
  ];

  let slot = 2 as 2 | 3 | 4;
  for (const profile of accepted) {
    if (players.length >= 4) break;
    if (profile.userId === host.userId) continue;
    players.push({
      slot,
      displayName: profile.displayName,
      isGuest: false,
      userId: profile.userId,
    });
    slot = (slot + 1) as 2 | 3 | 4;
  }

  return players;
}

export function assertHostSeatedInPairings(
  pairings: PairingsInput,
  hostUserId: string,
): void {
  const seated = [
    pairings.teamA[0],
    pairings.teamA[1],
    pairings.teamB[0],
    pairings.teamB[1],
  ].some((player) => player.userId === hostUserId && player.isGuest !== true);
  if (!seated) {
    throw new DomainError("Host must be seated in pairings");
  }
}

export function assertHostSeatedInGolfPlayers(
  players: GolfPlayerInput[],
  hostUserId: string,
): void {
  const seated = players.some(
    (player) => player.userId === hostUserId && player.isGuest !== true,
  );
  if (!seated) {
    throw new DomainError("Host must be seated in players");
  }
}
