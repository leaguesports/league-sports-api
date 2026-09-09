import { FriendProfile } from "../../friends/repositories/friendship.repository";
import { DartsPlayerInput } from "../../darts/entities/darts-player";
import { GolfPlayerInput } from "../../golf-round/entities/golf-player";
import { PairingsInput } from "../../match/entities/pairings";
import { TeamMatch } from "../entities/team-match";

export type SeatedProfile = Pick<FriendProfile, "userId" | "displayName">;

function named(profile: SeatedProfile) {
  return {
    displayName: profile.displayName,
    isGuest: false,
    userId: profile.userId,
  };
}

export function pairingsFromLineups(
  match: TeamMatch,
  profiles: Map<string, SeatedProfile>,
): PairingsInput {
  const home = match.homeLineup().userIds;
  const away = match.awayLineup()?.userIds ?? [];
  return {
    teamA: [named(must(profiles, home[0])), named(must(profiles, home[1]))],
    teamB: [named(must(profiles, away[0])), named(must(profiles, away[1]))],
  };
}

export function golfPlayersFromLineups(
  match: TeamMatch,
  profiles: Map<string, SeatedProfile>,
): GolfPlayerInput[] {
  const home = match.homeLineup().userIds;
  const away = match.awayLineup()?.userIds ?? [];
  const players: GolfPlayerInput[] = [];
  let slot = 1 as 1 | 2 | 3 | 4;
  for (const userId of [...home, ...away]) {
    const profile = must(profiles, userId);
    players.push({
      slot,
      displayName: profile.displayName,
      isGuest: false,
      userId: profile.userId,
    });
    slot = (slot + 1) as 1 | 2 | 3 | 4;
  }
  return players;
}

export function dartsPlayersFromLineups(
  match: TeamMatch,
  profiles: Map<string, SeatedProfile>,
): DartsPlayerInput[] {
  const home = match.homeLineup().userIds;
  const away = match.awayLineup()?.userIds ?? [];
  return [...home, ...away].map((userId, index) => {
    const profile = must(profiles, userId);
    return {
      slot: index + 1,
      displayName: profile.displayName,
      isGuest: false,
      userId: profile.userId,
    };
  });
}

function must(
  profiles: Map<string, SeatedProfile>,
  userId: string | undefined,
): SeatedProfile {
  if (!userId) {
    throw new Error("lineup is missing a player");
  }
  return (
    profiles.get(userId) ?? {
      userId,
      displayName: "Player",
    }
  );
}
