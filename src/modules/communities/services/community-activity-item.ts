import { GolfRound } from "../../golf-round/entities/golf-round";
import { GolfScoreSnapshot } from "../../golf-round/entities/golf-score";
import { Match } from "../../match/entities/match";
import { MatchScoreSnapshot } from "../../match/entities/match-score";

export const COMMUNITY_ACTIVITY_LIMIT = 30;

export type CommunityActivityPlayer = {
  userId: string | null;
  displayName: string;
  isGuest: boolean;
};

export type CommunityActivityItem = {
  id: string;
  sport: "padel" | "golf";
  kind: "match" | "round";
  lockedAt: string;
  venueCmsId: string | null;
  venueName: string | null;
  path: string;
  summary: string;
  players: CommunityActivityPlayer[];
};

export function toPadelActivityItem(
  match: Match,
  venueName: string | null,
): CommunityActivityItem {
  const snapshot = match.toSnapshot();
  const players = [
    ...snapshot.pairings.teamA,
    ...snapshot.pairings.teamB,
  ].map(toActivityPlayer);
  const teamA = playerNames(snapshot.pairings.teamA);
  const teamB = playerNames(snapshot.pairings.teamB);
  const names = `${teamA} vs ${teamB}`;
  const score = formatPadelScore(snapshot.score);

  return {
    id: snapshot.id,
    sport: "padel",
    kind: "match",
    lockedAt: snapshot.lockedAt ?? snapshot.startsAt,
    venueCmsId: snapshot.venueCmsId || null,
    venueName,
    path: `/padel/${snapshot.id}`,
    summary: score ? `${names} · ${score}` : names,
    players,
  };
}

export function toGolfActivityItem(
  round: GolfRound,
  venueName: string | null,
): CommunityActivityItem {
  const snapshot = round.toSnapshot();
  const players = snapshot.players.map(toActivityPlayer);

  return {
    id: snapshot.id,
    sport: "golf",
    kind: "round",
    lockedAt: snapshot.lockedAt ?? snapshot.startsAt,
    venueCmsId: snapshot.venueCmsId || null,
    venueName,
    path: `/golf/${snapshot.id}`,
    summary: formatGolfScoreLine(snapshot.players, snapshot.score),
    players,
  };
}

export function compareActivityItemsNewestFirst(
  a: CommunityActivityItem,
  b: CommunityActivityItem,
): number {
  const byTime = Date.parse(b.lockedAt) - Date.parse(a.lockedAt);
  if (byTime !== 0) return byTime;
  return b.id.localeCompare(a.id);
}

function toActivityPlayer(player: {
  userId: string | null;
  displayName: string;
  isGuest: boolean;
}): CommunityActivityPlayer {
  return {
    userId: player.userId,
    displayName: player.displayName,
    isGuest: player.isGuest,
  };
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

function playerNames(
  players: Array<{ displayName: string }>,
): string {
  return players.map((player) => firstName(player.displayName)).join(" / ");
}

export function formatPadelScore(
  score: MatchScoreSnapshot | null,
): string | null {
  if (!score?.sets.length) return null;
  return score.sets
    .map((set) => {
      const games = `${set.gamesA}–${set.gamesB}`;
      if (set.tieBreak) {
        return `${games} (${set.tieBreak.pointsA}–${set.tieBreak.pointsB})`;
      }
      return games;
    })
    .join(", ");
}

export function formatGolfScoreLine(
  players: Array<{ slot: number; displayName: string }>,
  score: GolfScoreSnapshot | null,
): string {
  if (!players.length) return "Locked round";
  if (!score?.holes.length) {
    return players.map((player) => firstName(player.displayName)).join(" · ");
  }

  return players
    .map((player) => {
      const gross = score.holes.reduce((sum, hole) => {
        return sum + (hole.strokes[String(player.slot)] ?? 0);
      }, 0);
      return `${firstName(player.displayName)} ${gross}`;
    })
    .join(" · ");
}
