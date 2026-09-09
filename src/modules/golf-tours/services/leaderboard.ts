import { GolfRound } from "../../golf-round/entities/golf-round";
import { GolfScore } from "../../golf-round/entities/golf-score";
import { GolfTour } from "../entities/golf-tour";
import { GolfTourFourball } from "../entities/golf-tour-fourball";

export type PublicLeaderboardPlayer = {
  playerKey: string;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
  avgGross: number;
  playerRoundsCounted: number;
  totalStrokes: number;
};

export type PublicCampLeaderboard = {
  campId: string;
  name: string;
  color: string | null;
  players: PublicLeaderboardPlayer[];
};

export type PublicGolfTourLeaderboard = {
  tourId: string;
  status: "draft" | "active" | "completed";
  camps: PublicCampLeaderboard[];
};

/**
 * Guest identity is the trimmed, lowercased display name within a camp
 * (`guest:{name}`). Registered players use `user:{userId}`. The same guest
 * name in two locked fourballs of one camp aggregates as one person.
 */
export function playerIdentityKey(player: {
  userId: string | null;
  isGuest: boolean;
  displayName: string;
}): string {
  if (!player.isGuest && player.userId) {
    return `user:${player.userId}`;
  }
  return `guest:${player.displayName.trim().toLowerCase()}`;
}

export function grossStrokesBySlot(score: GolfScore): Map<number, number> {
  const totals = new Map<number, number>();
  for (const hole of score.holes) {
    for (const [slot, strokes] of Object.entries(hole.strokes)) {
      const key = Number(slot);
      totals.set(key, (totals.get(key) ?? 0) + strokes);
    }
  }
  return totals;
}

type Accumulator = {
  playerKey: string;
  userId: string | null;
  displayName: string;
  isGuest: boolean;
  totalStrokes: number;
  playerRoundsCounted: number;
};

export function buildLeaderboard(
  tour: GolfTour,
  lockedRounds: Map<string, GolfRound>,
): PublicGolfTourLeaderboard {
  const camps = tour.camps.map((camp) => {
    const byKey = new Map<string, Accumulator>();
    const fourballs = tour.fourballs.filter(
      (fourball) =>
        fourball.campId === camp.id && fourball.status.isLocked,
    );

    for (const fourball of fourballs) {
      addLockedFourball(fourball, lockedRounds, byKey);
    }

    const players = [...byKey.values()]
      .map((row) => ({
        playerKey: row.playerKey,
        userId: row.userId,
        displayName: row.displayName,
        isGuest: row.isGuest,
        totalStrokes: row.totalStrokes,
        playerRoundsCounted: row.playerRoundsCounted,
        avgGross: row.totalStrokes / row.playerRoundsCounted,
      }))
      .sort(compareLeaderboardPlayers);

    return {
      campId: camp.id,
      name: camp.name.value,
      color: camp.color,
      players,
    };
  });

  return {
    tourId: tour.id,
    status: tour.status.value,
    camps,
  };
}

function addLockedFourball(
  fourball: GolfTourFourball,
  lockedRounds: Map<string, GolfRound>,
  byKey: Map<string, Accumulator>,
): void {
  if (!fourball.golfRoundId) return;
  const round = lockedRounds.get(fourball.golfRoundId);
  if (!round?.isLocked || !round.score) return;

  const gross = grossStrokesBySlot(round.score);
  for (const player of fourball.players) {
    const strokes = gross.get(player.slot);
    if (strokes == null) continue;
    const playerKey = playerIdentityKey(player);
    const existing = byKey.get(playerKey);
    if (existing) {
      existing.totalStrokes += strokes;
      existing.playerRoundsCounted += 1;
      continue;
    }
    byKey.set(playerKey, {
      playerKey,
      userId: player.userId,
      displayName: player.displayName,
      isGuest: player.isGuest,
      totalStrokes: strokes,
      playerRoundsCounted: 1,
    });
  }
}

function compareLeaderboardPlayers(
  a: PublicLeaderboardPlayer,
  b: PublicLeaderboardPlayer,
): number {
  if (a.avgGross !== b.avgGross) return a.avgGross - b.avgGross;
  if (a.totalStrokes !== b.totalStrokes) return a.totalStrokes - b.totalStrokes;
  return a.displayName.localeCompare(b.displayName);
}
