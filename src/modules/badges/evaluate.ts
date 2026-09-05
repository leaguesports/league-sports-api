import { SERVER_BADGE_IDS, type ServerBadgeId } from "./catalog";

export type PadelLockedResult = {
  lockedAt: string;
  /** null when the locked match has no known winner for this player. */
  won: boolean | null;
};

export type BadgeEvidence = {
  padelResults: PadelLockedResult[];
  golfLockedAt: string[];
  friendSince: string[];
};

export type EarnedBadge = {
  id: ServerBadgeId;
  earnedAt: string;
};

function byTimeAsc(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime();
}

function byTimeDesc(a: string, b: string): number {
  return new Date(b).getTime() - new Date(a).getTime();
}

/**
 * Server-side unlock evaluation from session-owned evidence.
 * Never awards `whatsapp_share` — that stays device-local until a share action API exists.
 */
export function evaluateServerBadges(evidence: BadgeEvidence): EarnedBadge[] {
  const earned = new Map<ServerBadgeId, string>();

  const padelAsc = [...evidence.padelResults].sort((a, b) =>
    byTimeAsc(a.lockedAt, b.lockedAt),
  );

  if (padelAsc.length >= 1) {
    earned.set("first_lock", padelAsc[0]!.lockedAt);
  }

  const winsAsc = padelAsc.filter((row) => row.won === true);
  if (winsAsc.length >= 1) {
    earned.set("first_win", winsAsc[0]!.lockedAt);
  }

  if (padelAsc.length >= 5) {
    earned.set("matches_5", padelAsc[4]!.lockedAt);
  }

  const golfAsc = [...evidence.golfLockedAt].sort(byTimeAsc);
  if (golfAsc.length >= 1) {
    earned.set("first_golf", golfAsc[0]!);
  }

  const friendsAsc = [...evidence.friendSince].sort(byTimeAsc);
  if (friendsAsc.length >= 1) {
    earned.set("first_friend", friendsAsc[0]!);
  }

  const decidedNewestFirst = [...evidence.padelResults]
    .filter((row) => row.won !== null)
    .sort((a, b) => byTimeDesc(a.lockedAt, b.lockedAt));
  const form = decidedNewestFirst.slice(0, 5);
  const formWins = form.filter((row) => row.won === true);
  if (formWins.length >= 3) {
    const thirdWin = [...formWins].sort((a, b) =>
      byTimeAsc(a.lockedAt, b.lockedAt),
    )[2]!;
    earned.set("hot_form", thirdWin.lockedAt);
  }

  return SERVER_BADGE_IDS.filter((id) => earned.has(id)).map((id) => ({
    id,
    earnedAt: earned.get(id)!,
  }));
}
