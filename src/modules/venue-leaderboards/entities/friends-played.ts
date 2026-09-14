import {
  BoardProfile,
  toPublicBoardIdentity,
} from "./public-display-name";
import { VenueEventFact } from "./venue-event-fact";

export const FRIENDS_PLAYED_LIMIT = 6;

export type FriendPlayedGolfSummary = {
  sport: "golf";
  bestGross?: number;
  bestNet?: number;
};

export type PublicFriendPlayed = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  lastPlayedAt: string;
  summary: FriendPlayedGolfSummary | null;
};

export type FriendsPlayedResult = {
  total: number;
  friends: PublicFriendPlayed[];
};

export function acceptedFriendIds(
  viewerUserId: string,
  friendships: Array<{
    requesterId: string;
    addresseeId: string;
    status: string;
  }>,
): Set<string> {
  const ids = new Set<string>();
  for (const row of friendships) {
    if (row.status !== "accepted") continue;
    const other =
      row.requesterId === viewerUserId ? row.addresseeId : row.requesterId;
    if (other && other !== viewerUserId) ids.add(other);
  }
  return ids;
}

export function golfSummaryForVenue(
  facts: VenueEventFact[],
): FriendPlayedGolfSummary | null {
  const eighteen = facts.filter((fact) => fact.isEighteenHoleGolf);
  const gross = eighteen
    .map((fact) => fact.golfGross)
    .filter((score): score is number => score != null);
  const nets = eighteen
    .map((fact) => fact.golfNet)
    .filter((score): score is number => score != null);
  if (gross.length === 0 && nets.length === 0) return null;
  return {
    sport: "golf",
    ...(gross.length > 0 ? { bestGross: Math.min(...gross) } : {}),
    ...(nets.length > 0 ? { bestNet: Math.min(...nets) } : {}),
  };
}

export function computeFriendsPlayed(input: {
  facts: VenueEventFact[];
  friendUserIds: ReadonlySet<string>;
  profiles: ReadonlyMap<string, BoardProfile>;
  optedOutUserIds: ReadonlySet<string>;
  limit?: number;
}): FriendsPlayedResult {
  const byUser = new Map<string, VenueEventFact[]>();
  for (const fact of input.facts) {
    if (!fact.userId) continue;
    if (!input.friendUserIds.has(fact.userId)) continue;
    if (input.optedOutUserIds.has(fact.userId)) continue;
    const list = byUser.get(fact.userId) ?? [];
    list.push(fact);
    byUser.set(fact.userId, list);
  }

  const rows = [...byUser.entries()].map(([userId, facts]) => {
    const last = facts.reduce((latest, fact) =>
      fact.lockedAt.getTime() > latest.lockedAt.getTime() ? fact : latest,
    );
    return {
      userId,
      lastPlayedAt: last.lockedAt,
      summary: golfSummaryForVenue(facts),
    };
  });

  rows.sort((a, b) => {
    const delta = b.lastPlayedAt.getTime() - a.lastPlayedAt.getTime();
    if (delta !== 0) return delta;
    return a.userId.localeCompare(b.userId);
  });

  const limit = input.limit ?? FRIENDS_PLAYED_LIMIT;
  const friends = rows.slice(0, limit).map((row) => ({
    ...toPublicBoardIdentity(input.profiles.get(row.userId), row.userId),
    lastPlayedAt: row.lastPlayedAt.toISOString(),
    summary: row.summary,
  }));

  return { total: rows.length, friends };
}
